const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../database');
const storage = require('../storage');
const { abacMiddleware } = require('../middleware/abac');
const { authenticateMiddleware } = require('../middleware/auth');

const uploadEvidenceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  mediaType: z.string().optional(),
  caseId: z.string().optional(),
  custodian: z.string().optional(),
  sourceDevice: z.string().optional(),
  parentEvidenceId: z.string().nullable().optional(),
  payloadData: z.string().min(1, 'payloadData (base64 or string) is required'),
  associatedEntityIds: z.array(z.string()).optional()
});

// List evidence vault items (Case-scoped filtering)
router.get('/', authenticateMiddleware, async (req, res) => {
  const { entityId, caseId } = req.query;
  const targetCaseId = caseId || req.headers['x-case-id'];
  let evidenceList = targetCaseId ? await db.getEvidenceList({ caseId: targetCaseId }) : await db.getEvidenceList({});

  if (entityId) {
    evidenceList = evidenceList.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId));
  }

  res.json({ evidence: evidenceList });
});

// Upload evidence item to MinIO/S3 object storage (Streamed SHA-256 calculation & Custody tracking)
router.post('/upload', authenticateMiddleware, async (req, res) => {
  const parseResult = uploadEvidenceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
  }

  const user = req.user;
  const { title, mediaType, caseId, custodian, sourceDevice, parentEvidenceId, payloadData, associatedEntityIds } = parseResult.data;
  const targetCaseId = caseId || req.headers['x-case-id'];

  // Decode buffer
  const buffer = Buffer.from(payloadData, 'base64');
  const evId = `EVI-VAULT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const objectKey = `evidence/${targetCaseId}/${evId}`;

  // Store in object store and get computed hash
  const storeRes = await storage.putObject(objectKey, buffer, mediaType || 'application/octet-stream');

  const classification = 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY';
  const isOriginal = !parentEvidenceId;

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO evidence_metadata (id, title, media_type, file_size, sha256, object_key, version_id, is_original, parent_evidence_id, classification, custodian, source_device, case_id, evidence_status, human_review_status, review_priority, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'VERIFIED_RAW', 'UNREVIEWED', 'P2_MEDIUM', $14)`,
      [
        evId,
        title,
        mediaType || 'RAW_BYTES',
        `${storeRes.byteSize} bytes`,
        storeRes.sha256,
        storeRes.objectKey,
        storeRes.versionId,
        isOriginal,
        parentEvidenceId || null,
        classification,
        custodian || user.name,
        sourceDevice || 'Evidence Portal Capture',
        targetCaseId,
        JSON.stringify({ associatedEntityIds: associatedEntityIds || [] })
      ]
    );

    const custHash = crypto.createHash('sha256').update(`${evId}:UPLOAD_AND_STORED:${user.id}`).digest('hex');
    await client.query(
      `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
       VALUES ($1, $2, $3, $4, $5, 'UPLOAD_AND_STORED', 'Object bytes written to MinIO/S3 vault with SHA-256 verification.', $6)`,
      [`CUST-${evId}`, evId, new Date().toISOString(), user.id, user.name, custHash]
    );

    await db.logAudit(user.id, user.name, 'UPLOAD_EVIDENCE', 'Evidence Vault', `Uploaded evidence item ${evId} (${title}). Hash: ${storeRes.sha256}`, evId, targetCaseId, client);
    await db.emitOutboxEvent('EVIDENCE', evId, 'EVIDENCE_UPLOADED', { id: evId, sha256: storeRes.sha256 }, client);
  });

  const createdEv = await db.getEvidenceById(evId);
  res.status(201).json({
    message: 'Evidence uploaded to object storage with SHA-256 stream verification',
    evidence: createdEv
  });
});

