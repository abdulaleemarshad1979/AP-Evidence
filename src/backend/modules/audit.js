const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

async function verifyAuditChain(rows) {
  let chainValid = true;
  let brokenIndex = -1;
  let brokenLogId = null;

  for (let i = 0; i < rows.length; i++) {
    const log = rows[i];
    const prevHash = i === 0 ? '0000000000000000000000000000000000000000000000000000000000000000' : rows[i - 1].hash;

    const logPrevHash = log.prev_hash || log.prevHash;
    if (logPrevHash !== prevHash) {
      chainValid = false;
      brokenIndex = i;
      brokenLogId = log.id;
      break;
    }

    const payloadStr = JSON.stringify({
      userId: log.user_id || log.userId,
      action: log.action,
      moduleName: log.module,
      details: log.details,
      targetEntityId: log.target_entity_id || log.targetEntityId,
      caseId: log.case_id || log.caseId,
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

  return { chainValid, brokenIndex, brokenLogId };
}

const handleGetLogs = async (req, res) => {
  const rows = await db.query(
    `SELECT id, user_id as "userId", username, action, module, details, target_entity_id as "targetEntityId", case_id as "caseId", timestamp, prev_hash as "prevHash", hash FROM audit_events ORDER BY timestamp ASC`
  );
  
  const verification = await verifyAuditChain(rows);

  res.json({
    auditLogs: rows,
    totalRecords: rows.length,
    isCryptographicChainValid: verification.chainValid,
    tamperedIndex: verification.brokenIndex
  });
};

// List Audit Log events
router.get('/', authenticateMiddleware, abacMiddleware('READ_AUDIT'), handleGetLogs);
router.get('/logs', authenticateMiddleware, abacMiddleware('READ_AUDIT'), handleGetLogs);

// Verify SHA-256 Cryptographic Hash Chain Integrity
router.get('/verify', authenticateMiddleware, abacMiddleware('READ_AUDIT'), async (req, res) => {
  const rows = await db.query(
    `SELECT id, user_id as "userId", username, action, module, details, target_entity_id as "targetEntityId", case_id as "caseId", timestamp, prev_hash as "prevHash", hash FROM audit_events ORDER BY timestamp ASC, id ASC`
  );

  const verification = await verifyAuditChain(rows);

  await db.logAudit(req.user.id, req.user.name, 'VERIFY_AUDIT_LEDGER', 'Compliance Ledger', `Verified cryptographic hash chain of ${rows.length} log records: intact=${verification.chainValid}`);

  res.json({
    totalLogs: rows.length,
    totalRecords: rows.length,
    chainValid: verification.chainValid,
    isCryptographicChainValid: verification.chainValid,
    brokenIndex: verification.brokenIndex,
    tamperedIndex: verification.brokenIndex,
    brokenLogId: verification.brokenLogId,
    verificationMethod: 'SHA-256 Append-Only Cryptographic Hash Chain',
    externalAnchorLog: 'data/audit_anchors.log'
  });
});

module.exports = router;
