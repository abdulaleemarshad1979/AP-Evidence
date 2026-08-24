const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');

// Ingest GPS continuous device telemetry
router.post('/ingest', authenticateMiddleware, async (req, res) => {
  const { deviceId, entityId, latitude, longitude, speed, timestamp, caseId } = req.body;
  const targetCaseId = caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';

  if (!deviceId || latitude === undefined || longitude === undefined) {
    const qId = await db.saveQuarantineRecord('GPS_TELEMETRY', req.body, 'Missing deviceId or spatial coordinates');
    return res.status(400).json({ error: 'Quarantined', message: 'Payload missing spatial coordinates', quarantineId: qId });
  }

  const obsId = `OBS-GPS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const entId = entityId || 'SUB-00001';

  await db.execute(
    `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id)
     VALUES ($1, $2, $3, 'GPS_DEVICE_TELEMETRY', $4, $5, $6, $7, 0.98, 'VERIFIED_RAW', $8, NULL)`,
    [
      obsId,
      entId,
      targetCaseId,
      timestamp || new Date().toISOString(),
      `GPS Device ${deviceId}`,
      latitude,
      longitude,
      JSON.stringify({ deviceId, speed })
    ]
  );

  res.status(201).json({ message: 'GPS Telemetry ingested successfully', observationId: obsId });
});

module.exports = router;
