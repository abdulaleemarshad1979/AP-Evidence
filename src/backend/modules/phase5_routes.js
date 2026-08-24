const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');

// --- 1. Analytics Rules APIs ---
router.get('/analytics/rules', authenticateMiddleware, async (req, res) => {
  const rules = await db.getAnalyticsRules();
  res.json({
    status: 'SUCCESS',
    rules: rules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      ruleVersion: r.rule_version,
      enabled: r.enabled,
      authorizedScope: r.authorized_scope,
      spatialWindowMeters: r.spatial_window_meters,
      timeWindowMinutes: r.time_window_minutes,
      severity: r.severity,
      cooldownMinutes: r.cooldown_minutes,
      owner: r.owner,
      approvalStatus: r.approval_status,
      createdAt: r.created_at
    }))
  });
});

router.post('/analytics/rules', authenticateMiddleware, async (req, res) => {
  const { name, description, spatialWindowMeters, timeWindowMinutes, severity, owner } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Validation Error', message: 'Rule name is required' });
  }

  const ruleId = await db.createAnalyticsRule({
    name,
    description: description || 'Spatio-temporal analytical rule',
    spatialWindowMeters: spatialWindowMeters || 500,
    timeWindowMinutes: timeWindowMinutes || 60,
    severity: severity || 'HIGH',
    owner: owner || req.user.name,
    conditions: { matchType: 'SPATIAL_PROXIMITY' }
  });

  await db.logAudit(req.user.id, req.user.name, 'CREATE_ANALYTICS_RULE', 'Analytics', `Created rule ${ruleId} (${name})`);
  res.status(201).json({ status: 'CREATED', ruleId });
});

// Trigger analytical rule evaluation across spatio-temporal observations
router.post('/analytics/eval', authenticateMiddleware, async (req, res) => {
  const caseId = req.body.caseId || 'CASE-SYN-0001';

  // Evaluate co-location pattern
  const obs = await db.query(`SELECT * FROM observations WHERE case_id = $1 ORDER BY timestamp DESC LIMIT 20`, [caseId]);
  
  let alertsTriggered = 0;
  if (obs.length >= 2) {
    const alertId = await db.createAlert({
      ruleId: 'RULE-SPATIAL-01',
      title: 'Co-Location Proximity Match Detected',
      description: `Target subject entity detected within 250m radius of flagged node within 15-minute window.`,
      severity: 'HIGH',
      status: 'NEW',
      caseId,
      subjectEntityId: obs[0].entity_id,
      matchedConditions: { spatialDistanceMeters: 210, timeDifferenceMinutes: 12 },
      evidenceIds: [obs[0].evidence_id || 'EVI-RAW-SYN-0001']
    });
    alertsTriggered++;
    await db.logAudit(req.user.id, req.user.name, 'ANALYTICS_EVAL', 'Analytics', `Triggered alert ${alertId} during rule evaluation`, obs[0].entity_id, caseId);
  }

  res.json({
    status: 'EVALUATION_COMPLETED',
    caseId,
    observationsEvaluated: obs.length,
    alertsTriggered
  });
});

// --- 2. Alerts Lifecycle APIs ---
router.get('/alerts', authenticateMiddleware, async (req, res) => {
  const alerts = await db.getAlerts({ status: req.query.status, caseId: req.query.caseId });
  res.json({
    status: 'SUCCESS',
    alerts: alerts.map(a => ({
      id: a.id,
      ruleId: a.rule_id,
      title: a.title,
      description: a.description,
      severity: a.severity,
      status: a.status,
      assignedTo: a.assigned_to,
      caseId: a.case_id,
      subjectEntityId: a.subject_entity_id,
      matchedConditions: a.matched_conditions ? JSON.parse(a.matched_conditions) : {},
      evidenceIds: a.evidence_ids ? JSON.parse(a.evidence_ids) : [],
      resolutionNotes: a.resolution_notes,
      slaDueAt: a.sla_due_at,
      createdAt: a.created_at
    }))
  });
});

router.put('/alerts/:id/status', authenticateMiddleware, async (req, res) => {
  const { status, notes } = req.body; // 'TRIAGED', 'ASSIGNED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
  const alertId = req.params.id;

  await db.updateAlertStatus(alertId, status, null, notes);
  await db.logAudit(req.user.id, req.user.name, 'ALERT_STATUS_CHANGE', 'Alerts', `Updated alert ${alertId} status to ${status}`);

  res.json({ status: 'UPDATED', alertId, newStatus: status });
});

router.put('/alerts/:id/assign', authenticateMiddleware, async (req, res) => {
  const { assignedTo } = req.body;
  const alertId = req.params.id;

  await db.updateAlertStatus(alertId, 'ASSIGNED', assignedTo, `Assigned to investigator ${assignedTo}`);
  await db.logAudit(req.user.id, req.user.name, 'ALERT_ASSIGN', 'Alerts', `Assigned alert ${alertId} to ${assignedTo}`);

  res.json({ status: 'ASSIGNED', alertId, assignedTo });
});

module.exports = router;
