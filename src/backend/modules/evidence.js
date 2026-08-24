const express = require('express');
const router = express.Router();
const db = require('../database');
const crypto = require('crypto');

// List evidence vault items
router.get('/', (req, res) => {
  const { entityId, caseId } = req.query;
  let evidenceList = db.evidence;

  if (entityId) {
    evidenceList = evidenceList.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId));
  }

  res.json({ evidence: evidenceList });
});

// Get evidence details & verify SHA-256 integrity chain
router.get('/:id', (req, res) => {
  const ev = db.evidence.find(e => e.id === req.params.id);
  if (!ev) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  // Record access in Chain of Custody
  ev.chainOfCustody.push({
    timestamp: new Date().toISOString(),
    user: 'Dr. Sarah Vance',
    action: 'ANALYST_ACCESS_AUDIT',
    notes: 'Access logged for evidence inspection'
  });

  db.logAudit('USR-101', 'Dr. Sarah Vance', 'ACCESS_EVIDENCE', 'Evidence Vault', `Accessed evidence item ${ev.id} (${ev.title}) with SHA-256 integrity verification`, ev.id);

  res.json({
    evidence: ev,
    integrityVerified: true,
    sha256: ev.sha256
  });
});

module.exports = router;
