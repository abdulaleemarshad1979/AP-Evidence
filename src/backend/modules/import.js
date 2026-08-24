const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../database');
const { abacMiddleware } = require('../middleware/abac');
const { authenticateMiddleware } = require('../middleware/auth');

const ingestRecordSchema = z.object({
  eventType: z.string().optional(),
  latitude: z.number().or(z.string()).optional(),
  longitude: z.number().or(z.string()).optional(),
  confidence: z.number().or(z.string()).optional(),
  associatedEntityIds: z.array(z.string()).optional(),
  locationName: z.string().optional(),
  timestamp: z.string().optional()
}).passthrough();

const ingestBatchSchema = z.object({
  sourceFeed: z.string().optional(),
  feedType: z.string().optional(),
  caseId: z.string().optional(),
  records: z.array(z.record(z.any())).min(1, 'Payload must contain at least one record')
});

// Ingestion status & list of recent imports
router.get('/history', authenticateMiddleware, async (req, res) => {
  const rows = await db.query(`SELECT * FROM ingestion_batches ORDER BY created_at DESC`);
  res.json({
    imports: rows.map(b => ({
      batchId: b.id,
      sourceFeed: b.source_feed,
      feedType: b.feed_type,
      totalRecords: b.total_records,
      acceptedRecords: b.accepted_records,
      rejectedRecords: b.rejected_records,
      duplicateRecords: b.duplicate_records,
      quarantinedRecords: b.quarantined_records,
      status: b.status,
      payloadHash: b.payload_hash,
      reconciliationSummary: b.reconciliation_summary ? JSON.parse(b.reconciliation_summary) : {},
      timestamp: b.created_at
    }))
  });
});

// Detailed Reconciliation Endpoint per Batch
router.get('/reconcile/:batchId', authenticateMiddleware, async (req, res) => {
  const batchId = req.params.batchId;
  const batch = await db.queryOne(`SELECT * FROM ingestion_batches WHERE id = $1`, [batchId]);
  if (!batch) {
    return res.status(404).json({ error: 'Ingestion batch not found' });
  }

  const rows = await db.query(`SELECT * FROM ingestion_rows WHERE batch_id = $1 ORDER BY row_index ASC`, [batchId]);
  res.json({
    batchId: batch.id,
    sourceFeed: batch.source_feed,
    feedType: batch.feed_type,
    totalRecords: batch.total_records,
    acceptedRecords: batch.accepted_records,
    rejectedRecords: batch.rejected_records,
    duplicateRecords: batch.duplicate_records,
    quarantinedRecords: batch.quarantined_records,
    status: batch.status,
    payloadHash: batch.payload_hash,
    reconciliationSummary: batch.reconciliation_summary ? JSON.parse(batch.reconciliation_summary) : {},
    rows: rows.map(r => ({
      rowIndex: r.row_index,
      payloadHash: r.payload_hash,
      status: r.status,
      errorDetails: r.error_details,
      rawPayload: JSON.parse(r.raw_payload)
    }))
  });
});

