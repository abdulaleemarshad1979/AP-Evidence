const express = require('express');
const router = express.Router();
const db = require('../database');
const { getContextUser } = require('../middleware/abac');

// Search subjects / entities
router.get('/search', (req, res) => {
  const user = getContextUser(req);
  const { query, type } = req.query;
  const entities = db.getEntities({ search: query, type });
  db.logAudit(user.id, user.name, 'SEARCH', 'Subject 360', `Searched synthetic entities with query: '${query || ''}'`);
  res.json({ entities });
});

// Get Subject 360 unified profile
router.get('/:id', (req, res) => {
  const user = getContextUser(req);
  const subjectId = req.params.id;
  const subject = db.getEntityById(subjectId);
  if (!subject) {
    return res.status(404).json({ error: 'Subject target entity not found' });
  }

  // Linked assertions
  const rels = db.relationships.filter(r => r.source === subjectId || r.target === subjectId);
  const linkedIds = new Set();
  rels.forEach(r => linkedIds.add(r.source === subjectId ? r.target : r.source));

  const linkedEntities = db.getEntities().filter(e => linkedIds.has(e.id));
  const subjectEvents = db.events.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(subjectId))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const linkedEvidence = db.evidence.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(subjectId));
  const linkedCases = db.getCases().filter(c => c.targetEntityIds && c.targetEntityIds.includes(subjectId));
  const resolutions = db.resolutionCandidates.filter(rc => rc.entityA === subjectId || rc.entityB === subjectId);

  db.logAudit(user.id, user.name, 'READ', 'Subject 360', `Loaded 360 synthetic profile for ${subject.name} (${subject.id})`, subject.id);

  res.json({
    subject,
    relationships: rels,
    linkedEntities,
    events: subjectEvents,
    evidence: linkedEvidence,
    cases: linkedCases,
    resolutions
  });
});

module.exports = router;
