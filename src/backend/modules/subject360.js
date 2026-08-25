const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware, maskSubjectData } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Function to calculate Haversine distance in meters between two lat/lng pairs
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get 360-degree timeline view for target entity (Case-scoped ABAC filter)
router.get('/:id', authenticateMiddleware, abacMiddleware('READ', async req => {
  const targetCaseId = req.query.caseId || req.headers['x-case-id'];
  if (targetCaseId) return targetCaseId;
  const obs = await db.queryOne(`SELECT case_id FROM observations WHERE entity_id = $1 LIMIT 1`, [req.params.id]);
  return obs ? obs.case_id : 'CASE-SYN-0001';
}), async (req, res) => {
  const entityId = req.params.id;
  const targetCaseId = req.query.caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';
  let entity = await db.getEntityById(entityId);

  if (!entity) {
    return res.status(404).json({ error: 'Subject entity not found' });
  }

  // Apply need-to-know data masking based on user session clearance level
  const userClearance = req.user?.clearanceLevel || 2;
  const maskedSubject = maskSubjectData(entity, userClearance);

  // Handle canonical entity redirect if entity was merged
  if (entity.status === 'MERGED' && entity.canonicalEntityId) {
    const canonical = await db.getEntityById(entity.canonicalEntityId);
    return res.json({
      redirect: true,
      canonicalEntityId: entity.canonicalEntityId,
      message: `Entity ${entityId} was merged into canonical profile ${entity.canonicalEntityId}`,
      entity: maskSubjectData(canonical, userClearance)
    });
  }

  const observationsRows = await db.query(
    `SELECT * FROM observations WHERE entity_id = $1 AND case_id = $2 ORDER BY timestamp ASC`,
    [entityId, targetCaseId]
  );
  
  const assertionsRows = await db.query(
    `SELECT * FROM assertions WHERE (subject_entity_id = $1 OR object_entity_id = $1) AND case_id = $2 ORDER BY created_at DESC`,
    [entityId, targetCaseId]
  );

  const evidenceRows = await db.getEvidenceList({ caseId: targetCaseId });
  const linkedEvidence = evidenceRows.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId));

  const allEntities = await db.getEntities();
  const entityMap = new Map(allEntities.map(e => [e.id, maskSubjectData(e, userClearance)]));

  // Compute Movement Speed & Velocity Vector Plausibility
  const timeline = [];
  const anomalies = [];
  const timeDist = {};

  for (let i = 0; i < observationsRows.length; i++) {
    const o = observationsRows[i];
    const raw = o.raw_data ? JSON.parse(o.raw_data) : {};
    const dateObj = new Date(o.timestamp);
    const hourBucket = `${String(dateObj.getUTCHours()).padStart(2, '0')}:00-${String((dateObj.getUTCHours() + 1) % 24).padStart(2, '0')}:00`;
    timeDist[hourBucket] = (timeDist[hourBucket] || 0) + 1;

    let calculatedSpeedKmh = raw.speedKmh || 0;
    let isAnomaly = Boolean(raw.isAnomaly);
    let anomalyReason = raw.anomalyReason || '';

    if (i > 0) {
      const prev = observationsRows[i - 1];
      const distM = haversineDistanceMeters(prev.latitude, prev.longitude, o.latitude, o.longitude);
      const dtSec = (new Date(o.timestamp) - new Date(prev.timestamp)) / 1000;
      if (dtSec > 0) {
        const speedKmh = (distM / 1000) / (dtSec / 3600);
        if (!calculatedSpeedKmh) calculatedSpeedKmh = Math.round(speedKmh);
        if (speedKmh > 180) {
          isAnomaly = true;
          anomalyReason = `UNPlausible Trajectory Speed (${Math.round(speedKmh)} km/h exceeding 180 km/h threshold)`;
        }
      }
    }

    if (isAnomaly) {
      anomalies.push({ eventId: o.id, timestamp: o.timestamp, location: o.location_name, anomalyReason });
    }

    timeline.push({
      id: o.id,
      eventType: o.observation_type,
      timestamp: o.timestamp,
      locationName: o.location_name,
      latitude: o.latitude,
      longitude: o.longitude,
      confidence: o.confidence_score,
      evidenceStatus: o.evidence_status,
      caseId: o.case_id,
      rawData: { ...raw, speedKmh: calculatedSpeedKmh, isAnomaly, anomalyReason },
      evidenceRef: o.evidence_id
    });
  }

  // Sort timeline chronologically descending for display
  const timelineDesc = [...timeline].reverse();

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

  // Compute Co-Locations with other subjects
  const otherObs = await db.query(`SELECT * FROM observations WHERE case_id = $1 AND entity_id != $2`, [targetCaseId, entityId]);
  const coLocations = [];

  for (const obs of observationsRows) {
    const t1 = new Date(obs.timestamp).getTime();
    for (const other of otherObs) {
      const t2 = new Date(other.timestamp).getTime();
      const dtMinutes = Math.abs(t1 - t2) / (1000 * 60);
      if (dtMinutes <= 5) {
        const distM = haversineDistanceMeters(obs.latitude, obs.longitude, other.latitude, other.longitude);
        if (distM <= 50) {
          coLocations.push({
            locationId: obs.location_name,
            locationName: obs.location_name,
            coordinates: [obs.latitude, obs.longitude],
            subjects: [entityId, other.entity_id],
            timestamp: obs.timestamp,
            distanceMeters: Math.round(distM),
            timeDiffMinutes: Math.round(dtMinutes * 10) / 10
          });
        }
      }
    }
  }

  await db.logAudit(req.user.id, req.user.name, 'READ_SUBJECT_360', 'Subject 360', `Retrieved Subject 360 dossier for ${entityId} (Clearance Level ${userClearance})`, entityId, targetCaseId);

  res.json({
    subject: maskedSubject,
    timeline: timelineDesc,
    events: timelineDesc,
    relationships,
    linkedEntities,
    evidenceVault: linkedEvidence,
    anomalies,
    coLocations,
    baselineRoutine: {
      timeDistribution: timeDist
    }
  });
});

module.exports = router;
