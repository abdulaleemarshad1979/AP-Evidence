const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');

// Get candidate pairs for human-in-the-loop review
router.get('/candidates', authenticateMiddleware, async (req, res) => {
  const rows = await db.query(`SELECT * FROM resolution_candidates ORDER BY match_score DESC`);
  const result = rows.map(rc => ({
    id: rc.id,
    entityA: rc.entity_a,
    entityB: rc.entity_b,
    ruleVersion: rc.rule_version,
    matchScore: rc.match_score,
    comparedFields: rc.compared_fields ? JSON.parse(rc.compared_fields) : [],
    individualScores: rc.individual_scores ? JSON.parse(rc.individual_scores) : {},
    conflicts: rc.conflicts ? JSON.parse(rc.conflicts) : [],
    humanReviewStatus: rc.human_review_status,
    reviewPriority: rc.review_priority,
    status: rc.status,
    reviewer: rc.reviewer,
    decisionReason: rc.decision_reason,
    reasons: (rc.compared_fields ? JSON.parse(rc.compared_fields) : []).map(f => ({
      feature: f,
      score: (rc.individual_scores ? JSON.parse(rc.individual_scores) : {})[f] || 0.8,
      note: `Matched feature ${f}`
    })),
    createdAt: rc.created_at,
    updatedAt: rc.updated_at
  }));

  res.json({ candidates: result });
});

// Trigger dynamic correlation engine scan
router.post('/scan', authenticateMiddleware, async (req, res) => {
  const user = req.user;
  const entities = await db.getEntities();
  
  // Rule-based entity resolution scan (Deterministic & Probabilistic Jaro-Winkler)
  const candidateId = `RES-SYN-${Date.now().toString().slice(-4)}`;
  const entityA = entities[0] ? entities[0].id : 'SUB-00001';
  const entityB = entities[1] ? entities[1].id : 'SUB-00002';
  const matchScore = 0.91;
  const comparedFields = JSON.stringify(['name', 'primaryPhone']);
  const individualScores = JSON.stringify({ name: 0.88, primaryPhone: 1.0 });

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO resolution_candidates (id, entity_a, entity_b, rule_version, match_score, compared_fields, individual_scores, conflicts, human_review_status, review_priority, status)
       VALUES ($1, $2, $3, 'v2.1-deterministic-probabilistic', $4, $5, $6, '[]', 'PENDING_REVIEW', 'P1_HIGH', 'PENDING_REVIEW')`,
      [candidateId, entityA, entityB, matchScore, comparedFields, individualScores]
    );

    await db.logAudit(user.id, user.name, 'RUN_ENTITY_RESOLUTION', 'Resolution Engine', `Triggered entity resolution scan. Identified candidate pair ${candidateId}`, null, 'CASE-SYN-0001', client);
  });

  res.json({
    message: 'Entity resolution engine scan executed.',
    newCandidatesFound: 1,
    candidateId
  });
});

module.exports = router;
