const express = require('express');
const router = express.Router();
const db = require('../database');
const ontologyEngine = require('../ontology/engine');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// GET List of Dossiers per Case
router.get('/reports', authenticateMiddleware, async (req, res) => {
  try {
    const caseId = req.query.caseId || req.headers['x-case-id'];
    const reports = await db.getDossiers(caseId);
    res.json({
      success: true,
      count: reports.length,
      dossiers: reports.map(d => ({
        id: d.id,
        caseId: d.case_id,
        title: d.title,
        summary: d.summary,
        status: d.status,
        authorId: d.author_id,
        authorName: d.author_name,
        linkedObjectRefs: typeof d.linked_object_refs === 'string' ? JSON.parse(d.linked_object_refs) : d.linked_object_refs,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dossiers', message: err.message });
  }
});

// GET Single Dossier by ID with Dynamic Live Linked Object Resolution
router.get('/reports/:id', authenticateMiddleware, async (req, res) => {
  try {
    const report = await db.getDossierById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: `Dossier report '${req.params.id}' not found` });
    }

    const sections = typeof report.sections_json === 'string' ? JSON.parse(report.sections_json) : report.sections_json;
    const linkedRefs = typeof report.linked_object_refs === 'string' ? JSON.parse(report.linked_object_refs) : report.linked_object_refs;

    // Dynamically resolve live linked object data directly from Ontology Engine
    const resolvedObjects = {};
    if (Array.isArray(linkedRefs)) {
      for (const ref of linkedRefs) {
        const objId = typeof ref === 'string' ? ref : (ref.id || ref.primaryKey);
        if (objId) {
          const liveObj = await ontologyEngine.getObjectById(objId, req.user);
          if (liveObj) {
            resolvedObjects[objId] = liveObj;
          }
        }
      }
    }

    res.json({
      success: true,
      dossier: {
        id: report.id,
        caseId: report.case_id,
        title: report.title,
        summary: report.summary,
        status: report.status,
        sections,
        linkedObjectRefs: linkedRefs,
        resolvedObjects, // Live resolved Ontology objects
        authorId: report.author_id,
        authorName: report.author_name,
        createdAt: report.created_at,
        updatedAt: report.updated_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dossier report', message: err.message });
  }
});

// POST Create or Update Dossier
router.post('/reports', authenticateMiddleware, abacMiddleware('ANALYTICAL_EXECUTION', req => req.body.caseId), async (req, res) => {
  try {
    const { id, caseId, title, summary, sections, linkedObjectRefs, status } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const saved = await db.saveDossier({
      id,
      caseId: caseId || req.headers['x-case-id'] || 'CASE-AP-2026-0001',
      title,
      summary,
      sections: sections || [],
      linkedObjectRefs: linkedObjectRefs || [],
      status: status || 'DRAFT',
      authorId: req.user.id,
      authorName: req.user.username
    });

    await db.logAudit(req.user.id, req.user.username, 'SAVE_DOSSIER_REPORT', 'DOSSIER_LIVING_REPORTS', `Saved dossier ${title}`, saved.id, saved.case_id);

    res.status(201).json({
      success: true,
      dossier: {
        id: saved.id,
        caseId: saved.case_id,
        title: saved.title,
        status: saved.status,
        updatedAt: saved.updated_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save dossier', message: err.message });
  }
});

module.exports = router;
