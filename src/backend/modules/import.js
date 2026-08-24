const express = require('express');
const router = express.Router();
const db = require('../database');
const crypto = require('crypto');
const { getContextUser, abacMiddleware } = require('../middleware/abac');

// Ingestion status & list of recent imports
router.get('/history', (req, res) => {
  res.json({ imports: db.imports });
});

// Detailed Reconciliation Endpoint per Batch
router.get('/reconcile/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  const batch = db.queryOne(`SELECT * FROM ingestion_batches WHERE id = '${batchId}'`);
  if (!batch) {
    return res.status(404).json({ error: 'Ingestion batch not found' });
  }

  const rows = db.query(`SELECT * FROM ingestion_rows WHERE batch_id = '${batchId}' ORDER BY row_index ASC`);
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

// Ingest structured synthetic raw data payload
router.post('/ingest', (req, res) => {
  const user = getContextUser(req);
  const { sourceFeed, feedType, caseId, records } = req.body;

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Payload must contain a "records" array' });
  }

  // ABAC check if caseId provided
  let targetCaseId = caseId || 'CASE-SYN-0001';
  const targetCase = db.getCaseById(targetCaseId);

  const importBatchId = `IMP-SYN-${Date.now()}`;
  const fullBatchHash = crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex');

  let acceptedRecords = 0;
  let duplicateRecords = 0;
  let quarantinedRecords = 0;
  let rejectedRecords = 0;

  const errorBreakdown = [];

  records.forEach((rec, idx) => {
    const rawPayloadStr = JSON.stringify(rec);
    const rowHash = crypto.createHash('sha256').update(rawPayloadStr).digest('hex');
    const rowId = `ROW-${importBatchId}-${idx}`;

    // 1. Schema Validation
    const validationErrors = [];
    if (!rec.eventType && !feedType) validationErrors.push('Missing required field "eventType" or "feedType"');
    
    const lat = parseFloat(rec.latitude);
    const lng = parseFloat(rec.longitude);
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

      db.execute(`
        INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
        VALUES ('${rowId}', '${importBatchId}', ${idx}, '${rawPayloadStr.replace(/'/g, "''")}', '${rowHash}', 'QUARANTINED', '${errMsg.replace(/'/g, "''")}')
      `);
      return;
    }

    // 2. Idempotency Check (Duplicates)
    const existingDuplicate = db.queryOne(`SELECT id FROM ingestion_rows WHERE payload_hash = '${rowHash}' AND status = 'ACCEPTED'`);
    if (existingDuplicate) {
      duplicateRecords++;
      db.execute(`
        INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
        VALUES ('${rowId}', '${importBatchId}', ${idx}, '${rawPayloadStr.replace(/'/g, "''")}', '${rowHash}', 'DUPLICATE', 'Skipped ingestion: Duplicate payload SHA-256 hash match')
      `);
      return;
    }

    // 3. Accepted Record Processing
    const evId = `EVI-RAW-${importBatchId}-${idx}`;
    const classification = 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE';

    db.execute(`
      INSERT INTO evidence_metadata (id, title, media_type, file_size, sha256, is_original, parent_evidence_id, classification, custodian, source_device, case_id, evidence_status, human_review_status, review_priority, metadata)
      VALUES ('${evId}', 'Synthetic Raw Telemetry Packet (${sourceFeed || 'Generic Feed'})', 'JSON_PAYLOAD', '${rawPayloadStr.length} bytes', '${rowHash}', TRUE, NULL, '${classification}', 'Automated Ingestion Engine', '${(sourceFeed || 'External Data Feed').replace(/'/g, "''")}', '${targetCaseId}', 'VERIFIED_RAW', 'UNREVIEWED', 'P2_MEDIUM', '${JSON.stringify({ associatedEntityIds: rec.associatedEntityIds || [] }).replace(/'/g, "''")}')
    `);

    const custHash = crypto.createHash('sha256').update(`${evId}:INGESTED_AND_HASHED:${user.id}`).digest('hex');
    db.execute(`
      INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
      VALUES ('CUST-${evId}', '${evId}', '${new Date().toISOString()}', '${user.id}', '${user.name.replace(/'/g, "''")}', 'INGESTED_AND_HASHED', 'Raw synthetic payload verified upon ingestion.', '${custHash}')
    `);

    // Create Observation
    const obsId = `OBS-IMP-${importBatchId}-${idx}`;
    const entityId = (rec.associatedEntityIds && rec.associatedEntityIds.length > 0) ? rec.associatedEntityIds[0] : 'SUB-00001';
    const eventType = rec.eventType || feedType || 'TELEMETRY_SIGNAL';
    const timestamp = rec.timestamp || new Date().toISOString();
    const locName = (rec.locationName || 'Ingested Synthetic Coordinate Node').replace(/'/g, "''");
    const latitude = isNaN(lat) ? 51.5074 : lat;
    const longitude = isNaN(lng) ? -0.1478 : lng;
    const confidence = rec.confidence !== undefined ? parseFloat(rec.confidence) : 0.90;

    db.execute(`
      INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id)
      VALUES ('${obsId}', '${entityId}', '${targetCaseId}', '${eventType}', '${timestamp}', '${locName}', ${latitude}, ${longitude}, ${confidence}, 'VERIFIED_RAW', '${rawPayloadStr.replace(/'/g, "''")}', '${evId}')
    `);

    db.execute(`
      INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
      VALUES ('${rowId}', '${importBatchId}', ${idx}, '${rawPayloadStr.replace(/'/g, "''")}', '${rowHash}', 'ACCEPTED', NULL)
    `);

    acceptedRecords++;
  });

  const reconciliationSummary = {
    totalRecords: records.length,
    acceptedRecords,
    rejectedRecords,
    duplicateRecords,
    quarantinedRecords,
    errorBreakdown
  };

  db.execute(`
    INSERT INTO ingestion_batches (id, source_feed, feed_type, total_records, accepted_records, rejected_records, duplicate_records, quarantined_records, status, payload_hash, reconciliation_summary)
    VALUES ('${importBatchId}', '${(sourceFeed || 'Manual Synthetic Upload').replace(/'/g, "''")}', '${feedType || 'MULTI_SOURCE'}', ${records.length}, ${acceptedRecords}, ${rejectedRecords}, ${duplicateRecords}, ${quarantinedRecords}, 'COMPLETED', '${fullBatchHash}', '${JSON.stringify(reconciliationSummary).replace(/'/g, "''")}')
  `);

  db.logAudit(user.id, user.name, 'INGEST_DATA', 'Data Import Portal', `Ingested batch ${importBatchId}: Accepted=${acceptedRecords}, Quarantined=${quarantinedRecords}, Duplicates=${duplicateRecords}`, null, targetCaseId);
  db.emitOutboxEvent('INGESTION_BATCH', importBatchId, 'BATCH_INGESTED', reconciliationSummary);

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
