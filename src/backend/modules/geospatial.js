const express = require('express');
const router = express.Router();
const db = require('../database');
const { getContextUser, abacMiddleware } = require('../middleware/abac');

// Get spatio-temporal event trajectory (ABAC Protected)
router.get('/trajectory', abacMiddleware('READ', req => req.query.caseId || 'CASE-SYN-0001'), (req, res) => {
  const user = req.user || getContextUser(req);
  const { entityId, caseId } = req.query;

  let events = db.events;

  if (entityId) {
    events = events.filter(ev => ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId));
  }

  if (caseId) {
    events = events.filter(ev => ev.caseId === caseId);
  }

  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const locations = db.getEntities({ type: 'Location' });
  db.logAudit(user.id, user.name, 'SEARCH', 'Geospatial Scrubber', `Queried spatio-temporal trajectory (Target: ${entityId || 'ALL'}, Case: ${caseId || 'ALL'})`, entityId, caseId);

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
