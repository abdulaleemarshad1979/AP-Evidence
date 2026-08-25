const db = require('../database');
const crypto = require('crypto');

/**
 * Palantir Ontology Query & Action Engine (Object Set Service & Action Service equivalent)
 */
class OntologyEngine {
  constructor() {
    this.functionsRegistry = {
      'fn_merge_entities': this.fnMergeEntities.bind(this),
      'fn_add_observation': this.fnAddObservation.bind(this),
      'fn_create_case': this.fnCreateCase.bind(this),
      'fn_flag_subject': this.fnFlagSubject.bind(this),
      'fn_ingest_evidence': this.fnIngestEvidence.bind(this)
    };
  }

  /**
   * Seed default Ontology schemas into database if not present
   */
  async ensureSeedOntology() {
    try {
      // 1. Seed Object Types
      const objectTypes = [
        { id: 'OT-PERSON', apiName: 'Person', typeName: 'Person', displayName: 'Person / Subject', displayLabel: 'Person / Subject', description: 'Real-world human subject or entity', primaryKey: 'id', backingTable: 'entities' },
        { id: 'OT-VEHICLE', apiName: 'Vehicle', typeName: 'Vehicle', displayName: 'Vehicle', displayLabel: 'Vehicle', description: 'Motor vehicle entity', primaryKey: 'id', backingTable: 'entities' },
        { id: 'OT-OBSERVATION', apiName: 'Observation', typeName: 'Observation', displayName: 'Spatio-Temporal Observation', displayLabel: 'Spatio-Temporal Observation', description: 'Geo-spatial or sensor observation event', primaryKey: 'id', backingTable: 'observations' },
        { id: 'OT-EVIDENCE', apiName: 'Evidence', typeName: 'Evidence', displayName: 'Evidentiary Item', displayLabel: 'Evidentiary Item', description: 'Digital or physical evidence item', primaryKey: 'id', backingTable: 'evidence_metadata' },
        { id: 'OT-CASE', apiName: 'Case', typeName: 'Case', displayName: 'Investigation Case', displayLabel: 'Investigation Case', description: 'Law enforcement or intelligence case file', primaryKey: 'id', backingTable: 'cases' },
        { id: 'OT-NET-IND', apiName: 'NetworkIndicator', typeName: 'NetworkIndicator', displayName: 'Network Telemetry Indicator', displayLabel: 'Network Telemetry Indicator', description: 'IP address, domain, or MAC indicator entity', primaryKey: 'id', backingTable: 'entities' },
        { id: 'OT-PCAP-DUMP', apiName: 'PCAPDump', typeName: 'PCAPDump', displayName: 'PCAP Network Packet Capture', displayLabel: 'PCAP Network Packet Capture', description: 'Raw or parsed PCAP network capture file', primaryKey: 'id', backingTable: 'evidence_metadata' }
      ];

      for (const ot of objectTypes) {
        const existing = await db.queryOne(`SELECT * FROM ontology_object_types WHERE api_name = $1 OR type_name = $1`, [ot.apiName]);
        if (!existing) {
          await db.execute(
            `INSERT INTO ontology_object_types (id, api_name, type_name, display_name, display_label, description, primary_key_property, backing_table_or_view, properties_json, version, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]', 1, 'ACTIVE', 'System')`,
            [ot.id, ot.apiName, ot.typeName, ot.displayName, ot.displayLabel, ot.description, ot.primaryKey, ot.backingTable]
          );
        }
      }

      // 2. Seed Link Types
      const linkTypes = [
        { id: 'LT-OBSERVED-AT', apiName: 'OBSERVED_AT', linkName: 'OBSERVED_AT', displayName: 'Observed At Location/Time', displayLabel: 'Observed At Location/Time', objectA: 'Person', objectB: 'Observation', sourceType: 'Person', targetType: 'Observation', sideA: 'observations', sideB: 'subject', cardinality: 'ONE_TO_MANY' },
        { id: 'LT-ASSOCIATED-WITH', apiName: 'ASSOCIATED_WITH', linkName: 'ASSOCIATED_WITH', displayName: 'Associated With Subject', displayLabel: 'Associated With Subject', objectA: 'Person', objectB: 'Person', sourceType: 'Person', targetType: 'Person', sideA: 'associates', sideB: 'associates', cardinality: 'MANY_TO_MANY' },
        { id: 'LT-EVIDENCE-OF', apiName: 'EVIDENCE_OF', linkName: 'EVIDENCE_OF', displayName: 'Evidence of Observation', displayLabel: 'Evidence of Observation', objectA: 'Evidence', objectB: 'Observation', sourceType: 'Evidence', targetType: 'Observation', sideA: 'observations', sideB: 'supporting_evidence', cardinality: 'ONE_TO_MANY' },
        { id: 'LT-REGISTERED-TO', apiName: 'REGISTERED_TO', linkName: 'REGISTERED_TO', displayName: 'Registered To Owner', displayLabel: 'Registered To Owner', objectA: 'Vehicle', objectB: 'Person', sourceType: 'Vehicle', targetType: 'Person', sideA: 'owner', sideB: 'vehicles', cardinality: 'MANY_TO_ONE' },
        { id: 'LT-COMMUNICATED-WITH', apiName: 'COMMUNICATED_WITH', linkName: 'COMMUNICATED_WITH', displayName: 'Communicated With Network Endpoint', displayLabel: 'Communicated With Network Endpoint', objectA: 'NetworkIndicator', objectB: 'NetworkIndicator', sourceType: 'NetworkIndicator', targetType: 'NetworkIndicator', sideA: 'source_endpoint', sideB: 'destination_endpoint', cardinality: 'MANY_TO_MANY' },
        { id: 'LT-INGESTED-IN-PCAP', apiName: 'INGESTED_IN_PCAP', linkName: 'INGESTED_IN_PCAP', displayName: 'Ingested In PCAP Capture', displayLabel: 'Ingested In PCAP Capture', objectA: 'NetworkIndicator', objectB: 'PCAPDump', sourceType: 'NetworkIndicator', targetType: 'PCAPDump', sideA: 'indicators', sideB: 'pcap_capture', cardinality: 'MANY_TO_ONE' }
      ];

      for (const lt of linkTypes) {
        const existing = await db.queryOne(`SELECT * FROM ontology_link_types WHERE api_name = $1 OR link_name = $1`, [lt.apiName]);
        if (!existing) {
          await db.execute(
            `INSERT INTO ontology_link_types (id, api_name, link_name, display_name, display_label, object_type_a, object_type_b, source_type, target_type, side_a_name, side_b_name, cardinality, version, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, 'ACTIVE', 'System')`,
            [lt.id, lt.apiName, lt.linkName, lt.displayName, lt.displayLabel, lt.objectA, lt.objectB, lt.sourceType, lt.targetType, lt.sideA, lt.sideB, lt.cardinality]
          );
        }
      }

      // 3. Seed Functions
      const functions = [
        { id: 'FN-MERGE-ENTITIES', apiName: 'fn_merge_entities', description: 'Reversibly merges secondary entity into primary canonical entity', ref: 'fn_merge_entities' },
        { id: 'FN-ADD-OBSERVATION', apiName: 'fn_add_observation', description: 'Adds spatio-temporal observation to an entity', ref: 'fn_add_observation' },
        { id: 'FN-CREATE-CASE', apiName: 'fn_create_case', description: 'Creates a governed investigation case file', ref: 'fn_create_case' },
        { id: 'FN-FLAG-SUBJECT', apiName: 'fn_flag_subject', description: 'Sets human review priority and flag status on a subject', ref: 'fn_flag_subject' },
        { id: 'FN-INGEST-EVIDENCE', apiName: 'fn_ingest_evidence', description: 'Ingests new evidentiary file into vault with custody ledger entry', ref: 'fn_ingest_evidence' }
      ];

      for (const fn of functions) {
        const existing = await db.queryOne(`SELECT * FROM ontology_functions WHERE api_name = $1`, [fn.apiName]);
        if (!existing) {
          await db.execute(
            `INSERT INTO ontology_functions (id, api_name, description, implementation_ref, version)
             VALUES ($1, $2, $3, $4, 1)`,
            [fn.id, fn.apiName, fn.description, fn.ref]
          );
        }
      }

      // 4. Seed Action Types
      const actionTypes = [
        { id: 'ACT-MERGE-ENTITIES', apiName: 'MERGE_ENTITIES', displayName: 'Merge Entities', targetObjectType: 'Person', schema: JSON.stringify({ primaryEntityId: 'string', secondaryEntityId: 'string', reason: 'string' }), functionId: 'FN-MERGE-ENTITIES' },
        { id: 'ACT-ADD-OBSERVATION', apiName: 'ADD_OBSERVATION', displayName: 'Add Spatio-Temporal Observation', targetObjectType: 'Observation', schema: JSON.stringify({ entityId: 'string', caseId: 'string', observationType: 'string', locationName: 'string', latitude: 'number', longitude: 'number' }), functionId: 'FN-ADD-OBSERVATION' },
        { id: 'ACT-CREATE-CASE', apiName: 'CREATE_CASE', displayName: 'Create Governed Case', targetObjectType: 'Case', schema: JSON.stringify({ title: 'string', codeName: 'string', description: 'string', organization: 'string', jurisdiction: 'string' }), functionId: 'FN-CREATE-CASE' },
        { id: 'ACT-FLAG-SUBJECT', apiName: 'FLAG_SUBJECT', displayName: 'Flag Subject for Review', targetObjectType: 'Person', schema: JSON.stringify({ entityId: 'string', reviewPriority: 'string', reason: 'string' }), functionId: 'FN-FLAG-SUBJECT' },
        { id: 'ACT-INGEST-EVIDENCE', apiName: 'INGEST_EVIDENCE', displayName: 'Ingest Evidence File', targetObjectType: 'Evidence', schema: JSON.stringify({ title: 'string', mediaType: 'string', caseId: 'string', sha256: 'string' }), functionId: 'FN-INGEST-EVIDENCE' }
      ];

      for (const act of actionTypes) {
        const existing = await db.queryOne(`SELECT * FROM ontology_action_types WHERE api_name = $1`, [act.apiName]);
        if (!existing) {
          await db.execute(
            `INSERT INTO ontology_action_types (id, api_name, display_name, target_object_type, input_schema, function_id, version, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, 1, 'ACTIVE', 'System')`,
            [act.id, act.apiName, act.displayName, act.targetObjectType, act.schema, act.functionId]
          );
        }
      }
    } catch (err) {
      console.warn('[ONTOLOGY ENGINE] Seed error (non-fatal):', err.message);
    }
  }

