const express = require('express');
const router = express.Router();
const db = require('../database');
const crypto = require('crypto');

function verifyAuditChain(logs) {
  if (!logs || logs.length === 0) return { isValid: true, tamperedIndex: -1 };

  for (let i = 0; i < logs.length; i++) {
    const current = logs[i];
    const expectedPrevHash = i === 0
      ? '0000000000000000000000000000000000000000000000000000000000000000'
      : logs[i - 1].hash;

    if (current.prevHash !== expectedPrevHash) {
      return { isValid: false, tamperedIndex: i, reason: `PrevHash mismatch at index ${i}` };
    }

    const payloadStr = JSON.stringify({
      userId: current.userId,
      action: current.action,
      moduleName: current.module,
      details: current.details,
      targetEntityId: current.targetEntityId || null,
      caseId: current.caseId || null,
      timestamp: current.timestamp,
      prevHash: current.prevHash
    });
    const recomputedHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    if (recomputedHash !== current.hash) {
      return { isValid: false, tamperedIndex: i, reason: `Hash mismatch at index ${i}` };
    }
  }

  return { isValid: true, tamperedIndex: -1 };
}

// Query Immutable Audit Ledger
router.get('/', (req, res) => {
  const { module: moduleFilter, user: userFilter, limit } = req.query;
  let logs = db.auditLogs;

  if (moduleFilter) {
    logs = logs.filter(l => l.module.toLowerCase() === moduleFilter.toLowerCase());
  }

  if (userFilter) {
    logs = logs.filter(l => l.username.toLowerCase().includes(userFilter.toLowerCase()));
  }

  const verification = verifyAuditChain(db.auditLogs);

  res.json({
    auditLogs: logs.slice().reverse(),
    totalRecords: db.auditLogs.length,
    isCryptographicChainValid: verification.isValid,
    tamperedIndex: verification.tamperedIndex,
    headHash: db.auditLogs.length > 0 ? db.auditLogs[db.auditLogs.length - 1].hash : null
  });
});

// Explicit Tamper-Detection Verification API Endpoint
router.get('/verify', (req, res) => {
  const verification = verifyAuditChain(db.auditLogs);
  res.json({
    isCryptographicChainValid: verification.isValid,
    tamperedIndex: verification.tamperedIndex,
    totalRecords: db.auditLogs.length,
    explanation: {
      canProtect: 'Detects unauthorized modifications, reordering, or insertions within the event stream.',
      cannotProtect: 'Cannot prevent direct database row deletion from tail without external timestamping anchors.'
    }
  });
});

module.exports = router;
