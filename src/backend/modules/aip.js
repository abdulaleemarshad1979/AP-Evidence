const express = require('express');
const router = express.Router();
const aipEngine = require('../ontology/aip');
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

module.exports = router;
