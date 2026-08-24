const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// List real-time sensor alerts
router.get('/', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const caseId = req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const alerts = await db.getSensorAlerts(caseId);
  res.json({ alerts });
});

// Acknowledge alert
router.post('/acknowledge', authenticateMiddleware, async (req, res) => {
  const { alertId } = req.body;
  if (!alertId) {
    return res.status(400).json({ error: 'alertId is required' });
  }

  await db.acknowledgeSensorAlert(alertId, req.user.name);
  await db.logAudit(req.user.id, req.user.name, 'ACKNOWLEDGE_ALERT', 'Sensor Alerts', `Acknowledged sensor alert ${alertId}`, null, null);
  res.json({ message: `Alert ${alertId} acknowledged by ${req.user.name}` });
});

module.exports = router;