// Ingest structured synthetic raw data payload (Transactional, ABAC INGEST protection, Parameterized Queries)
router.post('/ingest', authenticateMiddleware, abacMiddleware('INGEST', req => req.body.caseId || 'CASE-SYN-0001'), async (req, res) => {
  const parseResult = ingestBatchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
  }

  const user = req.user;
  const { sourceFeed, feedType, caseId, records } = parseResult.data;
  const targetCaseId = caseId || 'CASE-SYN-0001';

  const importBatchId = `IMP-SYN-${Date.now()}`;
  const fullBatchHash = crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex');

  let acceptedRecords = 0;
  let duplicateRecords = 0;
  let quarantinedRecords = 0;
  let rejectedRecords = 0;

  const errorBreakdown = [];

  // Execute ingestion inside an atomic database transaction
  await db.withTransaction(async (client) => {
    // Insert Batch entry
    await client.query(
      `INSERT INTO ingestion_batches (id, source_feed, feed_type, total_records, accepted_records, rejected_records, duplicate_records, quarantined_records, status, payload_hash, reconciliation_summary)
       VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 'PROCESSING', $5, NULL)`,
      [importBatchId, sourceFeed || 'Manual Synthetic Upload', feedType || 'MULTI_SOURCE', records.length, fullBatchHash]
    );

    for (let idx = 0; idx < records.length; idx++) {
      const rec = records[idx];
      const rawPayloadStr = JSON.stringify(rec);
      const rowHash = crypto.createHash('sha256').update(rawPayloadStr).digest('hex');
      const rowId = `ROW-${importBatchId}-${idx}`;

      // 1. Schema Validation
      const validationErrors = [];
      if (!rec.eventType && !feedType) validationErrors.push('Missing required field "eventType" or "feedType"');

      const lat = rec.latitude !== undefined ? parseFloat(rec.latitude) : NaN;
      const lng = rec.longitude !== undefined ? parseFloat(rec.longitude) : NaN;

      if (rec.latitude !== undefined && (isNaN(lat) || lat < -90 || lat > 90)) {
        validationErrors.push(`Invalid latitude value: ${rec.latitude} (must be between -90 and 90)`);
      }
      if (rec.longitude !== undefined && (isNaN(lng) || lng < -180 || lng > 180)) {
        validationErrors.push(`Invalid longitude value: ${rec.longitude} (must be between -180 and 180)`);
      }

      if (rec.confidence !== undefined) {
        const conf = parseFloat(rec.confidence);
        if (isNaN(conf) || conf < 0 || conf > 1) {
          validationErrors.push(`Invalid confidence score: ${rec.confidence} (must be between 0 and 1)`);
        }
      }

      if (validationErrors.length > 0) {
        quarantinedRecords++;
        rejectedRecords++;
        const errMsg = validationErrors.join('; ');
        errorBreakdown.push({ row: idx, error: errMsg });

        await client.query(
          `INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
           VALUES ($1, $2, $3, $4, $5, 'QUARANTINED', $6)`,
          [rowId, importBatchId, idx, rawPayloadStr, rowHash, errMsg]
        );
        continue;
      }

      // 2. Idempotency Check (Duplicates)
      const existingDup = await client.query(
        `SELECT id FROM ingestion_rows WHERE payload_hash = $1 AND status = 'ACCEPTED'`,
        [rowHash]
      );

      if (existingDup.rows.length > 0) {
        duplicateRecords++;
        await client.query(
          `INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
           VALUES ($1, $2, $3, $4, $5, 'DUPLICATE', 'Skipped ingestion: Duplicate payload SHA-256 hash match')`,
          [rowId, importBatchId, idx, rawPayloadStr, rowHash]
        );
        continue;
      }

      // 3. Accepted Record Processing
      const evId = `EVI-RAW-${importBatchId}-${idx}`;
      const classification = 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE';

      await client.query(
        `INSERT INTO evidence_metadata (id, title, media_type, file_size, sha256, is_original, parent_evidence_id, classification, custodian, source_device, case_id, evidence_status, human_review_status, review_priority, metadata)
         VALUES ($1, $2, 'JSON_PAYLOAD', $3, $4, TRUE, NULL, $5, 'Automated Ingestion Engine', $6, $7, 'VERIFIED_RAW', 'UNREVIEWED', 'P2_MEDIUM', $8)`,
        [evId, `Synthetic Raw Telemetry Packet (${sourceFeed || 'Generic Feed'})`, `${rawPayloadStr.length} bytes`, rowHash, classification, sourceFeed || 'External Data Feed', targetCaseId, JSON.stringify({ associatedEntityIds: rec.associatedEntityIds || [] })]
      );

      const custHash = crypto.createHash('sha256').update(`${evId}:INGESTED_AND_HASHED:${user.id}`).digest('hex');
      await client.query(
        `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
         VALUES ($1, $2, $3, $4, $5, 'INGESTED_AND_HASHED', 'Raw synthetic payload verified upon ingestion.', $6)`,
        [`CUST-${evId}`, evId, new Date().toISOString(), user.id, user.name, custHash]
      );

      // Create Observation with spatial PostGIS point
      const obsId = `OBS-IMP-${importBatchId}-${idx}`;
      const entityId = (rec.associatedEntityIds && rec.associatedEntityIds.length > 0) ? rec.associatedEntityIds[0] : 'SUB-00001';
      const eventType = rec.eventType || feedType || 'TELEMETRY_SIGNAL';
      const timestamp = rec.timestamp || new Date().toISOString();
      const locName = rec.locationName || 'Ingested Synthetic Coordinate Node';
      const latitude = isNaN(lat) ? 51.5074 : lat;
      const longitude = isNaN(lng) ? -0.1478 : lng;
      const confidence = rec.confidence !== undefined ? parseFloat(rec.confidence) : 0.90;

      await client.query(
        `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, location_geom, confidence_score, evidence_status, raw_data, evidence_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography, $9, 'VERIFIED_RAW', $10, $11)`,
        [obsId, entityId, targetCaseId, eventType, timestamp, locName, latitude, longitude, confidence, rawPayloadStr, evId]
      );

      await client.query(
        `INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
         VALUES ($1, $2, $3, $4, $5, 'ACCEPTED', NULL)`,
        [rowId, importBatchId, idx, rawPayloadStr, rowHash]
      );

      acceptedRecords++;
    }

    const reconciliationSummary = {
      totalRecords: records.length,
      acceptedRecords,
      rejectedRecords,
      duplicateRecords,
      quarantinedRecords,
      errorBreakdown
    };

    // Update batch status
    await client.query(
      `UPDATE ingestion_batches 
       SET accepted_records = $1, rejected_records = $2, duplicate_records = $3, quarantined_records = $4, status = 'COMPLETED', reconciliation_summary = $5
       WHERE id = $6`,
      [acceptedRecords, rejectedRecords, duplicateRecords, quarantinedRecords, JSON.stringify(reconciliationSummary), importBatchId]
    );

    await db.logAudit(user.id, user.name, 'INGEST_DATA', 'Data Import Portal', `Ingested batch ${importBatchId}: Accepted=${acceptedRecords}, Quarantined=${quarantinedRecords}, Duplicates=${duplicateRecords}`, null, targetCaseId, client);
    await db.emitOutboxEvent('INGESTION_BATCH', importBatchId, 'BATCH_INGESTED', reconciliationSummary, client);
  });

  const reconciliationSummary = {
    totalRecords: records.length,
    acceptedRecords,
    rejectedRecords,
    duplicateRecords,
    quarantinedRecords,
    errorBreakdown
  };

  res.status(201).json({
    message: 'Data batch processed with schema validation and idempotency checks',
    summary: {
      batchId: importBatchId,
      sourceFeed: sourceFeed || 'Manual Synthetic Upload',
      totalRecords: records.length,
      acceptedRecords,
      rejectedRecords,
      duplicateRecords,
      quarantinedRecords,
      reconciliationSummary
    }
  });
});

module.exports = router;
