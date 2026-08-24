const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Spatio-Temporal tracks & Leaflet map scrubber data (Case-scoped ABAC, PostGIS geometry)
router.get('/tracks', authenticateMiddleware, abacMiddleware('READ', async req => req.query.caseId || 'CASE-SYN-0001'), async (req, res) => {
  const { caseId, entityId, startDate, endDate } = req.query;
  const targetCaseId = caseId || 'CASE-SYN-0001';

  let sql = `SELECT id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id FROM observations WHERE case_id = $1`;
  const params = [targetCaseId];

  if (entityId) {
    params.push(entityId);
    sql += ` AND entity_id = $${params.length}`;
  }
  if (startDate) {
    params.push(startDate);
    sql += ` AND timestamp >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    sql += ` AND timestamp <= $${params.length}`;
  }

  sql += ` ORDER BY timestamp ASC`;

  const rows = await db.query(sql, params);
  const tracks = rows.map(o => ({
    id: o.id,
    entityId: o.entity_id,
    caseId: o.case_id,
    eventType: o.observation_type,
    timestamp: o.timestamp,
    locationName: o.location_name,
    latitude: o.latitude,
    longitude: o.longitude,
    confidence: o.confidence_score,
    evidenceStatus: o.evidence_status,
    evidenceRef: o.evidence_id,
    rawData: o.raw_data ? JSON.parse(o.raw_data) : {}
  }));

  await db.logAudit(req.user.id, req.user.name, 'QUERY_SPATIO_TEMPORAL', 'Geo Engine', `Queried ${tracks.length} spatio-temporal trajectory nodes for case ${targetCaseId}`, entityId || null, targetCaseId);

  res.json({ tracks });
});

module.exports = router;
