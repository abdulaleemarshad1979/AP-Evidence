const express = require('express');
const router = express.Router();
const db = require('../database');
const { getContextUser, abacMiddleware } = require('../middleware/abac');

// Get Knowledge Graph network (ABAC Protected)
router.get('/network', abacMiddleware('READ', req => req.query.caseId || 'CASE-SYN-0001'), (req, res) => {
  const user = req.user || getContextUser(req);
  const { centerId, depth, caseId } = req.query;

  let nodes = [];
  let edges = [];

  const targetCaseId = caseId || 'CASE-SYN-0001';
  const targetCase = db.getCaseById(targetCaseId);

  if (!centerId) {
    // Return case target entities or top 30
    const targetIds = targetCase ? targetCase.targetEntityIds : [];
    nodes = db.getEntities().filter(e => targetIds.length === 0 || targetIds.includes(e.id));
    const nodeSet = new Set(nodes.map(n => n.id));
    edges = db.relationships.filter(r => nodeSet.has(r.source) && nodeSet.has(r.target));
  } else {
    const visited = new Set();
    const queue = [{ id: centerId, currentDepth: 0 }];
    const maxDepth = parseInt(depth) || 2;

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      const entity = db.getEntityById(id);
      if (entity) nodes.push(entity);

      if (currentDepth < maxDepth) {
        const connectedRels = db.relationships.filter(r => r.source === id || r.target === id);
        connectedRels.forEach(r => {
          edges.push(r);
          const neighbor = r.source === id ? r.target : r.source;
          if (!visited.has(neighbor)) {
            queue.push({ id: neighbor, currentDepth: currentDepth + 1 });
          }
        });
      }
    }
  }

  // Deduplicate edges
  const edgeMap = new Map();
  edges.forEach(e => {
    const key = [e.source, e.target].sort().join('::') + '::' + e.type;
    edgeMap.set(key, e);
  });

  db.logAudit(user.id, user.name, 'SEARCH', 'Knowledge Graph Engine', `Queried synthetic graph network (Center: ${centerId || 'ALL'}, Depth: ${depth || 2})`, centerId, targetCaseId);

  res.json({
    nodes: nodes.map(n => ({
      id: n.id,
      label: n.name || n.id,
      type: n.type,
      evidenceStatus: n.evidenceStatus,
      assertionClass: n.assertionClass,
      confidenceMethod: n.confidenceMethod,
      humanReviewStatus: n.humanReviewStatus,
      reviewPriority: n.reviewPriority,
      classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
      details: n
    })),
    edges: Array.from(edgeMap.values()).map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      confidence: e.confidence || 0.85,
      confidenceMethod: e.confidenceMethod,
      assertionClass: e.assertionClass,
      evidenceRef: e.evidenceRef
    }))
  });
});

// Expand node connections
router.get('/expand/:nodeId', (req, res) => {
  const nodeId = req.params.nodeId;
  const connectedRels = db.relationships.filter(r => r.source === nodeId || r.target === nodeId);
  const connectedNodeIds = new Set();
  connectedRels.forEach(r => connectedNodeIds.add(r.source === nodeId ? r.target : r.source));

  const connectedNodes = db.getEntities().filter(e => connectedNodeIds.has(e.id));

  res.json({
    nodeId,
    connectedNodes,
    relationships: connectedRels
  });
});

module.exports = router;
