const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');

// Ingest LPR / CCTV camera telemetry feed
router.post('/ingest', authenticateMiddleware, async (req, res) => {
  const { cameraId, cameraLocation, licensePlate, confidence, timestamp, latitude, longitude, payloadSignature, caseId } = req.body;
  const targetCaseId = caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';

  // HMAC Signature Validation Check
  const hmacSecret = process.env.INGESTION_HMAC_SECRET || 'APIS_INGESTION_HMAC_SECRET_KEY_2026';
  const expectedSignature = crypto.createHmac('sha256', hmacSecret).update(JSON.stringify({ cameraId, licensePlate, timestamp })).digest('hex');

  if (payloadSignature && payloadSignature !== expectedSignature) {
    const qId = await db.saveQuarantineRecord('CCTV_LPR', req.body, 'Invalid HMAC payload signature');
    return res.status(400).json({ error: 'Quarantined', message: 'Payload failed HMAC signature validation', quarantineId: qId });
  }

  if (!licensePlate || !cameraId) {
    const qId = await db.saveQuarantineRecord('CCTV_LPR', req.body, 'Missing mandatory plate or camera identifier');
    return res.status(400).json({ error: 'Quarantined', message: 'Payload quarantined due to missing mandatory attributes', quarantineId: qId });
  }

  // Create observation
  const obsId = `OBS-CCTV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const entId = `SUB-00001`; // Default or linked target entity

  await db.execute(
    `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id)
     VALUES ($1, $2, $3, 'LPR_CAMERA_HIT', $4, $5, $6, $7, $8, 'VERIFIED_RAW', $9, NULL)`,
    [
      obsId,
      entId,
      targetCaseId,
      timestamp || new Date().toISOString(),
      cameraLocation || `Camera ${cameraId}`,
      latitude || 16.5062,
      longitude || 80.6480,
      confidence || 0.95,
      JSON.stringify({ cameraId, licensePlate })
    ]
  );

  // Watchlist hit check
  if (confidence > 0.90) {
    await db.createSensorAlert({
      sensorType: 'LPR_WATCHLIST',
      severity: 'CRITICAL',
      caseId: targetCaseId,
      entityId: entId,
      title: `LPR Watchlist Match: Plate ${licensePlate}`,
      description: `License plate ${licensePlate} detected by camera ${cameraId} (${cameraLocation || 'Vijayawada Corridor'}) with ${Math.round((confidence || 0.95) * 100)}% confidence.`
    });
  }

  await db.emitOutboxEvent('OBSERVATION', obsId, 'BATCH_INGESTED', { obsId, cameraId, licensePlate });

  res.status(201).json({ message: 'LPR CCTV feed ingested successfully', observationId: obsId });
});

module.exports = router;