  /**
   * Get Object Set by Type Name with Filtering
   */
  async getObjectsByType(apiName, filter = {}, user = null) {
    await this.ensureSeedOntology();
    const ot = await db.queryOne(`SELECT * FROM ontology_object_types WHERE api_name = $1 OR type_name = $1`, [apiName]);
    if (!ot) {
      throw new Error(`Ontology Object Type '${apiName}' not found`);
    }

    const backingTable = ot.backing_table_or_view || 'entities';
    let sql = `SELECT * FROM ${backingTable} WHERE 1=1`;
    const params = [];

    // Filter handling based on backing table
    if (backingTable === 'entities') {
      sql += ` AND status != 'MERGED'`;
      if (apiName === 'Person' || apiName === 'Subject') {
        sql += ` AND (type = 'Person' OR type = 'Subject' OR type IS NULL)`;
      } else {
        params.push(apiName);
        sql += ` AND type = $${params.length}`;
      }
    }

    if (filter.caseId && (backingTable === 'observations' || backingTable === 'evidence_metadata' || backingTable === 'cases')) {
      params.push(filter.caseId);
      sql += ` AND case_id = $${params.length}`;
    }

    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      if (backingTable === 'entities') {
        sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(id) LIKE $${params.length})`;
      } else if (backingTable === 'observations') {
        sql += ` AND (LOWER(location_name) LIKE $${params.length} OR LOWER(observation_type) LIKE $${params.length})`;
      } else if (backingTable === 'evidence_metadata') {
        sql += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(id) LIKE $${params.length})`;
      } else if (backingTable === 'cases') {
        sql += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(code_name) LIKE $${params.length})`;
      }
    }

    sql += ` ORDER BY created_at DESC LIMIT ${filter.limit || 100}`;
    const rows = await db.query(sql, params);

    return rows.map(row => ({
      __type: apiName,
      __primaryKey: row[ot.primary_key_property || 'id'],
      properties: row
    }));
  }

  /**
   * Traverse Link Types to find connected Object Sets
   */
  async getLinkedObjects(sourceType, sourceId, linkTypeApiName, user = null) {
    await this.ensureSeedOntology();
    const lt = await db.queryOne(`SELECT * FROM ontology_link_types WHERE api_name = $1 OR link_name = $1`, [linkTypeApiName]);
    if (!lt) {
      throw new Error(`Ontology Link Type '${linkTypeApiName}' not found`);
    }

    if (linkTypeApiName === 'OBSERVED_AT') {
      const rows = await db.query(`SELECT * FROM observations WHERE entity_id = $1 ORDER BY timestamp DESC`, [sourceId]);
      return rows.map(r => ({ __type: 'Observation', __primaryKey: r.id, properties: r }));
    }

    if (linkTypeApiName === 'ASSOCIATED_WITH') {
      const assertions = await db.query(
        `SELECT * FROM assertions WHERE subject_entity_id = $1 OR object_entity_id = $1`,
        [sourceId]
      );
      const linkedIds = assertions.map(a => a.subject_entity_id === sourceId ? a.object_entity_id : a.subject_entity_id);
      if (linkedIds.length === 0) return [];
      const entities = await db.getEntities();
      return entities
        .filter(e => linkedIds.includes(e.id))
        .map(e => ({ __type: 'Person', __primaryKey: e.id, properties: e }));
    }

    if (linkTypeApiName === 'EVIDENCE_OF') {
      const obs = await db.queryOne(`SELECT * FROM observations WHERE id = $1`, [sourceId]);
      if (!obs || !obs.evidence_id) return [];
      const evidence = await db.getEvidenceById(obs.evidence_id);
      return evidence ? [{ __type: 'Evidence', __primaryKey: evidence.id, properties: evidence }] : [];
    }

    return [];
  }

  /**
   * Search across all or selected Ontology Object Types
   */
  async searchObjects(queryStr, targetTypes = ['Person', 'Observation', 'Evidence', 'Case'], user = null) {
    await this.ensureSeedOntology();
    const results = [];
    for (const typeName of targetTypes) {
      try {
        const objs = await this.getObjectsByType(typeName, { search: queryStr, limit: 20 }, user);
        results.push(...objs);
      } catch (e) {}
    }
    return results;
  }

  /**
   * Get All Objects across ALL active Ontology Object Types (load-bearing for Graph & Subject 360)
   */
  async getAllObjects(filter = {}, user = null) {
    await this.ensureSeedOntology();
    const objectTypes = await db.query(`SELECT * FROM ontology_object_types WHERE status = 'ACTIVE' ORDER BY created_at ASC`);
    const allObjects = [];

    for (const ot of objectTypes) {
      const typeName = ot.api_name || ot.type_name;
      try {
        const objs = await this.getObjectsByType(typeName, filter, user);
        allObjects.push(...objs);
      } catch (e) {}
    }

    return allObjects;
  }

  /**
   * Get Single Object by Primary Key ID across Ontology Object Types
   */
  async getObjectById(id, user = null) {
    await this.ensureSeedOntology();
    const entity = await db.getEntityById(id);
    if (entity) {
      return {
        __type: entity.type || 'Person',
        __primaryKey: entity.id,
        properties: entity,
        ...entity
      };
    }

    const all = await this.getAllObjects({}, user);
    const match = all.find(o => o.__primaryKey === id || o.properties?.id === id);
    if (match) {
      return {
        ...match,
        ...match.properties
      };
    }

    return null;
  }

  /**
   * Get Assertions (Relationships) through Ontology Core
   */
  async getAssertions(caseId, filter = {}, user = null) {
    await this.ensureSeedOntology();
    let sql = `SELECT * FROM assertions WHERE 1=1`;
    const params = [];

    if (caseId) {
      params.push(caseId);
      sql += ` AND case_id = $${params.length}`;
    }

    if (filter.entityId) {
      params.push(filter.entityId);
      sql += ` AND (subject_entity_id = $${params.length} OR object_entity_id = $${params.length})`;
    }

    sql += ` ORDER BY created_at DESC`;
    return await db.query(sql, params);
  }

  /**
   * Get Observations through Ontology Core
   */
  async getObservations(filter = {}, user = null) {
    await this.ensureSeedOntology();
    let sql = `SELECT * FROM observations WHERE 1=1`;
    const params = [];

    if (filter.caseId) {
      params.push(filter.caseId);
      sql += ` AND case_id = $${params.length}`;
    }

    if (filter.entityId) {
      params.push(filter.entityId);
      sql += ` AND entity_id = $${params.length}`;
    }

    if (filter.excludeEntityId) {
      params.push(filter.excludeEntityId);
      sql += ` AND entity_id != $${params.length}`;
    }

    sql += ` ORDER BY timestamp ASC`;
    return await db.query(sql, params);
  }

  /**
   * Get Geospatial Observations (Bounding Box Query) through Ontology Core
   */
  async getGeospatialObservations({ targetCaseId, minLon, minLat, maxLon, maxLat }, user = null) {
    await this.ensureSeedOntology();
    if (!db.isPgMem && minLon && minLat && maxLon && maxLat) {
      return await db.query(
        `SELECT * FROM observations 
         WHERE case_id = $1 AND location_geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
         ORDER BY timestamp DESC`,
        [targetCaseId, parseFloat(minLon), parseFloat(minLat), parseFloat(maxLon), parseFloat(maxLat)]
      );
    }
    return await db.query(
      `SELECT * FROM observations WHERE case_id = $1 ORDER BY timestamp DESC`,
      [targetCaseId]
    );
  }

  /**
   * Get Co-located Observations through Ontology Core
   */
  async getColocatedObservations({ targetId, radiusMeters = 500, targetCaseId }, user = null) {
    await this.ensureSeedOntology();
    const targetObs = await db.query(`SELECT * FROM observations WHERE entity_id = $1 AND case_id = $2`, [targetId || 'SUB-00001', targetCaseId]);

    if (!db.isPgMem && targetObs.length > 0) {
      return await db.query(
        `SELECT DISTINCT o2.* 
         FROM observations o1
         JOIN observations o2 ON o1.entity_id != o2.entity_id AND o1.case_id = o2.case_id
         WHERE o1.entity_id = $1 AND o1.case_id = $2
           AND ST_DWithin(o1.location_geom, o2.location_geom, $3)`,
        [targetId || 'SUB-00001', targetCaseId, radiusMeters]
      );
    }

    return await db.query(`SELECT * FROM observations WHERE case_id = $1 AND entity_id != $2`, [targetCaseId, targetId || 'SUB-00001']);
  }

  /**
   * Get Trajectory Waypoints through Ontology Core
   */
  async getTrajectory({ entityId, targetCaseId }, user = null) {
    await this.ensureSeedOntology();
    return await db.query(
      `SELECT id, timestamp, location_name, latitude, longitude, confidence_score 
       FROM observations 
       WHERE entity_id = $1 AND case_id = $2 
       ORDER BY timestamp ASC`,
      [entityId || 'SUB-00001', targetCaseId]
    );
  }

  /**
   * Get Evidence List through Ontology Core
   */
  async getEvidenceList(filter = {}, user = null) {
    await this.ensureSeedOntology();
    return await db.getEvidenceList(filter);
  }

  /**
   * Aggregate Ontology Object Properties
   */
  async aggregateObjects(apiName, groupByProp, metric = 'COUNT', user = null) {
    await this.ensureSeedOntology();
    const objs = await this.getObjectsByType(apiName, { limit: 500 }, user);
    const aggMap = {};

    for (const obj of objs) {
      const val = obj.properties[groupByProp] || 'UNSPECIFIED';
      aggMap[val] = (aggMap[val] || 0) + 1;
    }

    return Object.keys(aggMap).map(key => ({
      group: key,
      count: aggMap[key]
    }));
  }

  /**
   * Execute Governed Action Type (only governed mutation mechanism)
   */
  async executeAction(actionTypeApiName, input, user = { id: 'USR-101', username: 'System' }) {
    await this.ensureSeedOntology();
    const act = await db.queryOne(`SELECT * FROM ontology_action_types WHERE api_name = $1`, [actionTypeApiName]);
    if (!act) {
      throw new Error(`Ontology Action Type '${actionTypeApiName}' is not registered`);
    }

    const fnDef = await db.queryOne(`SELECT * FROM ontology_functions WHERE id = $1`, [act.function_id]);
    const fnRef = fnDef?.implementation_ref || act.function_id;

    const fnHandler = this.functionsRegistry[fnRef];
    if (!fnHandler) {
      throw new Error(`Implementation function handler '${fnRef}' not found in registry`);
    }

    // Execute attached function inside atomic transaction boundary
    const result = await db.withTransaction(async (client) => {
      return await fnHandler(input, user, client);
    });

    // Audit log Action execution
    await db.logAudit(
      user.id || 'USR-101',
      user.username || 'System',
      `ACTION_EXECUTION_${actionTypeApiName}`,
      'ONTOLOGY_ACTION_ENGINE',
      `Executed Action ${actionTypeApiName} on ${act.target_object_type}`,
      result.id || input.entityId || input.primaryEntityId || null,
      input.caseId || null
    );

    // Emit outbox projection event
    await db.emitOutboxEvent(
      act.target_object_type,
      result.id || input.primaryEntityId || 'ACT-RES',
      `ACTION_${actionTypeApiName}`,
      { actionType: actionTypeApiName, input, executedBy: user.username }
    );

    return {
      success: true,
      actionType: actionTypeApiName,
      targetObjectType: act.target_object_type,
      result
    };
  }

  // --- Function Handlers Attached to Action Types ---
  async fnMergeEntities(input, user, client) {
    const { primaryEntityId, secondaryEntityId, reason = 'Ontology Action Merge' } = input;
    const secObj = await db.getEntityById(secondaryEntityId);
    if (!secObj) throw new Error(`Secondary entity ${secondaryEntityId} not found`);

    const snapshot = { secondaryEntity: secObj };
    const histId = `MH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await client.query(
      `INSERT INTO merge_history (id, candidate_id, primary_entity_id, secondary_entity_id, reviewer, decision_reason, original_state_snapshot, action)
       VALUES ($1, 'RES-ONTOLOGY', $2, $3, $4, $5, $6, 'MERGED')`,
      [histId, primaryEntityId, secondaryEntityId, user.username, reason, JSON.stringify(snapshot)]
    );

