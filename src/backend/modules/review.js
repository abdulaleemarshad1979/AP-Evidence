const express = require('express');
const router = express.Router();
const db = require('../database');

// Execute Entity Merge (Analyst decision)
router.post('/merge', (req, res) => {
  const { primaryId, secondaryId, candidateId, rationale } = req.body;

  if (!primaryId || !secondaryId) {
    return res.status(400).json({ error: 'Both primaryId and secondaryId are required for merge' });
  }

  try {
    const user = db.users[0]; // Dr. Sarah Vance
    const mergedEntity = db.mergeEntities(primaryId, secondaryId, user);
    
    res.json({
      message: 'Entities merged successfully into canonical profile',
      mergedEntity,
      candidateId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject Candidate Pair (Flag as Distinct / False Positive)
router.post('/reject', (req, res) => {
  const { candidateId, rationale } = req.body;
  const candidate = db.resolutionCandidates.find(c => c.id === candidateId);

  if (!candidate) {
    return res.status(404).json({ error: 'Candidate resolution record not found' });
  }

  candidate.status = 'REJECTED_FALSE_POSITIVE';
  candidate.reviewedBy = 'Dr. Sarah Vance';
  candidate.reviewedAt = new Date().toISOString();
  candidate.rationale = rationale || 'Analyst verified entities are distinct';

  db.logAudit('USR-101', 'Dr. Sarah Vance', 'REJECT_ENTITY_MERGE', 'Human Review Queue', `Rejected merge for candidate pair ${candidateId} (${candidate.entityA} vs ${candidate.entityB})`);

  res.json({
    message: 'Candidate pair flagged as distinct entities',
    candidate
  });
});

module.exports = router;
