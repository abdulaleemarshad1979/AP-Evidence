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

  async init(retries = 1, delayMs = 200) {
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
        `CREATE TABLE IF NOT EXISTS outbox_events (id VARCHAR(64) PRIMARY KEY, aggregate_type VARCHAR(64) NOT NULL, aggregate_id VARCHAR(64) NOT NULL, event_type VARCHAR(64) NOT NULL, payload TEXT NOT NULL, status VARCHAR(64) DEFAULT 'PENDING', attempts INT DEFAULT 0, last_error TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, processed_at TIMESTAMP);`
      ];

      for (const sql of tables) {
        await this.pool.query(sql);
      }
      console.log('[POSTGRES DB] Unit-test schema tables initialized');
    } else {
      const migrationPath = path.join(__dirname, 'migrations/001_initial_schema.sql');
      if (fs.existsSync(migrationPath)) {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        await this.pool.query(migrationSql);
        console.log('[POSTGRES DB] Initial SQL schema migration applied successfully');
      }
    }

    this.initialized = true;
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
}

const db = new PostgreSQLDatabase();
module.exports = db;
