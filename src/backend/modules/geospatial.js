const express = require('express');
const router = express.Router();
const db = require('../database');
const ontologyEngine = require('../ontology/engine');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Get bounding box observations (PostGIS ST_MakeEnvelope spatial query via Ontology Core)
router.get('/bbox', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const { minLon, minLat, maxLon, maxLat, case_id } = req.query;
  const targetCaseId = case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';

  const observations = await ontologyEngine.getGeospatialObservations({ targetCaseId, minLon, minLat, maxLon, maxLat }, req.user);
  res.json({ observations });
});

// PostGIS ST_DWithin Co-location Detection Engine via Ontology Core
router.get('/colocation', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const { target_id, radius_meters, case_id } = req.query;
  const targetCaseId = case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const radius = parseFloat(radius_meters) || 500;
  const targetId = target_id || 'SUB-00001';

  const colocated = await ontologyEngine.getColocatedObservations({ targetId, radiusMeters: radius, targetCaseId }, req.user);
  res.json({ targetEntityId: targetId, radiusMeters: radius, colocatedObservations: colocated });
});

// Spatio-Temporal Trajectory Route via Ontology Core
router.get('/trajectory', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const { entity_id, case_id } = req.query;
  const targetCaseId = case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const entId = entity_id || 'SUB-00001';

  const waypoints = await ontologyEngine.getTrajectory({ entityId: entId, targetCaseId }, req.user);
  res.json({ entityId: entId, waypoints });
});

module.exports = router;

