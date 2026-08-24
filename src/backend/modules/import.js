const express = require('express');
const router = express.Router();
const db = require('../database');
const crypto = require('crypto');

// Ingestion status & list of recent imports
router.get('/history', (req, res) => {
  res.json({ imports: db.imports });
});

// Ingest structured raw data payload
router.post('/ingest', (req, res) => {
  const { sourceFeed, feedType, classification, records } = req.body;

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Payload must contain a "records" array' });
  }

  const importBatchId = `IMP-${Date.now()}`;
  let ingestedEvents = 0;
  let newEntitiesCreated = 0;

  records.forEach((rec, idx) => {
    // Generate evidence record for raw payload item
    const rawPayloadStr = JSON.stringify(rec);
    const sha256 = crypto.createHash('sha256').update(rawPayloadStr).digest('hex');
    const evId = `EVD-RAW-${Date.now()}-${idx}`;

    db.evidence.push({
      id: evId,
      title: `Raw ${feedType || 'FEED'} Telemetry Packet (${sourceFeed || 'Generic'})`,
      mediaType: 'JSON_PAYLOAD',
      fileSize: `${rawPayloadStr.length} bytes`,
      sha256,
      classification: classification || 'SECRET',
      custodian: 'Automated Ingestion Engine',
      sourceDevice: sourceFeed || 'External Data Feed',
      associatedEntityIds: [],
      chainOfCustody: [
        { timestamp: new Date().toISOString(), user: 'Ingestion Engine', action: 'INGESTED_AND_HASHED', notes: 'Raw payload packet processed' }
      ]
    });

    // Create Event
    const eventId = `EVT-IMP-${Date.now()}-${idx}`;
    const eventObj = {
      id: eventId,
      eventType: rec.eventType || feedType || 'TELEMETRY_SIGNAL',
      timestamp: rec.timestamp || new Date().toISOString(),
      locationName: rec.locationName || 'Ingested Coordinate Node',
      latitude: parseFloat(rec.latitude) || 51.5074,
      longitude: parseFloat(rec.longitude) || -0.1478,
      confidence: parseFloat(rec.confidence) || 0.90,
      associatedEntityIds: rec.associatedEntityIds || [],
      description: rec.description || `Ingested raw event from feed: ${sourceFeed}`,
      evidenceRef: evId
    };

    db.events.push(eventObj);
    ingestedEvents++;
  });

  const importSummary = {
    batchId: importBatchId,
    sourceFeed: sourceFeed || 'Manual JSON Upload',
    feedType: feedType || 'MULTI_SOURCE',
    ingestedEvents,
    newEntitiesCreated,
    timestamp: new Date().toISOString(),
    status: 'COMPLETED'
  };

  db.imports.push(importSummary);
  db.logAudit('USR-101', 'Dr. Sarah Vance', 'INGEST_DATA', 'Data Import Portal', `Ingested ${ingestedEvents} raw records in batch ${importBatchId}`);

  res.status(201).json({
    message: 'Data batch ingested successfully',
    summary: importSummary
  });
});

module.exports = router;