// Verify evidence integrity by reading stored bytes from MinIO/S3 and re-calculating SHA-256
router.get('/:id/verify', authenticateMiddleware, async (req, res) => {
  const ev = await db.getEvidenceById(req.params.id);
  if (!ev) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  const objectKey = ev.objectKey || `evidence/${ev.caseId}/${ev.id}`;
  let integrityRes;
  try {
    integrityRes = await storage.verifyIntegrity(objectKey, ev.sha256);
  } catch (err) {
    integrityRes = {
      integrityVerified: false,
      recomputedHash: 'OBJECT_NOT_FOUND',
      expectedSha256: ev.sha256,
      error: err.message
    };
  }

  const user = req.user;
  const custHash = crypto.createHash('sha256').update(`${ev.id}:VERIFICATION_CHECK:${user.id}:${integrityRes.integrityVerified}`).digest('hex');
  
  await db.execute(
    `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
     VALUES ($1, $2, $3, $4, $5, 'VERIFICATION_CHECK', $6, $7)`,
    [`CUST-${ev.id}-${Date.now()}`, ev.id, new Date().toISOString(), user.id, user.name, `Recomputed bytes hash match: ${integrityRes.integrityVerified}`, custHash]
  );

  await db.logAudit(user.id, user.name, 'VERIFY_EVIDENCE', 'Evidence Vault', `Recomputed byte integrity for evidence ${ev.id}: verified=${integrityRes.integrityVerified}`, ev.id, ev.caseId);

  res.json({
    evidenceId: ev.id,
    integrityVerified: Boolean(integrityRes.integrityVerified),
    expectedSha256: ev.sha256,
    recomputedHash: integrityRes.recomputedHash,
    isOriginal: ev.isOriginal,
    parentEvidenceId: ev.parentEvidenceId
  });
});

// Export evidence (ABAC Protected with EXPORT_EVIDENCE permission)
router.get('/export/:id', authenticateMiddleware, abacMiddleware('EXPORT_EVIDENCE', async req => {
  const ev = await db.getEvidenceById(req.params.id);
  return ev ? ev.caseId : null;
}), async (req, res) => {
  const ev = await db.getEvidenceById(req.params.id);
  if (!ev) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  const objectKey = ev.objectKey || `evidence/${ev.caseId}/${ev.id}`;
  const integrityRes = await storage.verifyIntegrity(objectKey, ev.sha256).catch(() => ({ integrityVerified: false }));

  const exportPayload = {
    evidence: ev,
    exportTimestamp: new Date().toISOString(),
    exportedBy: req.user.username,
    integrityCheck: {
      serverSideHash: ev.sha256,
      integrityVerified: Boolean(integrityRes.integrityVerified),
      custodyEntriesCount: ev.chainOfCustody.length
    }
  };

  const custHash = crypto.createHash('sha256').update(`${ev.id}:EXPORTED:${req.user.id}`).digest('hex');
  await db.execute(
    `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
     VALUES ($1, $2, $3, $4, $5, 'EXPORTED', 'Evidence exported by authorized analyst', $6)`,
    [`CUST-EXP-${ev.id}-${Date.now()}`, ev.id, new Date().toISOString(), req.user.id, req.user.name, custHash]
  );

  await db.logAudit(req.user.id, req.user.name, 'EXPORT_EVIDENCE', 'Evidence Vault', `Exported evidence ${ev.id} (${ev.title}) under ABAC policy`, ev.id, ev.caseId);
  await db.emitOutboxEvent('EVIDENCE', ev.id, 'EVIDENCE_EXPORTED', { id: ev.id, exportedBy: req.user.username });

  res.json(exportPayload);
});

// Get evidence details & record custody event
router.get('/:id', authenticateMiddleware, async (req, res) => {
  const ev = await db.getEvidenceById(req.params.id);
  if (!ev) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  const user = req.user;
  const action = 'ANALYST_ACCESS_AUDIT';
  const notes = 'Access logged for evidence verification';

  const custHash = crypto.createHash('sha256').update(`${ev.id}:${action}:${user.id}:${Date.now()}`).digest('hex');
  const custId = `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  await db.execute(
    `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [custId, ev.id, new Date().toISOString(), user.id, user.name, action, notes, custHash]
  );

  await db.logAudit(user.id, user.name, 'ACCESS_EVIDENCE', 'Evidence Vault', `Accessed evidence item ${ev.id} (${ev.title}) with custody verification`, ev.id, ev.caseId);

  const updatedEv = await db.getEvidenceById(req.params.id);
  const objectKey = updatedEv.objectKey || `evidence/${updatedEv.caseId}/${updatedEv.id}`;
  const integrityRes = await storage.verifyIntegrity(objectKey, updatedEv.sha256).catch(() => ({ integrityVerified: false }));

  res.json({
    evidence: updatedEv,
    integrityVerified: Boolean(integrityRes.integrityVerified),
    serverSideHash: updatedEv.sha256,
    isOriginal: updatedEv.isOriginal,
    parentEvidenceId: updatedEv.parentEvidenceId
  });
});

module.exports = router;
