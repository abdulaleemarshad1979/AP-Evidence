const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// GET List of Quiver Canvases per Case
router.get('/canvases', authenticateMiddleware, async (req, res) => {
  try {
    const caseId = req.query.caseId || req.headers['x-case-id'];
    const canvases = await db.getQuiverCanvases(caseId);
    res.json({
      success: true,
      count: canvases.length,
      canvases: canvases.map(c => ({
        id: c.id,
        caseId: c.case_id,
        title: c.title,
        description: c.description,
        mode: c.mode,
        canvasData: typeof c.canvas_data === 'string' ? JSON.parse(c.canvas_data) : c.canvas_data,
        ownerId: c.owner_id,
        ownerName: c.owner_name,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Quiver canvases', message: err.message });
  }
});

// GET Single Quiver Canvas by ID
router.get('/canvases/:id', authenticateMiddleware, async (req, res) => {
  try {
    const canvas = await db.getQuiverCanvasById(req.params.id);
    if (!canvas) {
      return res.status(404).json({ error: `Quiver canvas '${req.params.id}' not found` });
    }
    res.json({
      success: true,
      canvas: {
        id: canvas.id,
        caseId: canvas.case_id,
        title: canvas.title,
        description: canvas.description,
        mode: canvas.mode,
        canvasData: typeof canvas.canvas_data === 'string' ? JSON.parse(canvas.canvas_data) : canvas.canvas_data,
        ownerId: canvas.owner_id,
        ownerName: canvas.owner_name,
        createdAt: canvas.created_at,
        updatedAt: canvas.updated_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Quiver canvas', message: err.message });
  }
});

// POST Create or Update Quiver Canvas
router.post('/canvases', authenticateMiddleware, abacMiddleware('ANALYTICAL_EXECUTION', req => req.body.caseId), async (req, res) => {
  try {
    const { id, caseId, title, description, canvasData, mode } = req.body;
    if (!title || !canvasData) {
      return res.status(400).json({ error: 'title and canvasData are required' });
    }

    const saved = await db.saveQuiverCanvas({
      id,
      caseId: caseId || req.headers['x-case-id'] || 'CASE-AP-2026-0001',
      title,
      description,
      canvasData,
      mode: mode || 'CANVAS',
      ownerId: req.user.id,
      ownerName: req.user.username
    });

    await db.logAudit(req.user.id, req.user.username, 'SAVE_QUIVER_CANVAS', 'QUIVER_ANALYSIS', `Saved canvas ${title}`, saved.id, saved.case_id);

    res.status(201).json({
      success: true,
      canvas: {
        id: saved.id,
        caseId: saved.case_id,
        title: saved.title,
        mode: saved.mode,
        canvasData: typeof saved.canvas_data === 'string' ? JSON.parse(saved.canvas_data) : saved.canvas_data,
        updatedAt: saved.updated_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save Quiver canvas', message: err.message });
  }
});

module.exports = router;
