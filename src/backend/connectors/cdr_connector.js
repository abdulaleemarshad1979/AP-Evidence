const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');

// Ingest Call Detail Records (CDR)
router.post('/ingest', authenticateMiddleware, async (req, res) => {
  const { callerPhone, receiverPhone, durationSeconds, cellTowerId, latitude, longitude, timestamp, caseId } = req.body;
  const targetCaseId = caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';

  if (!callerPhone || !receiverPhone) {
    const qId = await db.saveQuarantineRecord('CDR_LOG', req.body, 'Missing caller or receiver phone numbers');
    return res.status(400).json({ error: 'Quarantined', message: 'Payload missing mandatory CDR phone attributes', quarantineId: qId });
  }

  const obsId = `OBS-CDR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const entId = `SUB-00001`;

  await db.execute(
    `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id)
     VALUES ($1, $2, $3, 'CDR_CELL_TOWER_HIT', $4, $5, $6, $7, 0.92, 'VERIFIED_RAW', $8, NULL)`,
    [
      obsId,
      entId,
      targetCaseId,
      timestamp || new Date().toISOString(),
      `Cell Tower ${cellTowerId || 'AP-TWR-808'}`,
      latitude || 16.5070,
      longitude || 80.6490,
      JSON.stringify({ callerPhone, receiverPhone, durationSeconds, cellTowerId })
    ]
  );

  // Trigger alert if duration > 300s
  if (durationSeconds > 300) {
    await db.createSensorAlert({
      sensorType: 'CDR_TRIANGULATION',
      severity: 'HIGH',
      caseId: targetCaseId,
      entityId: entId,
      title: `CDR Corridor Correlation: ${callerPhone} <-> ${receiverPhone}`,
      description: `Extended call duration (${durationSeconds}s) detected on Cell Tower ${cellTowerId || 'AP-TWR-808'}.`
    });
  }

  res.status(201).json({ message: 'CDR record ingested successfully', observationId: obsId });
});

module.exports = router;
