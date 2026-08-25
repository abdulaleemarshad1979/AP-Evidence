const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Sandboxed Parameterized Analytical Query Execution
router.post('/query', authenticateMiddleware, abacMiddleware('READ', req => req.body.caseId || 'CASE-AP-2026-0001'), async (req, res) => {
  try {
    const { caseId = 'CASE-AP-2026-0001', targetDataset = 'observations', filterField, filterValue, limit = 50 } = req.body;

    const allowedTables = {
      observations: 'observations',
      entities: 'entities',
      assertions: 'assertions',
      evidence: 'evidence_metadata',
      cases: 'cases'
    };

    const tableName = allowedTables[targetDataset];
    if (!tableName) {
      return res.status(400).json({ error: `Invalid target dataset. Must be one of: ${Object.keys(allowedTables).join(', ')}` });
    }

    let sql = `SELECT * FROM ${tableName}`;
    const params = [];

    if (tableName === 'observations' || tableName === 'assertions' || tableName === 'evidence_metadata') {
      params.push(caseId);
      sql += ` WHERE case_id = $${params.length}`;
    } else {
      sql += ` WHERE 1=1`;
    }

    if (filterField && filterValue) {
      // Whitelist filter fields to prevent column injection
      const safeField = filterField.replace(/[^a-zA-Z0-9_]/g, '');
      params.push(`%${filterValue}%`);
      sql += ` AND LOWER(${safeField}::text) LIKE LOWER($${params.length})`;
    }

    params.push(parseInt(limit, 10) || 50);
    sql += ` LIMIT $${params.length}`;

    const results = await db.query(sql, params);

    await db.logAudit(req.user.id, req.user.username, 'EXECUTE_WORKBOOK_QUERY', 'CODE_WORKBOOK', `Executed query over dataset ${targetDataset} returning ${results.length} rows`, null, caseId);

    res.json({
      success: true,
      targetDataset,
      caseId,
      resultCount: results.length,
      rows: results
    });
  } catch (err) {
    res.status(500).json({ error: 'Workbook query execution failed', message: err.message });
  }
});

// Save Code Workbook Query Board
router.post('/boards', authenticateMiddleware, abacMiddleware('READ', req => req.body.caseId || 'CASE-AP-2026-0001'), async (req, res) => {
  try {
    const { title, description, caseId = 'CASE-AP-2026-0001', queryConfig = {} } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = `BOARD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.execute(
      `INSERT INTO workbook_boards (id, title, description, case_id, query_config, owner_id, owner_name, is_shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [id, title, description || '', caseId, JSON.stringify(queryConfig), req.user.id, req.user.name || req.user.username]
    );

    await db.logAudit(req.user.id, req.user.username, 'CREATE_WORKBOOK_BOARD', 'CODE_WORKBOOK', `Created workbook board ${title}`, id, caseId);

    res.status(201).json({ success: true, id, title });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save workbook board', message: err.message });
  }
});

// GET Workbook Boards
router.get('/boards', authenticateMiddleware, async (req, res) => {
  try {
    const rows = await db.query(`SELECT * FROM workbook_boards ORDER BY created_at DESC`);
    res.json({
      boards: rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        caseId: r.case_id,
        queryConfig: r.query_config ? JSON.parse(r.query_config) : {},
        ownerId: r.owner_id,
        ownerName: r.owner_name,
        executionCount: r.execution_count,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workbook boards', message: err.message });
  }
});

module.exports = router;
