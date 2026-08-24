const express = require('express');
const router = express.Router();
const db = require('../database');

// Get spatio-temporal event trajectory
router.get('/trajectory', (req, res) => {
  const { entityId, caseId, startTime, endTime } = req.query;

  let events = db.events;

  if (entityId) {
    events = events.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId));
  }

  // Sort events chronologically
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Locations / cameras
  const locations = db.entities.filter(e => e.type === 'Location');

  db.logAudit('USR-101', 'Dr. Sarah Vance', 'QUERY_GEOSPATIAL_TRAJECTORY', 'Geospatial Scrubber', `Queried spatio-temporal trajectory (Target: ${entityId || 'ALL'}, Events returned: ${events.length})`);

  res.json({
    events,
    locations,
    trajectoryPoints: events.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      lat: e.latitude,
      lng: e.longitude,
      locationName: e.locationName,
      eventType: e.eventType,
      description: e.description,
      associatedEntityIds: e.associatedEntityIds,
      confidence: e.confidence
    }))
  });
});

module.exports = router;
