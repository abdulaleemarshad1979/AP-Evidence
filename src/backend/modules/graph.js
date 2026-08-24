const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Knowledge Graph query endpoint (Filter results to authorized cases)
router.get('/', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || 'CASE-SYN-0001'), async (req, res) => {
  const { caseId, search } = req.query;
  const targetCaseId = caseId || 'CASE-SYN-0001';

  let entities = await db.getEntities({ search });
  let assertionsRows = await db.query(`SELECT * FROM assertions WHERE case_id = $1`, [targetCaseId]);

  // Construct Cytoscape-compatible graph format
  const nodes = entities.map(e => ({
    data: {
      id: e.id,
      label: e.name,
      type: e.type,
      evidenceStatus: e.evidenceStatus,
      assertionClass: e.assertionClass,
      humanReviewStatus: e.humanReviewStatus,
      reviewPriority: e.reviewPriority,
      isFictional: e.isFictional
    }
  }));

  const edges = assertionsRows.map(a => ({
    data: {
      id: a.id,
      source: a.subject_entity_id,
      target: a.object_entity_id,
      label: a.relation_type,
      confidence: a.confidence_score,
      confidenceMethod: a.confidence_method,
      assertionClass: a.assertion_class
    }
  }));

  await db.logAudit(req.user.id, req.user.name, 'QUERY_KNOWLEDGE_GRAPH', 'Graph Engine', `Queried knowledge graph nodes (${nodes.length}) and edges (${edges.length}) for case ${targetCaseId}`, null, targetCaseId);

  res.json({ nodes, edges });
});

module.exports = router;
