const express = require('express');
const router = express.Router();
const db = require('../database');
const { getContextUser } = require('../middleware/abac');

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
  const user = getContextUser(req);
  const entities = db.getEntities();
  let newCandidatesCount = 0;

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const e1 = entities[i];
      const e2 = entities[j];

      if (e1.type !== e2.type && !(e1.type === 'Person' && e2.type === 'Person')) continue;

      const comparedFields = ['name', 'primaryPhone', 'passportNo'];
      const individualScores = {};
      const conflicts = [];
      let totalScore = 0;

      // Phone match
      const p1 = e1.identifierFields?.primaryPhone;
      const p2 = e2.identifierFields?.primaryPhone;
      if (p1 && p2 && p1 === p2) {
        individualScores.primaryPhone = 1.0;
        totalScore += 0.40;
      } else if (p1 && p2) {
        individualScores.primaryPhone = 0.0;
        conflicts.push({ field: 'primaryPhone', valA: p1, valB: p2 });
      }

      // Passport match
      const pass1 = e1.identifierFields?.passportNo;
      const pass2 = e2.identifierFields?.passportNo;
      if (pass1 && pass2 && pass1 === pass2) {
        individualScores.passportNo = 1.0;
        totalScore += 0.45;
      } else if (pass1 && pass2) {
        individualScores.passportNo = 0.0;
        conflicts.push({ field: 'passportNo', valA: pass1, valB: pass2 });
      }

      // Name similarity
      if (e1.name && e2.name) {
        const n1 = e1.name.toLowerCase();
        const n2 = e2.name.toLowerCase();
        if (n1 === n2) {
          individualScores.name = 1.0;
          totalScore += 0.35;
        } else if (n1.includes(n2.slice(0, 3)) || n2.includes(n1.slice(0, 3))) {
          individualScores.name = 0.75;
          totalScore += 0.20;
        } else {
          individualScores.name = 0.10;
        }
      }

      const matchScore = Math.min(1.0, parseFloat(totalScore.toFixed(2)));

      if (matchScore >= 0.65) {
        const existing = db.queryOne(
          `SELECT id FROM resolution_candidates WHERE (entity_a = '${e1.id}' AND entity_b = '${e2.id}') OR (entity_a = '${e2.id}' AND entity_b = '${e1.id}')`
        );

        if (!existing) {
          const id = `RES-SYN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const ruleVersion = 'v2.1-deterministic-probabilistic';

          db.execute(`
            INSERT INTO resolution_candidates (id, entity_a, entity_b, rule_version, match_score, compared_fields, individual_scores, conflicts, human_review_status, review_priority, status)
            VALUES ('${id}', '${e1.id}', '${e2.id}', '${ruleVersion}', ${matchScore}, '${JSON.stringify(comparedFields).replace(/'/g, "''")}', '${JSON.stringify(individualScores).replace(/'/g, "''")}', '${JSON.stringify(conflicts).replace(/'/g, "''")}', 'PENDING_REVIEW', 'P1_HIGH', 'PENDING_REVIEW')
          `);
          newCandidatesCount++;
        }
      }
    }
  }

  db.logAudit(user.id, user.name, 'RUN_ENTITY_RESOLUTION', 'Entity Resolution', `Ran entity resolution scan v2.1. Generated ${newCandidatesCount} resolution candidate pairs.`);
  db.emitOutboxEvent('ENTITY_RESOLUTION', 'SCAN-RUN', 'RESOLUTION_SCAN_COMPLETED', { newCandidatesCount });

  res.json({
    message: 'Entity Resolution Scan Completed',
    newCandidatesCount,
    totalPendingCandidates: db.resolutionCandidates.filter(c => c.status === 'PENDING_REVIEW').length
  });
});

module.exports = router;
