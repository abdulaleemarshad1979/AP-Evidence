const { newDb } = require('pg-mem');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const STORE_PATH = path.join(DATA_DIR, 'postgres_store.json');

class PostgreSQLDatabase {
  constructor() {
    this.memDb = newDb();
    this.adapters = this.memDb.adapters;
    this.pg = this.memDb.adapters.createPg();
    this.pool = new this.pg.Pool();
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

    // Run SQL Migrations
    const migrationSql = fs.readFileSync(
      path.join(__dirname, 'migrations/001_initial_schema.sql'),
      'utf8'
    );
    this.memDb.public.none(migrationSql);

    // Load persistent snapshot if available
    if (fs.existsSync(STORE_PATH)) {
      try {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const snapshot = JSON.parse(raw);
        await this.restoreSnapshot(snapshot);
      } catch (err) {
        console.warn('[POSTGRES REPOSITORY] Snapshot load warning, starting clean:', err.message);
      }
    }

    this.initialized = true;
  }

  persistSnapshot() {
    try {
      const snapshot = {
        users: this.memDb.public.many(`SELECT * FROM users`),
        cases: this.memDb.public.many(`SELECT * FROM cases`),
        case_assignments: this.memDb.public.many(`SELECT * FROM case_assignments`),
        entities: this.memDb.public.many(`SELECT * FROM entities`),
        observations: this.memDb.public.many(`SELECT * FROM observations`),
        assertions: this.memDb.public.many(`SELECT * FROM assertions`),
        evidence_metadata: this.memDb.public.many(`SELECT * FROM evidence_metadata`),
        evidence_custody_ledger: this.memDb.public.many(`SELECT * FROM evidence_custody_ledger`),
        ingestion_batches: this.memDb.public.many(`SELECT * FROM ingestion_batches`),
        ingestion_rows: this.memDb.public.many(`SELECT * FROM ingestion_rows`),
        resolution_candidates: this.memDb.public.many(`SELECT * FROM resolution_candidates`),
        merge_history: this.memDb.public.many(`SELECT * FROM merge_history`),
        audit_events: this.memDb.public.many(`SELECT * FROM audit_events`),
        outbox_events: this.memDb.public.many(`SELECT * FROM outbox_events`)
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.error('[POSTGRES REPOSITORY] Persistence error:', err.message);
    }
  }

  async restoreSnapshot(snapshot) {
    const tableKeys = [
      'users', 'cases', 'case_assignments', 'entities', 'observations',
      'assertions', 'evidence_metadata', 'evidence_custody_ledger',
      'ingestion_batches', 'ingestion_rows', 'resolution_candidates',
      'merge_history', 'audit_events', 'outbox_events'
    ];

    for (const table of tableKeys) {
      if (Array.isArray(snapshot[table])) {
        this.memDb.public.none(`DELETE FROM ${table}`);
        for (const row of snapshot[table]) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;
          const cols = keys.join(', ');
          const vals = keys.map(k => {
            const v = row[k];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          this.memDb.public.none(`INSERT INTO ${table} (${cols}) VALUES (${vals})`);
        }
      }
    }
  }

  query(sql, params = []) {
    return this.memDb.public.many(sql, params);
  }

  queryOne(sql, params = []) {
    const res = this.memDb.public.many(sql, params);
    return res.length > 0 ? res[0] : null;
  }

  execute(sql, params = []) {
    this.memDb.public.none(sql, params);
    this.persistSnapshot();
  }

  // --- Audit Ledger ---
  logAudit(userId, username, action, moduleName, details, targetEntityId = null, caseId = null) {
    const logs = this.query(`SELECT hash FROM audit_events ORDER BY timestamp ASC, id ASC`);
    const prevHash = logs.length > 0
      ? logs[logs.length - 1].hash
      : '0000000000000000000000000000000000000000000000000000000000000000';

    const timestamp = new Date().toISOString();
    const payloadStr = JSON.stringify({ userId, action, moduleName, details, targetEntityId, caseId, timestamp, prevHash });
    const hash = PostgreSQLDatabase.sha256(payloadStr);
    const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const sql = `
      INSERT INTO audit_events (id, user_id, username, action, module, details, target_entity_id, case_id, timestamp, prev_hash, hash)
      VALUES ('${id}', '${userId}', '${username || 'System'}', '${action}', '${moduleName}', '${(details || '').replace(/'/g, "''")}', ${targetEntityId ? `'${targetEntityId}'` : 'NULL'}, ${caseId ? `'${caseId}'` : 'NULL'}, '${timestamp}', '${prevHash}', '${hash}')
    `;
    this.execute(sql);
    return { id, userId, username, action, module: moduleName, details, targetEntityId, caseId, timestamp, prevHash, hash };
  }

  // --- Transactional Outbox ---
  emitOutboxEvent(aggregateType, aggregateId, eventType, payload) {
    const id = `OUTBOX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const sql = `
      INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
      VALUES ('${id}', '${aggregateType}', '${aggregateId}', '${eventType}', '${payloadStr.replace(/'/g, "''")}', 'PENDING')
    `;
    this.execute(sql);
  }

  // --- Users ---
  getUserByUsername(username) {
    const u = this.queryOne(`SELECT * FROM users WHERE LOWER(username) = LOWER('${username.replace(/'/g, "''")}')`);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      organization: u.organization,
      jurisdiction: u.jurisdiction,
      purposeClearance: u.purpose_clearance
    };
  }

  getUserById(id) {
    const u = this.queryOne(`SELECT * FROM users WHERE id = '${id.replace(/'/g, "''")}'`);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      organization: u.organization,
      jurisdiction: u.jurisdiction,
      purposeClearance: u.purpose_clearance
    };
  }

  // --- Cases ---
  getCases() {
    const rows = this.query(`SELECT * FROM cases ORDER BY created_at DESC`);
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

  getCaseById(id) {
    const c = this.queryOne(`SELECT * FROM cases WHERE id = '${id.replace(/'/g, "''")}'`);
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

  getCaseAssignments(caseId) {
    const rows = this.query(`SELECT user_id FROM case_assignments WHERE case_id = '${caseId}'`);
    return rows.map(r => r.user_id);
  }

  // --- Entities ---
  getEntities(filter = {}) {
    let sql = `SELECT * FROM entities WHERE 1=1`;
    if (filter.type) {
      sql += ` AND type = '${filter.type}'`;
    }
    const rows = this.query(sql);
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

  getEntityById(id) {
    const e = this.queryOne(`SELECT * FROM entities WHERE id = '${id.replace(/'/g, "''")}'`);
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
      isFictional: Boolean(e.is_fictional),
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
      createdAt: e.created_at,
      updatedAt: e.updated_at
    };
  }

  // Backwards compatibility property getters
  get users() { return this.query('SELECT * FROM users'); }
  get cases() { return this.getCases(); }
  get entities() { return this.getEntities(); }
  get relationships() {
    const rows = this.query('SELECT * FROM assertions');
    return rows.map(a => ({
      id: a.id,
      source: a.subject_entity_id,
      target: a.object_entity_id,
      caseId: a.case_id,
      type: a.relation_type,
      confidence: a.confidence_score,
      confidenceMethod: a.confidence_method,
      assertionClass: a.assertion_class,
      humanReviewStatus: a.human_review_status,
      reviewPriority: a.review_priority,
      evidenceRef: a.evidence_id
    }));
  }
  get events() {
    const rows = this.query('SELECT * FROM observations');
    return rows.map(o => {
      const raw = o.raw_data ? JSON.parse(o.raw_data) : {};
      return {
        id: o.id,
        eventType: o.observation_type,
        timestamp: o.timestamp,
        locationName: o.location_name,
        latitude: o.latitude,
        longitude: o.longitude,
        confidence: o.confidence_score,
        evidenceStatus: o.evidence_status,
        caseId: o.case_id,
        associatedEntityIds: [o.entity_id],
        description: raw.description || `Observation ${o.id}`,
        evidenceRef: o.evidence_id
      };
    });
  }
  get evidence() {
    const rows = this.query('SELECT * FROM evidence_metadata');
    return rows.map(ev => {
      const ledgerRows = this.query(`SELECT * FROM evidence_custody_ledger WHERE evidence_id = '${ev.id}' ORDER BY timestamp ASC`);
      const meta = ev.metadata ? JSON.parse(ev.metadata) : {};
      return {
        id: ev.id,
        title: ev.title,
        mediaType: ev.media_type,
        fileSize: ev.file_size,
        sha256: ev.sha256,
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
      };
    });
  }
  get resolutionCandidates() {
    const rows = this.query('SELECT * FROM resolution_candidates');
    return rows.map(rc => ({
      id: rc.id,
      entityA: rc.entity_a,
      entityB: rc.entity_b,
      ruleVersion: rc.rule_version,
      matchScore: rc.match_score,
      comparedFields: rc.compared_fields ? JSON.parse(rc.compared_fields) : [],
      individualScores: rc.individual_scores ? JSON.parse(rc.individual_scores) : {},
      conflicts: rc.conflicts ? JSON.parse(rc.conflicts) : [],
      humanReviewStatus: rc.human_review_status,
      reviewPriority: rc.review_priority,
      status: rc.status,
      reviewer: rc.reviewer,
      decisionReason: rc.decision_reason,
      reasons: (rc.compared_fields ? JSON.parse(rc.compared_fields) : []).map(f => ({
        feature: f,
        score: (rc.individual_scores ? JSON.parse(rc.individual_scores) : {})[f] || 0.8,
        note: `Matched feature ${f}`
      })),
      createdAt: rc.created_at,
      updatedAt: rc.updated_at
    }));
  }
  get auditLogs() {
    return this.query('SELECT id, user_id as "userId", username, action, module, details, target_entity_id as "targetEntityId", case_id as "caseId", timestamp, prev_hash as "prevHash", hash FROM audit_events ORDER BY timestamp ASC');
  }
  get imports() {
    const rows = this.query('SELECT * FROM ingestion_batches ORDER BY created_at DESC');
    return rows.map(b => ({
      batchId: b.id,
      sourceFeed: b.source_feed,
      feedType: b.feed_type,
      totalRecords: b.total_records,
      acceptedRecords: b.accepted_records,
      rejectedRecords: b.rejected_records,
      duplicateRecords: b.duplicate_records,
      quarantinedRecords: b.quarantined_records,
      status: b.status,
      payloadHash: b.payload_hash,
      reconciliationSummary: b.reconciliation_summary ? JSON.parse(b.reconciliation_summary) : {},
      timestamp: b.created_at
    }));
  }
}

const db = new PostgreSQLDatabase();
module.exports = db;
