const express = require('express');
const router = express.Router();
const db = require('../database');
const ontologyEngine = require('../ontology/engine');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Seed Ontology primitives upon startup
ontologyEngine.ensureSeedOntology().catch(() => {});

// GET Generated Ontology SDK (Schema + Dynamic JS Client)
router.get('/sdk', authenticateMiddleware, async (req, res) => {
  try {
    const objectTypes = await db.query(`SELECT * FROM ontology_object_types ORDER BY api_name ASC`);
    const linkTypes = await db.query(`SELECT * FROM ontology_link_types ORDER BY api_name ASC`);
    const actionTypes = await db.query(`SELECT * FROM ontology_action_types ORDER BY api_name ASC`);
    const functions = await db.query(`SELECT * FROM ontology_functions ORDER BY api_name ASC`);

    const sdkContract = {
      version: '1.0.0-ONTOLOGY-SDK',
      objectTypes: objectTypes.map(r => ({ apiName: r.api_name || r.type_name, displayName: r.display_name || r.display_label, backingTable: r.backing_table_or_view })),
      linkTypes: linkTypes.map(r => ({ apiName: r.api_name || r.link_name, displayName: r.display_name || r.display_label, objectTypeA: r.object_type_a || r.source_type, objectTypeB: r.object_type_b || r.target_type })),
      actionTypes: actionTypes.map(r => ({ apiName: r.api_name, displayName: r.display_name, targetObjectType: r.target_object_type, schema: JSON.parse(r.input_schema || '{}') })),
      functions: functions.map(r => ({ apiName: r.api_name, description: r.description }))
    };

    res.json({
      success: true,
      contract: sdkContract
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate Ontology SDK', message: err.message });
  }
});

// GET Objects by Type Name (Object Set Service)
router.get('/objects/:apiName', authenticateMiddleware, async (req, res) => {
  try {
    const { apiName } = req.params;
    const filter = {
      caseId: req.query.caseId || req.headers['x-case-id'],
      search: req.query.search || req.query.q,
      limit: parseInt(req.query.limit || '100', 10)
    };

    const objects = await ontologyEngine.getObjectsByType(apiName, filter, req.user);
    res.json({ success: true, apiName, count: objects.length, objects });
  } catch (err) {
    res.status(400).json({ error: 'Failed to fetch object set', message: err.message });
  }
});

// GET Linked Objects by Link Type Name
router.get('/objects/:apiName/:id/links/:linkType', authenticateMiddleware, async (req, res) => {
  try {
    const { apiName, id, linkType } = req.params;
    const linked = await ontologyEngine.getLinkedObjects(apiName, id, linkType, req.user);
    res.json({ success: true, sourceObjectType: apiName, sourceId: id, linkType, count: linked.length, linkedObjects: linked });
  } catch (err) {
    res.status(400).json({ error: 'Failed to traverse link type', message: err.message });
  }
});

// POST Search Objects Across Ontology
router.post('/search', authenticateMiddleware, async (req, res) => {
  try {
    const { query, targetTypes } = req.body;
    const results = await ontologyEngine.searchObjects(query || '', targetTypes, req.user);
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Ontology search failed', message: err.message });
  }
});

// POST Aggregate Objects
router.post('/aggregate', authenticateMiddleware, async (req, res) => {
  try {
    const { objectType, groupByProperty, metric } = req.body;
    const aggs = await ontologyEngine.aggregateObjects(objectType, groupByProperty, metric, req.user);
    res.json({ success: true, objectType, groupByProperty, aggs });
  } catch (err) {
    res.status(500).json({ error: 'Ontology aggregation failed', message: err.message });
  }
});

// POST Execute Governed Action Type
router.post('/actions/execute', authenticateMiddleware, async (req, res) => {
  try {
    const { actionType, input } = req.body;
    if (!actionType || !input) {
      return res.status(400).json({ error: 'actionType and input are required' });
    }

    const result = await ontologyEngine.executeAction(actionType, input, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'Action execution failed', message: err.message });
  }
});

// GET List of Object Types
router.get('/object-types', authenticateMiddleware, async (req, res) => {
  try {
    const rows = await db.query(`SELECT * FROM ontology_object_types ORDER BY created_at DESC`);
    res.json({
      objectTypes: rows.map(r => ({
        id: r.id,
        apiName: r.api_name || r.type_name,
        typeName: r.type_name || r.api_name,
        displayName: r.display_name || r.display_label,
        displayLabel: r.display_label || r.display_name,
        description: r.description,
        primaryKeyProperty: r.primary_key_property || 'id',
        backingTable: r.backing_table_or_view || 'entities',
        iconName: r.icon_name || 'fa-cube',
        properties: r.properties_json ? JSON.parse(r.properties_json) : [],
        version: r.version,
        status: r.status,
        createdBy: r.created_by,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ontology object types', message: err.message });
  }
});

// POST Create Object Type
router.post('/object-types', authenticateMiddleware, abacMiddleware('ADMINISTRATIVE_WRITE', req => req.body.caseId), async (req, res) => {
  try {
    const { apiName, typeName, displayName, displayLabel, description, primaryKeyProperty = 'id', backingTable = 'entities', iconName = 'fa-cube', properties = [] } = req.body;
    const name = apiName || typeName;
    const label = displayName || displayLabel;

    if (!name || !label) {
      return res.status(400).json({ error: 'apiName/typeName and displayName/displayLabel are required' });
    }

    const id = `OBJTYPE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.execute(
      `INSERT INTO ontology_object_types (id, api_name, type_name, display_name, display_label, description, primary_key_property, backing_table_or_view, icon_name, properties_json, version, status, created_by)
       VALUES ($1, $2, $2, $3, $3, $4, $5, $6, $7, $8, 1, 'ACTIVE', $9)`,
      [id, name, label, description || '', primaryKeyProperty, backingTable, iconName, JSON.stringify(properties), req.user.username]
    );

    await db.logAudit(req.user.id, req.user.username, 'CREATE_ONTOLOGY_TYPE', 'ONTOLOGY_MANAGER', `Defined object type ${name}`, id);

    res.status(201).json({
      success: true,
      id,
      apiName: name,
      typeName: name,
      displayName: label,
      displayLabel: label,
      version: 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ontology object type', message: err.message });
  }
});

// GET List of Link Types
router.get('/link-types', authenticateMiddleware, async (req, res) => {
  try {
    const rows = await db.query(`SELECT * FROM ontology_link_types ORDER BY created_at DESC`);
    res.json({
      linkTypes: rows.map(r => ({
        id: r.id,
        apiName: r.api_name || r.link_name,
        linkName: r.link_name || r.api_name,
        displayName: r.display_name || r.display_label,
        displayLabel: r.display_label || r.display_name,
        objectTypeA: r.object_type_a || r.source_type,
        objectTypeB: r.object_type_b || r.target_type,
        sourceType: r.source_type || r.object_type_a,
        targetType: r.target_type || r.object_type_b,
        sideAName: r.side_a_name,
        sideBName: r.side_b_name,
        cardinality: r.cardinality || 'MANY_TO_MANY',
        description: r.description,
        isDirectional: r.is_directional,
        version: r.version,
        status: r.status,
        createdBy: r.created_by,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ontology link types', message: err.message });
  }
});

// POST Create Link Type
router.post('/link-types', authenticateMiddleware, abacMiddleware('ADMINISTRATIVE_WRITE', req => req.body.caseId), async (req, res) => {
  try {
    const { apiName, linkName, displayName, displayLabel, objectTypeA, sourceType, objectTypeB, targetType, sideAName = 'source', sideBName = 'target', cardinality = 'MANY_TO_MANY', description, isDirectional = true } = req.body;
    const name = apiName || linkName;
    const label = displayName || displayLabel;
    const typeA = objectTypeA || sourceType || 'ANY';
    const typeB = objectTypeB || targetType || 'ANY';

    if (!name || !label) {
      return res.status(400).json({ error: 'apiName/linkName and displayName/displayLabel are required' });
    }

    const id = `LINKTYPE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.execute(
      `INSERT INTO ontology_link_types (id, api_name, link_name, display_name, display_label, object_type_a, object_type_b, source_type, target_type, side_a_name, side_b_name, cardinality, description, is_directional, version, status, created_by)
       VALUES ($1, $2, $2, $3, $3, $4, $5, $4, $5, $6, $7, $8, $9, $10, 1, 'ACTIVE', $11)`,
      [id, name, label, typeA, typeB, sideAName, sideBName, cardinality, description || '', isDirectional, req.user.username]
    );

    await db.logAudit(req.user.id, req.user.username, 'CREATE_ONTOLOGY_LINK_TYPE', 'ONTOLOGY_MANAGER', `Defined link type ${name}`, id);

    res.status(201).json({
      success: true,
      id,
      apiName: name,
      linkName: name,
      displayName: label,
      displayLabel: label,
      version: 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ontology link type', message: err.message });
  }
});

// GET Action Types
router.get('/action-types', authenticateMiddleware, async (req, res) => {
  try {
    const rows = await db.query(`SELECT * FROM ontology_action_types ORDER BY api_name ASC`);
    res.json({
      actionTypes: rows.map(r => ({
        id: r.id,
        apiName: r.api_name,
        displayName: r.display_name,
        targetObjectType: r.target_object_type,
        inputSchema: r.input_schema ? JSON.parse(r.input_schema) : {},
        functionId: r.function_id,
        version: r.version,
        status: r.status,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch action types', message: err.message });
  }
});

module.exports = router;
