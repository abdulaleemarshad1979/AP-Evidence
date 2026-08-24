const express = require('express');
const router = express.Router();
const db = require('../database');

// Query Immutable Audit Ledger
router.get('/', (req, res) => {
  const { module: moduleFilter, user: userFilter, limit } = req.query;
  let logs = [...db.auditLogs];

  if (moduleFilter) {
    logs = logs.filter(l => l.module.toLowerCase() === moduleFilter.toLowerCase());
  }

  if (userFilter) {
    logs = logs.filter(l => l.username.toLowerCase().includes(userFilter.toLowerCase()));
  }

  // Sort newest first
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (limit) {
    logs = logs.slice(0, parseInt(limit));
  }

  // Verify hash chain integrity
  let isChainValid = true;
  for (let i = 1; i < db.auditLogs.length; i++) {
    if (db.auditLogs[i].prevHash !== db.auditLogs[i - 1].hash) {
      isChainValid = false;
      break;
    }
  }

  res.json({
    auditLogs: logs,
    totalRecords: db.auditLogs.length,
    isCryptographicChainValid: isChainValid,
    headHash: db.auditLogs.length > 0 ? db.auditLogs[db.auditLogs.length - 1].hash : null
  });
});

module.exports = router;
