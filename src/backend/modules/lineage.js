const express = require('express');
const router = express.Router();
const lineageEngine = require('../ontology/lineage');
const { authenticateMiddleware } = require('../middleware/auth');

// GET Lineage graph for an entity or artifact
router.get('/:targetRef', authenticateMiddleware, async (req, res) => {
  try {
    const { targetRef } = req.params;
    const graph = await lineageEngine.traceLineage(targetRef);
    res.json({
      success: true,
      graph
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trace lineage graph', message: err.message });
  }
});

module.exports = router;
