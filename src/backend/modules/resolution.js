const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all entity resolution candidates
router.get('/candidates', (req, res) => {
  const candidates = db.resolutionCandidates.map(c => {
    const entityAObj = db.getEntityById(c.entityA);
    const entityBObj = db.getEntityById(c.entityB);
    return {
      ...c,
      entityADetails: entityAObj,
      entityBDetails: entityBObj
    };
  });
  res.json({ candidates });
});

// Run manual / automated Entity Resolution Scan
router.post('/run-scan', (req, res) => {
  const entities = db.entities;
  let newCandidatesCount = 0;

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const e1 = entities[i];
      const e2 = entities[j];

      if (e1.type !== e2.type && !(e1.type === 'Person' && e2.type === 'Person')) continue;

      let score = 0;
      const reasons = [];

      // Phone match
      if (e1.primaryPhone && e2.primaryPhone && e1.primaryPhone === e2.primaryPhone) {
        score += 0.40;
        reasons.push({ feature: 'Primary Phone Match', score: 1.0, note: `Exact match: ${e1.primaryPhone}` });
      }

      // Passport match
      if (e1.passportNo && e2.passportNo && e1.passportNo === e2.passportNo) {
        score += 0.45;
        reasons.push({ feature: 'Passport Document Match', score: 1.0, note: `Exact match: ${e1.passportNo}` });
      }

      // Name similarity
      if (e1.name && e2.name) {
        const n1 = e1.name.toLowerCase();
        const n2 = e2.name.toLowerCase();
        if (n1 === n2) {
          score += 0.35;
          reasons.push({ feature: 'Exact Name Match', score: 1.0, note: `Name match: ${e1.name}` });
        } else if (n1.includes(n2.slice(0, 3)) || n2.includes(n1.slice(0, 3))) {
          score += 0.20;
          reasons.push({ feature: 'Partial Alias / Name Similarity', score: 0.70, note: `Similar names: ${e1.name} / ${e2.name}` });
        }
      }

      const totalScore = Math.min(1.0, parseFloat(score.toFixed(2)));

      if (totalScore >= 0.65) {
        const existing = db.resolutionCandidates.find(rc => 
          (rc.entityA === e1.id && rc.entityB === e2.id) || (rc.entityA === e2.id && rc.entityB === e1.id)
        );

        if (!existing) {
          const newCand = {
            id: `RES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            entityA: e1.id,
            entityB: e2.id,
            matchScore: totalScore,
            status: 'PENDING_REVIEW',
            reasons,
            createdAt: new Date().toISOString()
          };
          db.resolutionCandidates.push(newCand);
          newCandidatesCount++;
        }
      }
    }
  }

  db.logAudit('USR-101', 'Dr. Sarah Vance', 'RUN_ENTITY_RESOLUTION', 'Entity Resolution', `Ran automated entity resolution scan. Identified ${newCandidatesCount} new candidate pairs.`);

  res.json({
    message: 'Entity Resolution Scan Completed',
    newCandidatesCount,
    totalPendingCandidates: db.resolutionCandidates.filter(c => c.status === 'PENDING_REVIEW').length
  });
});

module.exports = router;
