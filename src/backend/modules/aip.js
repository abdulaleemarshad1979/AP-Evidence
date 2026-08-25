const express = require('express');
const router = express.Router();
const aipEngine = require('../ontology/aip');
const ontologyEngine = require('../ontology/engine');
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');

// GET Available AIP Tools
router.get('/tools', authenticateMiddleware, (req, res) => {
  res.json({
    success: true,
    tools: aipEngine.tools
  });
});

// POST Query Natural Language AIP Assistant
router.post('/query', authenticateMiddleware, async (req, res) => {
  try {
    const { prompt, caseId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }
    const response = await aipEngine.processPrompt(prompt, caseId, req.user);
    res.json({
      success: true,
      response
    });
  } catch (err) {
    res.status(500).json({ error: 'AIP processing failed', message: err.message });
  }
});

// GET Pending AIP Runs Queue
router.get('/runs', authenticateMiddleware, async (req, res) => {
  try {
    const caseId = req.query.caseId || req.headers['x-case-id'];
    const runs = await db.getAIRuns(caseId);
    res.json({ success: true, count: runs.length, runs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AIP runs', message: err.message });
  }
});

// PUT / POST Review AIP Proposed Governed Action (PENDING_REVIEW -> APPROVED / REJECTED)
const handleRunReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, action, notes } = req.body;
    const decision = (status || action || '').toUpperCase();

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED.' });
    }

    const run = await db.queryOne(`SELECT * FROM ai_runs WHERE id = $1`, [id]);
    if (!run) {
      return res.status(404).json({ error: `AIP Run '${id}' not found.` });
    }

    if (run.review_status !== 'PENDING_REVIEW') {
      return res.status(400).json({ error: `AIP Run '${id}' has already been reviewed (Status: ${run.review_status}).` });
    }

    if (decision === 'APPROVED') {
      const params = typeof run.input_params === 'string' ? JSON.parse(run.input_params) : (run.input_params || {});
      const { actionType, input } = params;

      if (!actionType || !input) {
        return res.status(400).json({ error: 'Run does not contain a valid proposed action or input parameters.' });
      }

      // Execute proposed action through Ontology Engine under human user identity
      const actionResult = await ontologyEngine.executeAction(actionType, input, req.user);

      // Update AI Run state
      await db.updateAIRunStatus(id, 'APPROVED', req.user.username, notes || 'Action approved and executed by investigator.');

      // Cryptographic Audit Logging
      await db.logAudit(
        req.user.id,
        req.user.username,
        `APPROVE_AIP_ACTION_${actionType}`,
        'AIP_REVIEW',
        `Human approved and executed AIP proposed action ${actionType}`,
        run.id,
        run.case_id
      );

      return res.json({
        success: true,
        status: 'APPROVED',
        runId: id,
        executedAction: actionType,
        actionResult
      });
    } else {
      // REJECTED
      await db.updateAIRunStatus(id, 'REJECTED', req.user.username, notes || 'Action rejected by investigator.');

      await db.logAudit(
        req.user.id,
        req.user.username,
        `REJECT_AIP_ACTION`,
        'AIP_REVIEW',
        `Human rejected AIP proposed action for run ${id}`,
        run.id,
        run.case_id
      );

      return res.json({
        success: true,
        status: 'REJECTED',
        runId: id,
        message: `Proposed action for run '${id}' was rejected.`
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Review transition failed', message: err.message });
  }
};

router.put('/runs/:id/review', authenticateMiddleware, handleRunReview);
router.post('/runs/:id/review', authenticateMiddleware, handleRunReview);

module.exports = router;

