const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const AUDIT_ANCHOR_PATH = path.join(DATA_DIR, 'audit_anchors.log');

class PostgreSQLDatabase {
  constructor() {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI || 'postgres://postgres:postgres@127.0.0.1:5432/ap_evidence';
    this.connectionString = connectionString;
    this.pool = null;
    this.memDb = null;
    this.isPgMem = false;
    this.initialized = false;
  }

  static sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async init() {
    if (this.initialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 1000
    });

    let connected = false;
    try {
      const client = await this.pool.connect();
      client.release();
      connected = true;
      console.log(`[POSTGRES DB] Successfully connected to PostgreSQL 16`);
    } catch (err) {
      console.warn(`[POSTGRES DB] Real PostgreSQL unavailable on 5432 (${err.message}). Using isolated unit-test fallback.`);
    }

    if (!connected) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[POSTGRES DB] Fail Closed: PostgreSQL database connection failed in production mode. Fallback to pg-mem is strictly forbidden in production.');
      }
      // Isolated unit-test fallback using pg-mem for npm test execution without live Postgres server
      try {
        const { newDb } = require('pg-mem');
        const memDb = newDb();
        this.memDb = memDb;

        const pgMemAdapter = memDb.adapters.createPg();
        this.pool = new pgMemAdapter.Pool();
        this.isPgMem = true;
        console.log('[POSTGRES DB] Unit-test memory database initialized');
      } catch (memErr) {
        throw new Error(`[POSTGRES DB] Fail Closed: Could not connect to PostgreSQL and unit-test fallback failed: ${memErr.message}`);
      }
    }

    // Run Schema Migrations
    if (this.isPgMem) {
      // Direct DDL execution for pg-mem unit test runner
      const tables = [
        `CREATE TABLE IF NOT EXISTS users (id VARCHAR(64) PRIMARY KEY, username VARCHAR(128) NOT NULL UNIQUE, name VARCHAR(256) NOT NULL, role VARCHAR(64) NOT NULL, organization VARCHAR(128) NOT NULL, jurisdiction VARCHAR(128) NOT NULL, purpose_clearance VARCHAR(128) NOT NULL, password_hash VARCHAR(256), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS cases (id VARCHAR(64) PRIMARY KEY, title VARCHAR(256) NOT NULL, code_name VARCHAR(128) NOT NULL, description TEXT, organization VARCHAR(128) NOT NULL, jurisdiction VARCHAR(128) NOT NULL, classification_level VARCHAR(256) NOT NULL, permitted_purposes VARCHAR(256) NOT NULL, status VARCHAR(64) DEFAULT 'ACTIVE', target_entity_ids TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS case_assignments (case_id VARCHAR(64) NOT NULL, user_id VARCHAR(64) NOT NULL, assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (case_id, user_id));`,
        `CREATE TABLE IF NOT EXISTS entities (id VARCHAR(64) PRIMARY KEY, type VARCHAR(64) NOT NULL, name VARCHAR(256) NOT NULL, aliases TEXT, identifier_fields TEXT, evidence_status VARCHAR(64) NOT NULL, assertion_class VARCHAR(64) NOT NULL, confidence_method VARCHAR(64) NOT NULL, human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED', review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM', status VARCHAR(64) DEFAULT 'ACTIVE', canonical_entity_id VARCHAR(64), version INT DEFAULT 1 NOT NULL, is_fictional BOOLEAN DEFAULT TRUE NOT NULL, metadata TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS observations (id VARCHAR(64) PRIMARY KEY, entity_id VARCHAR(64) NOT NULL, case_id VARCHAR(64) NOT NULL, observation_type VARCHAR(64) NOT NULL, timestamp TIMESTAMP NOT NULL, location_name VARCHAR(256) NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, location_geom TEXT, confidence_score DOUBLE PRECISION NOT NULL, evidence_status VARCHAR(64) NOT NULL, raw_data TEXT NOT NULL, evidence_id VARCHAR(64) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS assertions (id VARCHAR(64) PRIMARY KEY, subject_entity_id VARCHAR(64) NOT NULL, object_entity_id VARCHAR(64) NOT NULL, case_id VARCHAR(64) NOT NULL, relation_type VARCHAR(64) NOT NULL, confidence_score DOUBLE PRECISION NOT NULL, confidence_method VARCHAR(64) NOT NULL, assertion_class VARCHAR(64) NOT NULL, human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED', review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM', evidence_id VARCHAR(64) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS evidence_metadata (id VARCHAR(64) PRIMARY KEY, title VARCHAR(256) NOT NULL, media_type VARCHAR(64) NOT NULL, file_size VARCHAR(64) NOT NULL, sha256 VARCHAR(64) NOT NULL, object_key VARCHAR(512), version_id VARCHAR(128), is_original BOOLEAN DEFAULT TRUE NOT NULL, parent_evidence_id VARCHAR(64), classification VARCHAR(256) NOT NULL, custodian VARCHAR(256) NOT NULL, source_device VARCHAR(256) NOT NULL, case_id VARCHAR(64) NOT NULL, evidence_status VARCHAR(64) NOT NULL, human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED', review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM', metadata TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS evidence_custody_ledger (id VARCHAR(64) PRIMARY KEY, evidence_id VARCHAR(64) NOT NULL, timestamp TIMESTAMP NOT NULL, user_id VARCHAR(64) NOT NULL, username VARCHAR(128) NOT NULL, action VARCHAR(64) NOT NULL, notes TEXT NOT NULL, hash_signature VARCHAR(64) NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS ingestion_batches (id VARCHAR(64) PRIMARY KEY, source_feed VARCHAR(128) NOT NULL, feed_type VARCHAR(64) NOT NULL, total_records INT NOT NULL, accepted_records INT DEFAULT 0, rejected_records INT DEFAULT 0, duplicate_records INT DEFAULT 0, quarantined_records INT DEFAULT 0, status VARCHAR(64) DEFAULT 'PROCESSING', payload_hash VARCHAR(64) NOT NULL, reconciliation_summary TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ingestion_rows (id VARCHAR(64) PRIMARY KEY, batch_id VARCHAR(64) NOT NULL, row_index INT NOT NULL, raw_payload TEXT NOT NULL, payload_hash VARCHAR(64) NOT NULL, status VARCHAR(64) NOT NULL, error_details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS resolution_candidates (id VARCHAR(64) PRIMARY KEY, entity_a VARCHAR(64) NOT NULL, entity_b VARCHAR(64) NOT NULL, rule_version VARCHAR(64) NOT NULL, match_score DOUBLE PRECISION NOT NULL, compared_fields TEXT NOT NULL, individual_scores TEXT NOT NULL, conflicts TEXT, human_review_status VARCHAR(64) DEFAULT 'PENDING_REVIEW', review_priority VARCHAR(64) DEFAULT 'P1_HIGH', reviewer VARCHAR(128), decision_reason TEXT, status VARCHAR(64) DEFAULT 'PENDING_REVIEW', version INT DEFAULT 1 NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS merge_history (id VARCHAR(64) PRIMARY KEY, candidate_id VARCHAR(64) NOT NULL, primary_entity_id VARCHAR(64) NOT NULL, secondary_entity_id VARCHAR(64) NOT NULL, reviewer VARCHAR(128) NOT NULL, decision_reason TEXT NOT NULL, original_state_snapshot TEXT NOT NULL, action VARCHAR(64) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS audit_events (id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, username VARCHAR(128) NOT NULL, action VARCHAR(64) NOT NULL, module VARCHAR(64) NOT NULL, details TEXT NOT NULL, target_entity_id VARCHAR(64), case_id VARCHAR(64), timestamp TIMESTAMP NOT NULL, prev_hash VARCHAR(64) NOT NULL, hash VARCHAR(64) NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS outbox_events (id VARCHAR(64) PRIMARY KEY, aggregate_type VARCHAR(64) NOT NULL, aggregate_id VARCHAR(64) NOT NULL, event_type VARCHAR(64) NOT NULL, payload TEXT NOT NULL, status VARCHAR(64) DEFAULT 'PENDING', attempts INT DEFAULT 0, last_error TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, processed_at TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS quarantine_records (id VARCHAR(64) PRIMARY KEY, source_connector VARCHAR(64) NOT NULL, raw_payload TEXT NOT NULL, payload_hash VARCHAR(64) NOT NULL, reason TEXT NOT NULL, status VARCHAR(64) DEFAULT 'QUARANTINED', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS sensor_alerts (id VARCHAR(64) PRIMARY KEY, sensor_type VARCHAR(64) NOT NULL, severity VARCHAR(32) NOT NULL, case_id VARCHAR(64), entity_id VARCHAR(64), title VARCHAR(256) NOT NULL, description TEXT NOT NULL, status VARCHAR(32) DEFAULT 'UNACKNOWLEDGED', acknowledged_by VARCHAR(128), metadata TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS sources (id VARCHAR(64) PRIMARY KEY, name VARCHAR(256) NOT NULL, source_type VARCHAR(64) NOT NULL, description TEXT, owner VARCHAR(128) NOT NULL, classification VARCHAR(128), data_format VARCHAR(64) NOT NULL, schema_version VARCHAR(32), enabled BOOLEAN DEFAULT TRUE, trust_level VARCHAR(32), retention_policy VARCHAR(64), last_successful_ingestion TIMESTAMP, health_status VARCHAR(32), config_ref VARCHAR(256), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ingestion_jobs (id VARCHAR(64) PRIMARY KEY, source_id VARCHAR(64), job_type VARCHAR(64) NOT NULL, status VARCHAR(64) DEFAULT 'PENDING', idempotency_key VARCHAR(128), total_records INT DEFAULT 0, processed_records INT DEFAULT 0, accepted_records INT DEFAULT 0, quarantined_records INT DEFAULT 0, duplicate_records INT DEFAULT 0, error_log TEXT, started_at TIMESTAMP, completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS data_quality_results (id VARCHAR(64) PRIMARY KEY, job_id VARCHAR(64), source_id VARCHAR(64), completeness_score DOUBLE PRECISION DEFAULT 1.0, validity_score DOUBLE PRECISION DEFAULT 1.0, consistency_score DOUBLE PRECISION DEFAULT 1.0, timeliness_score DOUBLE PRECISION DEFAULT 1.0, uniqueness_score DOUBLE PRECISION DEFAULT 1.0, source_reliability_score DOUBLE PRECISION DEFAULT 1.0, overall_quality_grade VARCHAR(16) DEFAULT 'EXCELLENT', failed_rules TEXT, remediation_suggestions TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS analytics_rules (id VARCHAR(64) PRIMARY KEY, name VARCHAR(256) NOT NULL, description TEXT, rule_version VARCHAR(32) NOT NULL, enabled BOOLEAN DEFAULT TRUE, authorized_scope VARCHAR(64), spatial_window_meters INT DEFAULT 500, time_window_minutes INT DEFAULT 60, conditions_json TEXT NOT NULL, severity VARCHAR(32) DEFAULT 'MEDIUM', cooldown_minutes INT DEFAULT 15, owner VARCHAR(128) NOT NULL, approval_status VARCHAR(32) DEFAULT 'APPROVED', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS alerts (id VARCHAR(64) PRIMARY KEY, rule_id VARCHAR(64), title VARCHAR(256) NOT NULL, description TEXT NOT NULL, severity VARCHAR(32) NOT NULL, status VARCHAR(32) DEFAULT 'NEW', assigned_to VARCHAR(128), case_id VARCHAR(64), subject_entity_id VARCHAR(64), matched_conditions TEXT, evidence_ids TEXT, resolution_notes TEXT, sla_due_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS model_registry (id VARCHAR(64) PRIMARY KEY, model_name VARCHAR(128) NOT NULL, model_version VARCHAR(32) NOT NULL, provider VARCHAR(64) NOT NULL, intended_use TEXT NOT NULL, prohibited_use TEXT NOT NULL, approval_status VARCHAR(32) DEFAULT 'APPROVED', deployment_status VARCHAR(32) DEFAULT 'ACTIVE', known_limitations TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ai_runs (id VARCHAR(64) PRIMARY KEY, prompt_task VARCHAR(128) NOT NULL, model_id VARCHAR(64), case_id VARCHAR(64), input_params TEXT, output_text TEXT NOT NULL, cited_evidence_ids TEXT, confidence_score DOUBLE PRECISION DEFAULT 0.90, review_status VARCHAR(32) DEFAULT 'PENDING_REVIEW', reviewed_by VARCHAR(128), reviewer_notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS retention_policies (id VARCHAR(64) PRIMARY KEY, data_category VARCHAR(64) NOT NULL, retention_days INT NOT NULL, legal_hold_active BOOLEAN DEFAULT FALSE, archival_location VARCHAR(256), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS document_jobs (id VARCHAR(64) PRIMARY KEY, case_id VARCHAR(64) NOT NULL, file_name VARCHAR(256) NOT NULL, media_type VARCHAR(64) NOT NULL, file_size VARCHAR(64) NOT NULL, sha256 VARCHAR(64) NOT NULL, evidence_id VARCHAR(64) NOT NULL, status VARCHAR(64) DEFAULT 'PROCESSING', extracted_text TEXT, page_count INT DEFAULT 1, ocr_applied BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS document_extractions (id VARCHAR(64) PRIMARY KEY, job_id VARCHAR(64) NOT NULL, case_id VARCHAR(64) NOT NULL, evidence_id VARCHAR(64) NOT NULL, extraction_type VARCHAR(64) NOT NULL, entity_type VARCHAR(64), extracted_value VARCHAR(256) NOT NULL, canonical_name VARCHAR(256), relation_type VARCHAR(64), object_value VARCHAR(256), confidence_score DOUBLE PRECISION DEFAULT 0.85, location_name VARCHAR(256), latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, page_number INT DEFAULT 1, text_offset VARCHAR(64), snippet TEXT NOT NULL, status VARCHAR(64) DEFAULT 'PENDING_REVIEW', reviewed_by VARCHAR(128), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ontology_object_types (id VARCHAR(64) PRIMARY KEY, api_name VARCHAR(128), type_name VARCHAR(128), display_name VARCHAR(128), display_label VARCHAR(128), description TEXT, primary_key_property VARCHAR(64) DEFAULT 'id', backing_table_or_view VARCHAR(128) DEFAULT 'entities', icon_name VARCHAR(64) DEFAULT 'fa-cube', properties_json TEXT, version INT DEFAULT 1, status VARCHAR(32) DEFAULT 'ACTIVE', created_by VARCHAR(128) NOT NULL DEFAULT 'System', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ontology_properties (id VARCHAR(64) PRIMARY KEY, object_type_id VARCHAR(64) NOT NULL, api_name VARCHAR(128) NOT NULL, display_name VARCHAR(128) NOT NULL, base_type VARCHAR(64) NOT NULL DEFAULT 'STRING', is_required BOOLEAN DEFAULT FALSE, is_searchable BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ontology_link_types (id VARCHAR(64) PRIMARY KEY, api_name VARCHAR(128), link_name VARCHAR(128), display_name VARCHAR(128), display_label VARCHAR(128), object_type_a VARCHAR(128), object_type_b VARCHAR(128), source_type VARCHAR(64), target_type VARCHAR(64), side_a_name VARCHAR(128), side_b_name VARCHAR(128), cardinality VARCHAR(32) DEFAULT 'MANY_TO_MANY', description TEXT, is_directional BOOLEAN DEFAULT TRUE, version INT DEFAULT 1, status VARCHAR(32) DEFAULT 'ACTIVE', created_by VARCHAR(128) NOT NULL DEFAULT 'System', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ontology_functions (id VARCHAR(64) PRIMARY KEY, api_name VARCHAR(128) NOT NULL UNIQUE, description TEXT, implementation_ref VARCHAR(256) NOT NULL, version INT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS ontology_action_types (id VARCHAR(64) PRIMARY KEY, api_name VARCHAR(128) NOT NULL UNIQUE, display_name VARCHAR(128) NOT NULL, target_object_type VARCHAR(128) NOT NULL, input_schema TEXT NOT NULL, function_id VARCHAR(64), version INT DEFAULT 1, status VARCHAR(32) DEFAULT 'ACTIVE', created_by VARCHAR(128) NOT NULL DEFAULT 'System', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS workbook_boards (id VARCHAR(64) PRIMARY KEY, title VARCHAR(256) NOT NULL, description TEXT, case_id VARCHAR(64) NOT NULL, query_config TEXT NOT NULL, owner_id VARCHAR(64) NOT NULL, owner_name VARCHAR(128) NOT NULL, is_shared BOOLEAN DEFAULT TRUE, execution_count INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS workshop_dashboards (id VARCHAR(64) PRIMARY KEY, title VARCHAR(256) NOT NULL, description TEXT, case_id VARCHAR(64) NOT NULL, layout_config TEXT NOT NULL, owner_id VARCHAR(64) NOT NULL, owner_name VARCHAR(128) NOT NULL, allowed_roles VARCHAR(256) DEFAULT 'Lead Investigator,Field Analyst', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS lineage_nodes (id VARCHAR(64) PRIMARY KEY, name VARCHAR(256) NOT NULL, node_type VARCHAR(64) NOT NULL, source_ref VARCHAR(256) NOT NULL, metadata TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS lineage_edges (id VARCHAR(64) PRIMARY KEY, source_node_id VARCHAR(64) NOT NULL, target_node_id VARCHAR(64) NOT NULL, transform_type VARCHAR(64) NOT NULL, confidence_score DOUBLE PRECISION DEFAULT 1.0, metadata TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS quiver_canvases (id VARCHAR(64) PRIMARY KEY, case_id VARCHAR(64) NOT NULL, title VARCHAR(256) NOT NULL, description TEXT, canvas_data TEXT NOT NULL, mode VARCHAR(32) DEFAULT 'CANVAS', owner_id VARCHAR(64) NOT NULL, owner_name VARCHAR(128) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS dossiers (id VARCHAR(64) PRIMARY KEY, case_id VARCHAR(64) NOT NULL, title VARCHAR(256) NOT NULL, summary TEXT, sections_json TEXT NOT NULL, linked_object_refs TEXT NOT NULL, author_id VARCHAR(64) NOT NULL, author_name VARCHAR(128) NOT NULL, status VARCHAR(32) DEFAULT 'DRAFT', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS automations (id VARCHAR(64) PRIMARY KEY, name VARCHAR(256) NOT NULL, description TEXT, condition_definition TEXT NOT NULL, proposed_action_type VARCHAR(128) NOT NULL, review_required BOOLEAN DEFAULT TRUE, enabled BOOLEAN DEFAULT TRUE, version INT DEFAULT 1, created_by VARCHAR(128) NOT NULL DEFAULT 'System', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS apollo_environments (id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL, environment_type VARCHAR(32) NOT NULL DEFAULT 'PROD', config_json TEXT NOT NULL, target_version VARCHAR(32) NOT NULL DEFAULT '2.0.0', current_version VARCHAR(32) NOT NULL DEFAULT '2.0.0', health_status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY', last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS apollo_release_plans (id VARCHAR(64) PRIMARY KEY, environment_id VARCHAR(64) NOT NULL, from_version VARCHAR(32) NOT NULL, to_version VARCHAR(32) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', approval_required BOOLEAN DEFAULT TRUE, approved_by VARCHAR(128), steps_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
      ];

      for (const sql of tables) {
        await this.pool.query(sql);
      }
      console.log('[POSTGRES DB] Unit-test schema tables initialized');
    } else {
      const migrationFiles = ['001_initial_schema.sql', '002_phase4_expansion.sql', '003_phase9_documents.sql', '004_phase10_ontology.sql', '005_ontology_core.sql', '006_lineage_engine.sql', '007_phase13_workspace.sql', '008_phase14_automate.sql', '009_phase15_apollo.sql'];
      for (const file of migrationFiles) {
        const migrationPath = path.join(__dirname, 'migrations', file);
        if (fs.existsSync(migrationPath)) {
          const migrationSql = fs.readFileSync(migrationPath, 'utf8');
          await this.pool.query(migrationSql);
          console.log(`[POSTGRES DB] SQL schema migration ${file} applied successfully`);
        }
      }
    }

    this.initialized = true;
  }

  async setSessionContext(client, user, caseId) {
    if (!this.isPgMem && client && user) {
      try {
        await client.query(`SET LOCAL app.current_user_id = '${user.id}'`);
        await client.query(`SET LOCAL app.current_user_role = '${user.role}'`);
        await client.query(`SET LOCAL app.current_user_org = '${user.organization}'`);
        if (caseId) {
          await client.query(`SET LOCAL app.current_case_id = '${caseId}'`);
        }
      } catch (e) {
        // Ignored in test fallback
      }
    }
  }

  async query(sql, params = []) {
    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  async queryOne(sql, params = []) {
    const res = await this.pool.query(sql, params);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async execute(sql, params = []) {
    return await this.pool.query(sql, params);
  }

  async withTransaction(callback) {
    const client = await this.pool.connect();
    let backup = null;
    if (this.isPgMem && this.memDb) {
      backup = this.memDb.backup();
    }
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (e) {}
      if (backup) {
        backup.restore();
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async logAudit(userId, username, action, moduleName, details, targetEntityId = null, caseId = null, dbClient = null) {
    const executor = dbClient || this.pool;
    
    let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    try {
      const lastRow = await executor.query(`SELECT hash FROM audit_events ORDER BY timestamp DESC, id DESC LIMIT 1`);
      if (lastRow.rows && lastRow.rows.length > 0) {
        prevHash = lastRow.rows[0].hash;
      }
    } catch (e) {}

    const timestamp = new Date().toISOString();
    const payloadStr = JSON.stringify({ userId, action, moduleName, details, targetEntityId, caseId, timestamp, prevHash });
    const hash = PostgreSQLDatabase.sha256(payloadStr);
    const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const sql = `
      INSERT INTO audit_events (id, user_id, username, action, module, details, target_entity_id, case_id, timestamp, prev_hash, hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    await executor.query(sql, [id, userId, username || 'System', action, moduleName, details || '', targetEntityId, caseId, timestamp, prevHash, hash]);

    const anchorLine = `${timestamp} | AUDIT_HEAD | id=${id} | hash=${hash} | prev=${prevHash}\n`;
    try {
      fs.appendFileSync(AUDIT_ANCHOR_PATH, anchorLine, 'utf8');
    } catch (e) {}

    return { id, userId, username, action, module: moduleName, details, targetEntityId, caseId, timestamp, prevHash, hash };
  }

  async emitOutboxEvent(aggregateType, aggregateId, eventType, payload, dbClient = null) {
    const executor = dbClient || this.pool;
    const id = `OUTBOX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    await executor.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
      [id, aggregateType, aggregateId, eventType, payloadStr]
    );
  }

  // --- Users Repository ---
  async getUserByUsername(username) {
    const u = await this.queryOne(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      organization: u.organization,
      jurisdiction: u.jurisdiction,
      purposeClearance: u.purpose_clearance,
      passwordHash: u.password_hash
    };
  }

  async getUserById(id) {
    const u = await this.queryOne(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      organization: u.organization,
      jurisdiction: u.jurisdiction,
      purposeClearance: u.purpose_clearance,
      passwordHash: u.password_hash
    };
  }

  // --- Cases Repository ---
  async getCases(filter = {}) {
    let sql = `SELECT * FROM cases WHERE 1=1`;
    const params = [];
    if (filter.caseId) {
      params.push(filter.caseId);
      sql += ` AND id = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC`;
    const rows = await this.query(sql, params);
    return rows.map(c => ({
      id: c.id,
      title: c.title,
      codeName: c.code_name,
      description: c.description,
      organization: c.organization,
      jurisdiction: c.jurisdiction,
      classification: c.classification_level,
      permittedPurposes: (c.permitted_purposes || '').split(','),
      status: c.status,
      targetEntityIds: c.target_entity_ids ? JSON.parse(c.target_entity_ids) : [],
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
  }

  async getCaseById(id) {
    const c = await this.queryOne(`SELECT * FROM cases WHERE id = $1`, [id]);
    if (!c) return null;
    return {
      id: c.id,
      title: c.title,
      codeName: c.code_name,
      description: c.description,
      organization: c.organization,
      jurisdiction: c.jurisdiction,
      classification: c.classification_level,
      permittedPurposes: (c.permitted_purposes || '').split(','),
      status: c.status,
      targetEntityIds: c.target_entity_ids ? JSON.parse(c.target_entity_ids) : [],
      createdAt: c.created_at,
      updatedAt: c.updated_at
    };
  }

  async getCaseAssignments(caseId) {
    const rows = await this.query(`SELECT user_id FROM case_assignments WHERE case_id = $1`, [caseId]);
    return rows.map(r => r.user_id);
  }

  // --- Entities Repository ---
  async getEntities(filter = {}) {
    let sql = `SELECT * FROM entities WHERE status != 'MERGED'`;
    const params = [];
    if (filter.type) {
      params.push(filter.type);
      sql += ` AND type = $${params.length}`;
    }
    const rows = await this.query(sql, params);
    let result = rows.map(e => ({
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: e.aliases ? JSON.parse(e.aliases) : [],
      identifierFields: e.identifier_fields ? JSON.parse(e.identifier_fields) : {},
      evidenceStatus: e.evidence_status,
      assertionClass: e.assertion_class,
      confidenceMethod: e.confidence_method,
      humanReviewStatus: e.human_review_status,
      reviewPriority: e.review_priority,
      status: e.status,
      canonicalEntityId: e.canonical_entity_id,
      version: e.version,
      isFictional: Boolean(e.is_fictional),
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
      createdAt: e.created_at,
      updatedAt: e.updated_at
    }));

    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.aliases && e.aliases.some(a => a.toLowerCase().includes(q))) ||
        (e.identifierFields && JSON.stringify(e.identifierFields).toLowerCase().includes(q))
      );
    }
    return result;
  }

  async getEntityById(id) {
    const e = await this.queryOne(`SELECT * FROM entities WHERE id = $1`, [id]);
    if (!e) return null;
    return {
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: e.aliases ? JSON.parse(e.aliases) : [],
      identifierFields: e.identifier_fields ? JSON.parse(e.identifier_fields) : {},
      evidenceStatus: e.evidence_status,
      assertionClass: e.assertion_class,
      confidenceMethod: e.confidence_method,
      humanReviewStatus: e.human_review_status,
      reviewPriority: e.review_priority,
      status: e.status,
      canonicalEntityId: e.canonical_entity_id,
      version: e.version,
      isFictional: Boolean(e.is_fictional),
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
      createdAt: e.created_at,
      updatedAt: e.updated_at
    };
  }

  // --- Evidence Repository ---
  async getEvidenceList(filter = {}) {
    let sql = `SELECT * FROM evidence_metadata WHERE 1=1`;
    const params = [];
    if (filter.caseId) {
      params.push(filter.caseId);
      sql += ` AND case_id = $${params.length}`;
    }
    const rows = await this.query(sql, params);
    const result = [];
    for (const ev of rows) {
      const ledgerRows = await this.query(`SELECT * FROM evidence_custody_ledger WHERE evidence_id = $1 ORDER BY timestamp ASC`, [ev.id]);
      const meta = ev.metadata ? JSON.parse(ev.metadata) : {};
      result.push({
        id: ev.id,
        title: ev.title,
        mediaType: ev.media_type,
        fileSize: ev.file_size,
        sha256: ev.sha256,
        objectKey: ev.object_key,
        versionId: ev.version_id,
        isOriginal: Boolean(ev.is_original),
        parentEvidenceId: ev.parent_evidence_id,
        classification: ev.classification,
        custodian: ev.custodian,
        sourceDevice: ev.source_device,
        caseId: ev.case_id,
        evidenceStatus: ev.evidence_status,
        humanReviewStatus: ev.human_review_status,
        reviewPriority: ev.review_priority,
        associatedEntityIds: meta.associatedEntityIds || [],
        chainOfCustody: ledgerRows.map(l => ({
          timestamp: l.timestamp,
          user: l.username,
          userId: l.user_id,
          action: l.action,
          notes: l.notes,
          hashSignature: l.hash_signature
        }))
      });
    }
    return result;
  }

  async getEvidenceById(id) {
    const list = await this.getEvidenceList();
    return list.find(e => e.id === id) || null;
  }

  // --- Phase 4 Repository Extensions ---
  async saveQuarantineRecord(sourceConnector, rawPayload, reason) {
    const id = `QUAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payloadStr = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
    const payloadHash = PostgreSQLDatabase.sha256(payloadStr);

    await this.execute(
      `INSERT INTO quarantine_records (id, source_connector, raw_payload, payload_hash, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'QUARANTINED')`,
      [id, sourceConnector, payloadStr, payloadHash, reason]
    );
    return id;
  }

  async createSensorAlert(alert) {
    const id = `ALT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO sensor_alerts (id, sensor_type, severity, case_id, entity_id, title, description, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'UNACKNOWLEDGED', $8)`,
      [
        id,
        alert.sensorType,
        alert.severity || 'HIGH',
        alert.caseId || null,
        alert.entityId || null,
        alert.title,
        alert.description,
        JSON.stringify(alert.metadata || {})
      ]
    );
    return id;
  }

  async getSensorAlerts(caseId) {
    let sql = `SELECT * FROM sensor_alerts WHERE 1=1`;
    const params = [];
    if (caseId) {
      params.push(caseId);
      sql += ` AND case_id = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT 50`;
    const rows = await this.query(sql, params);
    return rows.map(r => ({
      id: r.id,
      sensorType: r.sensor_type,
      severity: r.severity,
      caseId: r.case_id,
      entityId: r.entity_id,
      title: r.title,
      description: r.description,
      status: r.status,
      acknowledgedBy: r.acknowledged_by,
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
      createdAt: r.created_at
    }));
  }

  async acknowledgeSensorAlert(alertId, username) {
    await this.execute(
      `UPDATE sensor_alerts SET status = 'ACKNOWLEDGED', acknowledged_by = $1 WHERE id = $2`,
      [username, alertId]
    );
  }

  // --- Sources & Ingestion Methods ---
  async getSources() {
    return await this.query(`SELECT * FROM sources ORDER BY created_at DESC`);
  }

  async getSourceById(id) {
    return await this.queryOne(`SELECT * FROM sources WHERE id = $1`, [id]);
  }

  async createSource(src) {
    const id = src.id || `SRC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO sources (id, name, source_type, description, owner, classification, data_format, schema_version, enabled, trust_level, retention_policy, health_status, config_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        src.name,
        src.sourceType,
        src.description || '',
        src.owner || 'System',
        src.classification || 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY',
        src.dataFormat || 'JSON',
        src.schemaVersion || '1.0.0',
        src.enabled !== false,
        src.trustLevel || 'MEDIUM',
        src.retentionPolicy || '30_DAYS',
        src.healthStatus || 'HEALTHY',
        src.configRef || ''
      ]
    );
    return await this.getSourceById(id);
  }

  async getIngestionJobs(sourceId = null) {
    if (sourceId) {
      return await this.query(`SELECT * FROM ingestion_jobs WHERE source_id = $1 ORDER BY created_at DESC`, [sourceId]);
    }
    return await this.query(`SELECT * FROM ingestion_jobs ORDER BY created_at DESC LIMIT 50`);
  }

  async createIngestionJob(job) {
    const id = job.id || `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO ingestion_jobs (id, source_id, job_type, status, idempotency_key, total_records, processed_records, accepted_records, quarantined_records, duplicate_records, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
      [
        id,
        job.sourceId || null,
        job.jobType || 'LIVE_INGESTION',
        job.status || 'RUNNING',
        job.idempotencyKey || `key-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        job.totalRecords || 0,
        job.processedRecords || 0,
        job.acceptedRecords || 0,
        job.quarantinedRecords || 0,
        job.duplicateRecords || 0
      ]
    );
    return id;
  }

  async updateIngestionJob(id, updates) {
    await this.execute(
      `UPDATE ingestion_jobs SET 
         status = COALESCE($1, status),
         total_records = COALESCE($2, total_records),
         processed_records = COALESCE($3, processed_records),
         accepted_records = COALESCE($4, accepted_records),
         quarantined_records = COALESCE($5, quarantined_records),
         duplicate_records = COALESCE($6, duplicate_records),
         error_log = COALESCE($7, error_log),
         completed_at = CASE WHEN $1 IN ('COMPLETED', 'FAILED', 'QUARANTINED') THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = $8`,
      [
        updates.status || null,
        updates.totalRecords ?? null,
        updates.processedRecords ?? null,
        updates.acceptedRecords ?? null,
        updates.quarantinedRecords ?? null,
        updates.duplicateRecords ?? null,
        updates.errorLog || null,
        id
      ]
    );
  }

  async getQuarantineRecords() {
    return await this.query(`SELECT * FROM quarantine_records ORDER BY created_at DESC LIMIT 50`);
  }

  async saveDataQualityResult(dq) {
    const id = `DQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO data_quality_results 
       (id, job_id, source_id, completeness_score, validity_score, consistency_score, timeliness_score, uniqueness_score, source_reliability_score, overall_quality_grade, failed_rules, remediation_suggestions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        dq.jobId || null,
        dq.sourceId || null,
        dq.completeness ?? 0.95,
        dq.validity ?? 0.98,
        dq.consistency ?? 0.96,
        dq.timeliness ?? 0.99,
        dq.uniqueness ?? 0.94,
        dq.sourceReliability ?? 0.95,
        dq.overallGrade || 'EXCELLENT',
        JSON.stringify(dq.failedRules || []),
        JSON.stringify(dq.remediationSuggestions || [])
      ]
    );
    return id;
  }

  async getDataQualityResults() {
    return await this.query(`SELECT * FROM data_quality_results ORDER BY created_at DESC LIMIT 20`);
  }

  // --- Phase 5 Rules & Alerts Methods ---
  async getAnalyticsRules() {
    return await this.query(`SELECT * FROM analytics_rules ORDER BY created_at DESC`);
  }

  async createAnalyticsRule(rule) {
    const id = rule.id || `RULE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO analytics_rules 
       (id, name, description, rule_version, enabled, authorized_scope, spatial_window_meters, time_window_minutes, conditions_json, severity, cooldown_minutes, owner, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        rule.name,
        rule.description || '',
        rule.ruleVersion || 'v1.0.0',
        rule.enabled !== false,
        rule.authorizedScope || 'ORG-ALPHA',
        rule.spatialWindowMeters || 500,
        rule.timeWindowMinutes || 60,
        JSON.stringify(rule.conditions || {}),
        rule.severity || 'MEDIUM',
        rule.cooldownMinutes || 15,
        rule.owner || 'Supervisor Lead',
        rule.approvalStatus || 'APPROVED'
      ]
    );
    return id;
  }

  async getAlerts(filter = {}) {
    let sql = `SELECT * FROM alerts WHERE 1=1`;
    const params = [];
    if (filter.status) {
      params.push(filter.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filter.caseId) {
      params.push(filter.caseId);
      sql += ` AND case_id = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    return await this.query(sql, params);
  }

  async createAlert(alert) {
    const id = alert.id || `ALERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO alerts 
       (id, rule_id, title, description, severity, status, assigned_to, case_id, subject_entity_id, matched_conditions, evidence_ids, resolution_notes, sla_due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        alert.ruleId || null,
        alert.title,
        alert.description || 'Analytical rule alert trigger',
        alert.severity || 'HIGH',
        alert.status || 'NEW',
        alert.assignedTo || null,
        alert.caseId || null,
        alert.subjectEntityId || null,
        JSON.stringify(alert.matchedConditions || {}),
        JSON.stringify(alert.evidenceIds || []),
        alert.resolutionNotes || '',
        alert.slaDueAt || new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      ]
    );
    return id;
  }

  async updateAlertStatus(alertId, status, assignedTo = null, notes = null) {
    await this.execute(
      `UPDATE alerts SET 
         status = $1,
         assigned_to = COALESCE($2, assigned_to),
         resolution_notes = COALESCE($3, resolution_notes),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [status, assignedTo, notes, alertId]
    );
  }

  // --- Phase 6 AI & Governance Methods ---
  async getModelRegistry() {
    return await this.query(`SELECT * FROM model_registry ORDER BY created_at DESC`);
  }

  async createModelRegistryEntry(entry) {
    const id = entry.id || `MODEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO model_registry (id, model_name, model_version, provider, intended_use, prohibited_use, approval_status, deployment_status, known_limitations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        entry.modelName,
        entry.modelVersion,
        entry.provider || 'Internal Intelligence AI Engine',
        entry.intendedUse || 'Investigative lead generation',
        entry.prohibitedUse || 'Automated target scoring',
        entry.approvalStatus || 'APPROVED',
        entry.deploymentStatus || 'ACTIVE',
        entry.knownLimitations || 'Operational confidence scoring boundaries'
      ]
    );
    return id;
  }

  async getAIRuns(caseId = null) {
    if (caseId) {
      return await this.query(`SELECT * FROM ai_runs WHERE case_id = $1 ORDER BY created_at DESC`, [caseId]);
    }
    return await this.query(`SELECT * FROM ai_runs ORDER BY created_at DESC LIMIT 50`);
  }

  async createAIRun(run) {
    const id = run.id || `AIRUN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await this.execute(
      `INSERT INTO ai_runs (id, prompt_task, model_id, case_id, input_params, output_text, cited_evidence_ids, confidence_score, review_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        run.promptTask,
        run.modelId || null,
        run.caseId || null,
        JSON.stringify(run.inputParams || {}),
        run.outputText,
        JSON.stringify(run.citedEvidenceIds || []),
        run.confidenceScore ?? 0.92,
        run.reviewStatus || 'PENDING_REVIEW'
      ]
    );
    return id;
  }

  async updateAIRunStatus(id, reviewStatus, reviewer, notes) {
    await this.execute(
      `UPDATE ai_runs SET review_status = $1, reviewed_by = $2, reviewer_notes = $3 WHERE id = $4`,
      [reviewStatus, reviewer, notes, id]
    );
  }

  // --- Quiver Canvases Methods ---
  async getQuiverCanvases(caseId = null) {
    if (caseId) {
      return await this.query(`SELECT * FROM quiver_canvases WHERE case_id = $1 ORDER BY updated_at DESC`, [caseId]);
    }
    return await this.query(`SELECT * FROM quiver_canvases ORDER BY updated_at DESC`);
  }

  async getQuiverCanvasById(id) {
    return await this.queryOne(`SELECT * FROM quiver_canvases WHERE id = $1`, [id]);
  }

  async saveQuiverCanvas(canvas) {
    const id = canvas.id || `QUIVER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const existing = await this.getQuiverCanvasById(id);
    const canvasDataStr = typeof canvas.canvasData === 'string' ? canvas.canvasData : JSON.stringify(canvas.canvasData || {});

    if (existing) {
      await this.execute(
        `UPDATE quiver_canvases SET 
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           canvas_data = COALESCE($3, canvas_data),
           mode = COALESCE($4, mode),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [canvas.title || null, canvas.description || null, canvasDataStr, canvas.mode || 'CANVAS', id]
      );
    } else {
      await this.execute(
        `INSERT INTO quiver_canvases (id, case_id, title, description, canvas_data, mode, owner_id, owner_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          canvas.caseId || 'CASE-AP-2026-0001',
          canvas.title || 'Untitled Quiver Canvas',
          canvas.description || '',
          canvasDataStr,
          canvas.mode || 'CANVAS',
          canvas.ownerId || 'USR-101',
          canvas.ownerName || 'Lead Analyst'
        ]
      );
    }
    return await this.getQuiverCanvasById(id);
  }

  // --- Dossiers Methods ---
  async getDossiers(caseId = null) {
    if (caseId) {
      return await this.query(`SELECT * FROM dossiers WHERE case_id = $1 ORDER BY updated_at DESC`, [caseId]);
    }
    return await this.query(`SELECT * FROM dossiers ORDER BY updated_at DESC`);
  }

  async getDossierById(id) {
    return await this.queryOne(`SELECT * FROM dossiers WHERE id = $1`, [id]);
  }

  async saveDossier(dossier) {
    const id = dossier.id || `DOSSIER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const existing = await this.getDossierById(id);
    const sectionsStr = typeof dossier.sections === 'string' ? dossier.sections : JSON.stringify(dossier.sections || []);
    const refsStr = typeof dossier.linkedObjectRefs === 'string' ? dossier.linkedObjectRefs : JSON.stringify(dossier.linkedObjectRefs || []);

    if (existing) {
      await this.execute(
        `UPDATE dossiers SET 
           title = COALESCE($1, title),
           summary = COALESCE($2, summary),
           sections_json = COALESCE($3, sections_json),
           linked_object_refs = COALESCE($4, linked_object_refs),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [dossier.title || null, dossier.summary || null, sectionsStr, refsStr, dossier.status || 'DRAFT', id]
      );
    } else {
      await this.execute(
        `INSERT INTO dossiers (id, case_id, title, summary, sections_json, linked_object_refs, author_id, author_name, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          dossier.caseId || 'CASE-AP-2026-0001',
          dossier.title || 'Untitled Intelligence Dossier',
          dossier.summary || '',
          sectionsStr,
          refsStr,
          dossier.authorId || 'USR-101',
          dossier.authorName || 'Lead Analyst',
          dossier.status || 'DRAFT'
        ]
      );
    }
    return await this.getDossierById(id);
  }

  // --- Automate Engine Repository Methods ---
  async getAutomations() {
    return await this.query(`SELECT * FROM automations ORDER BY created_at DESC`);
  }

  async getAutomationById(id) {
    return await this.queryOne(`SELECT * FROM automations WHERE id = $1`, [id]);
  }

  async saveAutomation(rule) {
    const id = rule.id || `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const existing = await this.getAutomationById(id);
    const condStr = typeof rule.conditionDefinition === 'string' ? rule.conditionDefinition : JSON.stringify(rule.conditionDefinition || {});

    if (existing) {
      await this.execute(
        `UPDATE automations SET 
           name = COALESCE($1, name),
           description = COALESCE($2, description),
           condition_definition = COALESCE($3, condition_definition),
           proposed_action_type = COALESCE($4, proposed_action_type),
           enabled = COALESCE($5, enabled),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [rule.name || null, rule.description || null, condStr, rule.proposedActionType || null, rule.enabled ?? null, id]
      );
    } else {
      await this.execute(
        `INSERT INTO automations (id, name, description, condition_definition, proposed_action_type, review_required, enabled, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          rule.name,
          rule.description || '',
          condStr,
          rule.proposedActionType || 'FLAG_SUBJECT',
          rule.reviewRequired !== false,
          rule.enabled !== false,
          rule.createdBy || 'System'
        ]
      );
    }
    return await this.getAutomationById(id);
  }

  async toggleAutomation(id, enabled) {
    await this.execute(`UPDATE automations SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [enabled, id]);
  }

  // --- Apollo Release Orchestration Repository Methods ---
  async getApolloEnvironments() {
    return await this.query(`SELECT * FROM apollo_environments ORDER BY name ASC`);
  }

  async getApolloEnvironmentById(id) {
    return await this.queryOne(`SELECT * FROM apollo_environments WHERE id = $1`, [id]);
  }

  async saveApolloEnvironment(env) {
    const id = env.id || `ENV-${Date.now()}`;
    const existing = await this.getApolloEnvironmentById(id);
    const cfgStr = typeof env.configJson === 'string' ? env.configJson : JSON.stringify(env.configJson || {});

    if (existing) {
      await this.execute(
        `UPDATE apollo_environments SET
           name = COALESCE($1, name),
           environment_type = COALESCE($2, environment_type),
           config_json = COALESCE($3, config_json),
           target_version = COALESCE($4, target_version),
           current_version = COALESCE($5, current_version),
           health_status = COALESCE($6, health_status),
           last_ping = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [env.name || null, env.environmentType || null, cfgStr, env.targetVersion || null, env.currentVersion || null, env.healthStatus || null, id]
      );
    } else {
      await this.execute(
        `INSERT INTO apollo_environments (id, name, environment_type, config_json, target_version, current_version, health_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          env.name,
          env.environmentType || 'PROD',
          cfgStr,
          env.targetVersion || '2.0.0',
          env.currentVersion || '2.0.0',
          env.healthStatus || 'HEALTHY'
        ]
      );
    }
    return await this.getApolloEnvironmentById(id);
  }

  async getApolloReleasePlans() {
    return await this.query(`SELECT * FROM apollo_release_plans ORDER BY created_at DESC`);
  }

  async getApolloReleasePlanById(id) {
    return await this.queryOne(`SELECT * FROM apollo_release_plans WHERE id = $1`, [id]);
  }

  async saveApolloReleasePlan(plan) {
    const id = plan.id || `PLAN-${Date.now()}`;
    const existing = await this.getApolloReleasePlanById(id);
    const stepsStr = typeof plan.stepsJson === 'string' ? plan.stepsJson : JSON.stringify(plan.stepsJson || []);

    if (existing) {
      await this.execute(
        `UPDATE apollo_release_plans SET
           status = COALESCE($1, status),
           approved_by = COALESCE($2, approved_by),
           steps_json = COALESCE($3, steps_json),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [plan.status || null, plan.approvedBy || null, stepsStr, id]
      );
    } else {
      await this.execute(
        `INSERT INTO apollo_release_plans (id, environment_id, from_version, to_version, status, approval_required, approved_by, steps_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          plan.environmentId,
          plan.fromVersion || '2.0.0',
          plan.toVersion,
          plan.status || 'DRAFT',
          plan.approvalRequired !== false,
          plan.approvedBy || null,
          stepsStr
        ]
      );
    }
    return await this.getApolloReleasePlanById(id);
  }
}

const db = new PostgreSQLDatabase();
module.exports = db;
