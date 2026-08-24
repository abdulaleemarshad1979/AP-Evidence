const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

const handleGraphQuery = async (req, res) => {
  const { caseId, search, centerId } = req.query;
  const targetCaseId = caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';

  let entities = await db.getEntities({ search });
  let assertionsRows = await db.query(`SELECT * FROM assertions WHERE case_id = $1`, [targetCaseId]);

  if (centerId) {
    const neighborIds = new Set([centerId]);
    assertionsRows.forEach(a => {
      if (a.subject_entity_id === centerId) neighborIds.add(a.object_entity_id);
      if (a.object_entity_id === centerId) neighborIds.add(a.subject_entity_id);
    });
    entities = entities.filter(e => neighborIds.has(e.id));
  }

  // Construct dual Cytoscape and 2D Canvas compatible graph format
  const nodes = entities.map(e => ({
    id: e.id,
    label: e.name,
    type: e.type,
    evidenceStatus: e.evidenceStatus,
    assertionClass: e.assertionClass,
    humanReviewStatus: e.humanReviewStatus,
    reviewPriority: e.reviewPriority,
    isFictional: e.isFictional,
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
    id: a.id,
    source: a.subject_entity_id,
    target: a.object_entity_id,
    type: a.relation_type,
    label: a.relation_type,
    confidence: a.confidence_score,
    confidenceMethod: a.confidence_method,
    assertionClass: a.assertion_class,
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
};

// Knowledge Graph query endpoints
router.get('/', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001'), handleGraphQuery);
router.get('/network', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001'), handleGraphQuery);

module.exports = router;
