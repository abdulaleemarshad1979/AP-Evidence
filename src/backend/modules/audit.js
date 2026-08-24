const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// List Audit Log events (Restricted strictly to Auditor & Admin roles)
router.get('/logs', authenticateMiddleware, abacMiddleware('READ_AUDIT'), async (req, res) => {
  const rows = await db.query(
    `SELECT id, user_id as "userId", username, action, module, details, target_entity_id as "targetEntityId", case_id as "caseId", timestamp, prev_hash as "prevHash", hash FROM audit_events ORDER BY timestamp ASC`
  );
  res.json({ auditLogs: rows });
});

// Verify SHA-256 Cryptographic Hash Chain Integrity
router.get('/verify', authenticateMiddleware, abacMiddleware('READ_AUDIT'), async (req, res) => {
  const rows = await db.query(
    `SELECT id, user_id, username, action, module, details, target_entity_id, case_id, timestamp, prev_hash, hash FROM audit_events ORDER BY timestamp ASC, id ASC`
  );

  let chainValid = true;
  let brokenIndex = -1;
  let brokenLogId = null;

  for (let i = 0; i < rows.length; i++) {
    const log = rows[i];
    const prevHash = i === 0 ? '0000000000000000000000000000000000000000000000000000000000000000' : rows[i - 1].hash;

    // Verify link to previous entry
    if (log.prev_hash !== prevHash) {
      chainValid = false;
      brokenIndex = i;
      brokenLogId = log.id;
      break;
    }

    // Verify self hash signature
    const payloadStr = JSON.stringify({
      userId: log.user_id,
      action: log.action,
      moduleName: log.module,
      details: log.details,
      targetEntityId: log.target_entity_id,
      caseId: log.case_id,
      timestamp: log.timestamp,
      prevHash
    });
    const recomputedHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    if (recomputedHash !== log.hash) {
      chainValid = false;
      brokenIndex = i;
      brokenLogId = log.id;
      break;
    }
  }

  await db.logAudit(req.user.id, req.user.name, 'VERIFY_AUDIT_LEDGER', 'Compliance Ledger', `Verified cryptographic hash chain of ${rows.length} log records: intact=${chainValid}`);

  res.json({
    totalLogs: rows.length,
    chainValid,
    brokenIndex,
    brokenLogId,
    verificationMethod: 'SHA-256 Append-Only Cryptographic Hash Chain',
    externalAnchorLog: 'data/audit_anchors.log'
  });
});

module.exports = router;
