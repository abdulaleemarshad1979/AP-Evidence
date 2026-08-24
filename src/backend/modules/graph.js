const express = require('express');
const router = express.Router();
const db = require('../database');

// Get Knowledge Graph network
router.get('/network', (req, res) => {
  const { centerId, depth, caseId } = req.query;
  const network = db.getGraphNetwork(centerId, parseInt(depth) || 2, caseId);

  db.logAudit('USR-101', 'Dr. Sarah Vance', 'QUERY_GRAPH_NETWORK', 'Knowledge Graph Engine', `Queried knowledge graph network (Center: ${centerId || 'ALL'}, Depth: ${depth || 2})`);

  res.json(network);
});

// Expand node connections
router.get('/expand/:nodeId', (req, res) => {
  const nodeId = req.params.nodeId;
  const connectedRels = db.relationships.filter(r => r.source === nodeId || r.target === nodeId);
  
  const connectedNodeIds = new Set();
  connectedRels.forEach(r => {
    connectedNodeIds.add(r.source === nodeId ? r.target : r.source);
  });

  const connectedNodes = db.entities.filter(e => connectedNodeIds.has(e.id));

  res.json({
    nodeId,
    connectedNodes,
    relationships: connectedRels
  });
});

module.exports = router;
