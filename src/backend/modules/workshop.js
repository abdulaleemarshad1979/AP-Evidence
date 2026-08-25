const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Save Workshop Dashboard Layout
router.post('/dashboards', authenticateMiddleware, abacMiddleware('READ', req => req.body.caseId || 'CASE-AP-2026-0001'), async (req, res) => {
  try {
    const { title, description, caseId = 'CASE-AP-2026-0001', layoutConfig = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = `WASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.execute(
      `INSERT INTO workshop_dashboards (id, title, description, case_id, layout_config, owner_id, owner_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, title, description || '', caseId, JSON.stringify(layoutConfig), req.user.id, req.user.name || req.user.username]
    );

    await db.logAudit(req.user.id, req.user.username, 'CREATE_WORKSHOP_DASHBOARD', 'WORKSHOP_BUILDER', `Created workshop dashboard ${title}`, id, caseId);

    res.status(201).json({ success: true, id, title });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save workshop dashboard', message: err.message });
  }
});

// GET Workshop Dashboards
router.get('/dashboards', authenticateMiddleware, async (req, res) => {
  try {
    const caseId = req.query.caseId;
    let sql = `SELECT * FROM workshop_dashboards WHERE 1=1`;
    const params = [];
    if (caseId) {
      params.push(caseId);
      sql += ` AND case_id = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC`;
    const rows = await db.query(sql, params);

    res.json({
      dashboards: rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        caseId: r.case_id,
        layoutConfig: r.layout_config ? JSON.parse(r.layout_config) : [],
        ownerId: r.owner_id,
        ownerName: r.owner_name,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workshop dashboards', message: err.message });
  }
});

module.exports = router;