    await client.query(
      `UPDATE entities SET status = 'MERGED', canonical_entity_id = $1 WHERE id = $2`,
      [primaryEntityId, secondaryEntityId]
    );

    return { primaryEntityId, secondaryEntityId, status: 'MERGED', mergeHistoryId: histId };
  }

  async fnAddObservation(input, user, client) {
    const id = `OBS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let { entityId, caseId, observationType, locationName, latitude, longitude, confidenceScore = 0.95, evidenceId = 'EVI-GEN-001', rawData = {} } = input;

    // Verify or find a valid evidence item for foreign key constraint
    const evCheck = await client.query(`SELECT id FROM evidence_metadata WHERE id = $1`, [evidenceId]);
    if (evCheck.rows.length === 0) {
      const anyEv = await client.query(`SELECT id FROM evidence_metadata LIMIT 1`);
      if (anyEv.rows.length > 0) {
        evidenceId = anyEv.rows[0].id;
      } else {
        // Insert fallback evidence item
        evidenceId = `EVI-AUTO-${Date.now()}`;
        await client.query(
          `INSERT INTO evidence_metadata (id, title, media_type, file_size, sha256, classification, custodian, source_device, case_id, evidence_status)
           VALUES ($1, 'Auto Observation Evidence', 'application/json', '1 KB', 'sha256-auto', 'RESTRICTED', $2, 'AUTO_CONNECTOR', $3, 'VERIFIED_RAW')`,
          [evidenceId, user.username || 'System', caseId || 'CASE-AP-2026-0001']
        );
      }
    }

    await client.query(
      `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, 'VERIFIED_RAW', $9, $10)`,
      [id, entityId, caseId, observationType, locationName, latitude, longitude, confidenceScore, JSON.stringify(rawData), evidenceId]
    );

    return { id, entityId, caseId, observationType, locationName };
  }

  async fnCreateCase(input, user, client) {
    const id = input.id || `CASE-AP-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const { title, codeName, description, organization = 'ORG-ALPHA', jurisdiction = 'JUR-UK', classification = 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY', permittedPurposes = 'COUNTER_TERRORISM,LAW_ENFORCEMENT' } = input;

    await client.query(
      `INSERT INTO cases (id, title, code_name, description, organization, jurisdiction, classification_level, permitted_purposes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')`,
      [id, title, codeName, description, organization, jurisdiction, classification, permittedPurposes]
    );

    await client.query(
      `INSERT INTO case_assignments (case_id, user_id) VALUES ($1, $2)`,
      [id, user.id || 'USR-101']
    );

    return { id, title, codeName, status: 'ACTIVE' };
  }

  async fnFlagSubject(input, user, client) {
    const { entityId, reviewPriority = 'P1_HIGH', reason = 'Flagged via Action' } = input;
    await client.query(
      `UPDATE entities SET review_priority = $1, human_review_status = 'PENDING_REVIEW' WHERE id = $2`,
      [reviewPriority, entityId]
    );
    return { entityId, reviewPriority, status: 'FLAGGED' };
  }

  async fnIngestEvidence(input, user, client) {
    const id = input.id || `EVI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const { title, mediaType = 'application/pdf', fileSize = '1.2 MB', sha256 = 'sha256-mock-hash', caseId = 'CASE-AP-2026-0001', classification = 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY' } = input;

    await client.query(
      `INSERT INTO evidence_metadata (id, title, media_type, file_size, sha256, classification, custodian, source_device, case_id, evidence_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'FIELD_TERMINAL', $8, 'VERIFIED_RAW')`,
      [id, title, mediaType, fileSize, sha256, classification, user.username, caseId]
    );

    const ledgerId = `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await client.query(
      `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, 'INITIAL_INGESTION', 'Evidence ingested via Action', $5)`,
      [ledgerId, id, user.id || 'USR-101', user.username || 'System', sha256]
    );

    return { id, title, sha256, caseId };
  }
}

const ontologyEngine = new OntologyEngine();
module.exports = ontologyEngine;
