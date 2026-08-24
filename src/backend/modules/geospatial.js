const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Get bounding box observations (PostGIS ST_MakeEnvelope spatial query)
router.get('/bbox', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const { minLon, minLat, maxLon, maxLat, case_id } = req.query;
  const targetCaseId = case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';

  let observations;
  if (!db.isPgMem && minLon && minLat && maxLon && maxLat) {
    observations = await db.query(
      `SELECT * FROM observations 
       WHERE case_id = $1 AND location_geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
       ORDER BY timestamp DESC`,
      [targetCaseId, parseFloat(minLon), parseFloat(minLat), parseFloat(maxLon), parseFloat(maxLat)]
    );
  } else {
    observations = await db.query(
      `SELECT * FROM observations WHERE case_id = $1 ORDER BY timestamp DESC`,
      [targetCaseId]
    );
  }

  res.json({ observations });
});

// PostGIS ST_DWithin Co-location Detection Engine
router.get('/colocation', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const { target_id, radius_meters, case_id } = req.query;
  const targetCaseId = case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const radius = parseFloat(radius_meters) || 500;

  const targetObs = await db.query(`SELECT * FROM observations WHERE entity_id = $1 AND case_id = $2`, [target_id || 'SUB-00001', targetCaseId]);

  let colocated;
  if (!db.isPgMem && targetObs.length > 0) {
    colocated = await db.query(
      `SELECT DISTINCT o2.* 
       FROM observations o1
       JOIN observations o2 ON o1.entity_id != o2.entity_id AND o1.case_id = o2.case_id
       WHERE o1.entity_id = $1 AND o1.case_id = $2
         AND ST_DWithin(o1.location_geom, o2.location_geom, $3)`,
      [target_id || 'SUB-00001', targetCaseId, radius]
    );
  } else {
    colocated = await db.query(`SELECT * FROM observations WHERE case_id = $1 AND entity_id != $2`, [targetCaseId, target_id || 'SUB-00001']);
  }

  res.json({ targetEntityId: target_id || 'SUB-00001', radiusMeters: radius, colocatedObservations: colocated });
});

// Spatio-Temporal Trajectory Route
router.get('/trajectory', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const { entity_id, case_id } = req.query;
  const targetCaseId = case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const entId = entity_id || 'SUB-00001';

  const waypoints = await db.query(
    `SELECT id, timestamp, location_name, latitude, longitude, confidence_score 
     FROM observations 
     WHERE entity_id = $1 AND case_id = $2 
     ORDER BY timestamp ASC`,
    [entId, targetCaseId]
  );

  res.json({ entityId: entId, waypoints });
});

module.exports = router;
