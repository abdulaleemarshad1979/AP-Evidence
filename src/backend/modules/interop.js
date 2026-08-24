const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Export Case Data as NIEM JSON
router.get('/export/niem', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const caseId = req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const caseObj = await db.getCaseById(caseId);
  const entities = await db.getEntities();
  const observations = await db.query(`SELECT * FROM observations WHERE case_id = $1`, [caseId]);

  const niemPayload = {
    "nc:Document": {
      "nc:DocumentTitle": caseObj?.title || 'APIS Intelligence Export',
      "nc:DocumentIdentification": { "nc:IdentificationID": caseId },
      "nc:DocumentCategoryText": "CRIMINAL_INVESTIGATION_DOSSIER"
    },
    "nc:Case": {
      "nc:CaseTitle": caseObj?.title,
      "nc:CaseNumberText": caseId,
      "nc:CaseSummaryText": caseObj?.description,
      "j:CaseClassification": caseObj?.classification
    },
    "nc:EntityList": entities.map(e => ({
      "nc:PersonIdentification": { "nc:IdentificationID": e.id },
      "nc:PersonName": { "nc:PersonFullName": e.name },
      "nc:PersonAlias": (e.aliases || []).map(a => ({ "nc:AliasName": a }))
    })),
    "nc:ObservationList": observations.map(o => ({
      "nc:ObservationID": o.id,
      "nc:ObservationType": o.observation_type,
      "nc:Location": {
        "nc:LocationName": o.location_name,
        "nc:LocationLatitude": o.latitude,
        "nc:LocationLongitude": o.longitude
      }
    }))
  };

  await db.logAudit(req.user.id, req.user.name, 'EXPORT_NIEM', 'Interop', `Exported NIEM document for case ${caseId}`, null, caseId);
  res.json(niemPayload);
});

// Export Case Data as STIX 2.1 Intelligence Bundle
router.get('/export/stix', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const caseId = req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const entities = await db.getEntities();
  const assertions = await db.query(`SELECT * FROM assertions WHERE case_id = $1`, [caseId]);

  const stixObjects = [];

  // Convert entities to STIX Identities & Cyber Observables
  entities.forEach(e => {
    stixObjects.push({
      type: 'identity',
      spec_version: '2.1',
      id: `identity--${e.id}`,
      name: e.name,
      identity_class: 'individual',
      custom_properties: {
        evidence_status: e.evidenceStatus,
        assertion_class: e.assertionClass
      }
    });
  });

  // Convert assertions to STIX Relationships
  assertions.forEach(a => {
    stixObjects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: `relationship--${a.id}`,
      relationship_type: (a.relation_type || 'associated-with').toLowerCase().replace(/_/g, '-'),
      source_ref: `identity--${a.subject_entity_id}`,
      target_ref: `identity--${a.object_entity_id}`,
      confidence: Math.round(a.confidence_score * 100)
    });
  });

  const stixBundle = {
    type: 'bundle',
    id: `bundle--${caseId}`,
    spec_version: '2.1',
    objects: stixObjects
  };

  await db.logAudit(req.user.id, req.user.name, 'EXPORT_STIX', 'Interop', `Exported STIX 2.1 threat graph bundle for case ${caseId}`, null, caseId);
  res.json(stixBundle);
});

// Export Spatio-Temporal Observations as GeoJSON FeatureCollection
router.get('/export/geojson', authenticateMiddleware, abacMiddleware('READ', async req => req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001'), async (req, res) => {
  const caseId = req.query.case_id || req.headers['x-case-id'] || 'CASE-SYN-0001';
  const observations = await db.query(`SELECT * FROM observations WHERE case_id = $1`, [caseId]);

  const features = observations.map(o => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [o.longitude || 80.6480, o.latitude || 16.5062]
    },
    properties: {
      id: o.id,
      entityId: o.entity_id,
      observationType: o.observation_type,
      timestamp: o.timestamp,
      locationName: o.location_name,
      confidenceScore: o.confidence_score,
      evidenceStatus: o.evidence_status
    }
  }));

  const geoJson = {
    type: 'FeatureCollection',
    caseId,
    features
  };

  await db.logAudit(req.user.id, req.user.name, 'EXPORT_GEOJSON', 'Interop', `Exported GeoJSON FeatureCollection for case ${caseId}`, null, caseId);
  res.json(geoJson);
});

// Import STIX 2.1 Bundle
router.post('/import/stix', authenticateMiddleware, async (req, res) => {
  const { bundle, caseId } = req.body;
  const targetCaseId = caseId || req.headers['x-case-id'] || 'CASE-SYN-0001';

  if (!bundle || bundle.type !== 'bundle' || !Array.isArray(bundle.objects)) {
    return res.status(400).json({ error: 'Invalid STIX bundle payload' });
  }

  let importedCount = 0;
  for (const obj of bundle.objects) {
    if (obj.type === 'identity') {
      const entId = obj.id.replace('identity--', '');
      await db.execute(
        `INSERT INTO entities (id, type, name, aliases, identifier_fields, evidence_status, assertion_class, confidence_method, is_fictional)
         VALUES ($1, 'Person', $2, '[]', '{}', 'VERIFIED_RAW', 'CONFIRMED_FACT', 'IMPORTED_STIX', TRUE)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [entId, obj.name]
      );
      importedCount++;
    }
  }

  await db.logAudit(req.user.id, req.user.name, 'IMPORT_STIX', 'Interop', `Imported ${importedCount} STIX identities into case ${targetCaseId}`, null, targetCaseId);
  res.json({ message: `Successfully imported ${importedCount} STIX objects`, importedCount });
});

module.exports = router;
