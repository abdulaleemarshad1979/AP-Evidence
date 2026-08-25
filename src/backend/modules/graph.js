const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

const { maskSubjectData } = require('../middleware/auth');

// Helper to compute Degree and Betweenness Centrality
function computeGraphMetrics(nodes, edges) {
  const nodeDegrees = {};
  const adj = {};

  nodes.forEach(n => {
    nodeDegrees[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach(e => {
    if (adj[e.source] && adj[e.target]) {
      nodeDegrees[e.source] = (nodeDegrees[e.source] || 0) + 1;
      nodeDegrees[e.target] = (nodeDegrees[e.target] || 0) + 1;
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    }
  });

  // Calculate betweenness centrality approximation
  const betweenness = {};
  nodes.forEach(n => { betweenness[n.id] = 0; });

  nodes.forEach(s => {
    const queue = [s.id];
    const dist = { [s.id]: 0 };
    const paths = { [s.id]: 1 };
    const stack = [];
    const pred = {};
    nodes.forEach(n => { pred[n.id] = []; });

    while (queue.length > 0) {
      const v = queue.shift();
      stack.push(v);
      (adj[v] || []).forEach(w => {
        if (!(w in dist)) {
          dist[w] = dist[v] + 1;
          queue.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          paths[w] = (paths[w] || 0) + paths[v];
          pred[w].push(v);
        }
      });
    }

    const delta = {};
    nodes.forEach(n => { delta[n.id] = 0; });
    while (stack.length > 0) {
      const w = stack.pop();
      (pred[w] || []).forEach(v => {
        delta[v] += (paths[v] / paths[w]) * (1 + delta[w]);
      });
      if (w !== s.id) {
        betweenness[w] += delta[w];
      }
    }
  });

  // Normalize betweenness
  const n = nodes.length;
  const scale = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;
  nodes.forEach(node => {
    const d = nodeDegrees[node.id] || 0;
    const b = (betweenness[node.id] || 0) * scale;
    node.degreeCentrality = d;
    node.betweennessCentrality = Math.round(b * 1000) / 1000;
    if (node.data) {
      node.data.degreeCentrality = d;
      node.data.betweennessCentrality = Math.round(b * 1000) / 1000;
    }
  });
}

const handleGraphQuery = async (req, res) => {
  const { caseId, search, centerId, maxHops } = req.query;
  const targetCaseId = caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const userClearance = req.user?.clearanceLevel || 2;
  const hops = parseInt(maxHops || '2', 10);

  let rawEntities = await db.getEntities({ search });
  let assertionsRows = await db.query(`SELECT * FROM assertions WHERE case_id = $1`, [targetCaseId]);

  if (centerId) {
    let activeSet = new Set([centerId]);
    for (let h = 0; h < hops; h++) {
      const nextSet = new Set(activeSet);
      assertionsRows.forEach(a => {
        if (activeSet.has(a.subject_entity_id)) nextSet.add(a.object_entity_id);
        if (activeSet.has(a.object_entity_id)) nextSet.add(a.subject_entity_id);
      });
      activeSet = nextSet;
    }
    rawEntities = rawEntities.filter(e => activeSet.has(e.id));
    assertionsRows = assertionsRows.filter(a => activeSet.has(a.subject_entity_id) && activeSet.has(a.object_entity_id));
  }

  // Construct dual Cytoscape and 2D Canvas compatible graph format with data masking
  const nodes = rawEntities.map(rawE => {
    const e = maskSubjectData(rawE, userClearance);
    return {
      id: e.id,
      label: e.name,
      type: e.type,
      evidenceStatus: e.evidenceStatus,
      assertionClass: e.assertionClass,
      humanReviewStatus: e.humanReviewStatus,
      reviewPriority: e.reviewPriority,
      isFictional: e.isFictional,
      isMasked: Boolean(e.isMasked),
      data: {
        id: e.id,
        label: e.name,
        type: e.type,
        evidenceStatus: e.evidenceStatus,
        assertionClass: e.assertionClass,
        humanReviewStatus: e.humanReviewStatus,
        reviewPriority: e.reviewPriority,
        isFictional: e.isFictional,
        isMasked: Boolean(e.isMasked)
      }
    };
  });

  const edges = assertionsRows.map(a => ({
    id: a.id,
    source: a.subject_entity_id,
    target: a.object_entity_id,
    type: a.relation_type,
    label: a.relation_type,
    confidence: a.confidence_score,
    confidenceMethod: a.confidence_method,
    assertionClass: a.assertion_class,
    evidenceRef: a.evidence_id,
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

  computeGraphMetrics(nodes, edges);

  await db.logAudit(req.user.id, req.user.name, 'QUERY_KNOWLEDGE_GRAPH', 'Graph Engine', `Queried knowledge graph nodes (${nodes.length}) and edges (${edges.length}) for case ${targetCaseId}`, null, targetCaseId);

  res.json({ nodes, edges });
};

// Knowledge Graph query endpoints
router.get('/', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001'), handleGraphQuery);
router.get('/network', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001'), handleGraphQuery);

// Shortest Path Solver between two entities
router.get('/shortest-path', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const { startId, endId, caseId } = req.query;
  const targetCaseId = caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';

  if (!startId || !endId) {
    return res.status(400).json({ error: 'startId and endId are required' });
  }

  const assertionsRows = await db.query(`SELECT * FROM assertions WHERE case_id = $1`, [targetCaseId]);
  const adj = {};
  assertionsRows.forEach(a => {
    if (!adj[a.subject_entity_id]) adj[a.subject_entity_id] = [];
    if (!adj[a.object_entity_id]) adj[a.object_entity_id] = [];
    adj[a.subject_entity_id].push({ node: a.object_entity_id, relation: a.relation_type, confidence: a.confidence_score });
    adj[a.object_entity_id].push({ node: a.subject_entity_id, relation: a.relation_type, confidence: a.confidence_score });
  });

  const queue = [[startId]];
  const visited = new Set([startId]);
  let path = null;

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currNode = currentPath[currentPath.length - 1];

    if (currNode === endId) {
      path = currentPath;
      break;
    }

    const neighbors = adj[currNode] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.node)) {
        visited.add(neighbor.node);
        queue.push([...currentPath, neighbor.node]);
      }
    }
  }

  res.json({ startId, endId, pathFound: Boolean(path), path: path || [] });
});

module.exports = router;
