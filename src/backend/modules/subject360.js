const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Search subjects endpoint
router.get('/search', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const queryStr = String(req.query.query || '').trim().toLowerCase();
  const allEntities = await db.getEntities();

  if (!queryStr) {
    return res.json({ entities: allEntities.slice(0, 10) });
  }

  const matched = allEntities.filter(e => {
    const nameMatch = (e.name || '').toLowerCase().includes(queryStr);
    const idMatch = (e.id || '').toLowerCase().includes(queryStr);
    const aliasMatch = (e.aliases || []).some(a => String(a).toLowerCase().includes(queryStr));
    return nameMatch || idMatch || aliasMatch;
  });

  res.json({ entities: matched });
});

// Get 360-degree timeline view for target entity (Case-scoped ABAC filter)
router.get('/:id', authenticateMiddleware, abacMiddleware('READ', async req => {
  const targetCaseId = req.query.caseId || req.headers['x-case-id'];
  if (targetCaseId) return targetCaseId;
  const obs = await db.queryOne(`SELECT case_id FROM observations WHERE entity_id = $1 LIMIT 1`, [req.params.id]);
  return obs ? obs.case_id : 'CASE-SYN-0001';
}), async (req, res) => {
  const entityId = req.params.id;
  const targetCaseId = req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const entity = await db.getEntityById(entityId);

  if (!entity) {
    return res.status(404).json({ error: 'Subject entity not found' });
  }

  // Handle canonical entity redirect if entity was merged
  if (entity.status === 'MERGED' && entity.canonicalEntityId) {
    const canonical = await db.getEntityById(entity.canonicalEntityId);
    return res.json({
      redirect: true,
      canonicalEntityId: entity.canonicalEntityId,
      message: `Entity ${entityId} was merged into canonical profile ${entity.canonicalEntityId}`,
      entity: canonical
    });
  }

  const observationsRows = await db.query(
    `SELECT * FROM observations WHERE entity_id = $1 AND case_id = $2 ORDER BY timestamp DESC`,
    [entityId, targetCaseId]
  );
  
  const assertionsRows = await db.query(
    `SELECT * FROM assertions WHERE (subject_entity_id = $1 OR object_entity_id = $1) AND case_id = $2 ORDER BY created_at DESC`,
    [entityId, targetCaseId]
  );

  const evidenceRows = await db.getEvidenceList({ caseId: targetCaseId });
  const linkedEvidence = evidenceRows.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId));

  const allEntities = await db.getEntities();
  const entityMap = new Map(allEntities.map(e => [e.id, e]));

  const timeline = observationsRows.map(o => ({
    id: o.id,
    eventType: o.observation_type,
    timestamp: o.timestamp,
    locationName: o.location_name,
    latitude: o.latitude,
    longitude: o.longitude,
    confidence: o.confidence_score,
    evidenceStatus: o.evidence_status,
    caseId: o.case_id,
    rawData: o.raw_data ? JSON.parse(o.raw_data) : {},
    evidenceRef: o.evidence_id
  }));

  const relationships = assertionsRows.map(a => ({
    id: a.id,
    source: a.subject_entity_id,
    target: a.object_entity_id,
    caseId: a.case_id,
    type: a.relation_type,
    confidence: a.confidence_score,
    confidenceMethod: a.confidence_method,
    assertionClass: a.assertion_class,
    evidenceRef: a.evidence_id
  }));

  const linkedEntityIds = new Set();
  relationships.forEach(rel => {
    if (rel.source !== entityId) linkedEntityIds.add(rel.source);
    if (rel.target !== entityId) linkedEntityIds.add(rel.target);
  });

  const linkedEntities = Array.from(linkedEntityIds).map(id => entityMap.get(id) || { id, name: id, type: 'Entity' });

  await db.logAudit(req.user.id, req.user.name, 'READ_SUBJECT_360', 'Subject 360', `Retrieved Subject 360 dossier for ${entityId}`, entityId, targetCaseId);

  res.json({
    subject: entity,
    timeline,
    events: timeline,
    relationships,
    linkedEntities,
    evidenceVault: linkedEvidence
  });
});

module.exports = router;
