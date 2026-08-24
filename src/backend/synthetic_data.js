const crypto = require('crypto');

async function generateSyntheticData(db) {
  console.log('[SYNTHETIC ENGINE] Initializing PostgreSQL database with synthetic intelligence dataset...');

  // Ensure DB initialized
  await db.init();

  // Clean existing tables inside a transaction
  await db.withTransaction(async (client) => {
    await client.query(`DELETE FROM users`);
    await client.query(`DELETE FROM case_assignments`);
    await client.query(`DELETE FROM cases`);
    await client.query(`DELETE FROM entities`);
    await client.query(`DELETE FROM observations`);
    await client.query(`DELETE FROM assertions`);
    await client.query(`DELETE FROM evidence_custody_ledger`);
    await client.query(`DELETE FROM evidence_metadata`);
    await client.query(`DELETE FROM ingestion_rows`);
    await client.query(`DELETE FROM ingestion_batches`);
    await client.query(`DELETE FROM resolution_candidates`);
    await client.query(`DELETE FROM merge_history`);
    await client.query(`DELETE FROM outbox_events`);

    // 1. Users (ABAC Attributes)
    const users = [
      { id: 'USR-101', username: 'analyst_lead', name: 'Analyst Lead (Synthetic User)', role: 'Analyst', org: 'ORG-ALPHA', jur: 'JUR-UK', purpose: 'COUNTER_TERRORISM' },
      { id: 'USR-102', username: 'case_manager', name: 'Case Manager (Synthetic User)', role: 'Case Manager', org: 'ORG-ALPHA', jur: 'JUR-UK', purpose: 'COUNTER_TERRORISM' },
      { id: 'USR-103', username: 'compliance_auditor', name: 'Auditor (Synthetic User)', role: 'Auditor', org: 'ORG-ALPHA', jur: 'JUR-GLOBAL', purpose: 'AUDIT_OVERSIGHT' },
      { id: 'USR-104', username: 'sys_admin', name: 'System Admin (Synthetic User)', role: 'Admin', org: 'ORG-ALPHA', jur: 'JUR-GLOBAL', purpose: 'SYSTEM_ADMIN' },
      { id: 'USR-105', username: 'unassigned_analyst', name: 'Unassigned Analyst (Foreign Org/Jur)', role: 'Analyst', org: 'ORG-BETA', jur: 'JUR-US', purpose: 'CYBER_INTEL' }
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, username, name, role, organization, jurisdiction, purpose_clearance)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [u.id, u.username, u.name, u.role, u.org, u.jur, u.purpose]
      );
    }

    // 2. Cases
    const cases = [
      {
        id: 'CASE-SYN-0001',
        title: 'Synthetic Case Alpha (Fictional Operation)',
        codeName: 'CASE_SYN_ALPHA',
        description: 'Fictional synthetic spatio-temporal intelligence scenario tracking synthetic test entities across London, Zurich, and Dubai nodes.',
        organization: 'ORG-ALPHA',
        jurisdiction: 'JUR-UK',
        classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
        purposes: 'COUNTER_TERRORISM,TRAINING',
        status: 'ACTIVE',
        targetEntityIds: JSON.stringify(['SUB-00001', 'SUB-00002', 'SUB-00003', 'FIN-SYN-0001', 'VEH-SYN-0001'])
      },
      {
        id: 'CASE-SYN-0002',
        title: 'Synthetic Case Beta (Fictional Operation)',
        codeName: 'CASE_SYN_BETA',
        description: 'Fictional synthetic network mapping scenario restricted to authorized regional personnel.',
        organization: 'ORG-ALPHA',
        jurisdiction: 'JUR-UK',
        classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
        purposes: 'COUNTER_TERRORISM',
        status: 'ACTIVE',
        targetEntityIds: JSON.stringify(['SUB-00003', 'TEL-SYN-0001'])
      }
    ];

    for (const c of cases) {
      await client.query(
        `INSERT INTO cases (id, title, code_name, description, organization, jurisdiction, classification_level, permitted_purposes, status, target_entity_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [c.id, c.title, c.codeName, c.description, c.organization, c.jurisdiction, c.classification, c.purposes, c.status, c.targetEntityIds]
      );
    }

    // Case assignments
    await client.query(`INSERT INTO case_assignments (case_id, user_id) VALUES ('CASE-SYN-0001', 'USR-101')`);
    await client.query(`INSERT INTO case_assignments (case_id, user_id) VALUES ('CASE-SYN-0001', 'USR-102')`);
    await client.query(`INSERT INTO case_assignments (case_id, user_id) VALUES ('CASE-SYN-0002', 'USR-101')`);

    // 3. Fictional Synthetic Entities
    const entities = [
      {
        id: 'SUB-00001',
        type: 'Person',
        name: 'Synthetic Subject SYN-00001 (Fictional Person)',
        aliases: JSON.stringify(['Synthetic Alias Alpha', 'Sub-001']),
        identifierFields: JSON.stringify({ passportNo: 'SYN-GB-99201488', primaryPhone: '+44-7700-900412', nationality: 'Synthetic Country A' }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'DETERMINISTIC_EXACT_MATCH',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P1_HIGH',
        isFictional: true,
        metadata: JSON.stringify({ primaryLocation: 'Synthetic London Node', notes: 'Synthetic subject entity created for algorithm testing.' })
      },
      {
        id: 'SUB-00002',
        type: 'Person',
        name: 'Synthetic Subject SYN-00002 (Fictional Person)',
        aliases: JSON.stringify(['Synthetic Alias Beta', 'Sub-002']),
        identifierFields: JSON.stringify({ passportNo: 'SYN-EE-44910293', primaryPhone: '+372-555-0149', nationality: 'Synthetic Country B' }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'DETERMINISTIC_EXACT_MATCH',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P2_MEDIUM',
        isFictional: true,
        metadata: JSON.stringify({ primaryLocation: 'Synthetic Tallinn Node', notes: 'Synthetic financial associate entity.' })
      },
      {
        id: 'SUB-00003',
        type: 'Person',
        name: 'Synthetic Subject SYN-00003 (Fictional Person)',
        aliases: JSON.stringify(['Synthetic Alias Gamma', 'Sub-003']),
        identifierFields: JSON.stringify({ passportNo: 'SYN-AE-77109283', primaryPhone: '+971-50-123-4567', nationality: 'Synthetic Country C' }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'DETERMINISTIC_EXACT_MATCH',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P2_MEDIUM',
        isFictional: true,
        metadata: JSON.stringify({ primaryLocation: 'Synthetic Dubai Node', notes: 'Synthetic logistics associate entity.' })
      },
      {
        id: 'SUB-00004',
        type: 'Person',
        name: 'Synthetic Subject Candidate SYN-00004 (Unverified Candidate)',
        aliases: JSON.stringify(['Synthetic Alias Candidate', 'Sub-004-Candidate']),
        identifierFields: JSON.stringify({ passportNo: 'SYN-GB-99201488', primaryPhone: '+44-7700-900412', nationality: 'Synthetic Country A' }),
        evidenceStatus: 'DERIVED_ANALYSIS',
        assertionClass: 'ALGORITHMIC_CANDIDATE',
        confidenceMethod: 'PROBABILISTIC_JARO_WINKLER',
        humanReviewStatus: 'PENDING_REVIEW',
        reviewPriority: 'P1_HIGH',
        isFictional: true,
        metadata: JSON.stringify({ primaryLocation: 'Synthetic Heathrow Node', notes: 'Automated entity resolution scan match candidate.' })
      },
      {
        id: 'VEH-SYN-0001',
        type: 'Vehicle',
        name: 'Synthetic Vehicle VEH-SYN-0001 (Fictional Armored SUV)',
        aliases: JSON.stringify(['Obsidian Black Bentayga']),
        identifierFields: JSON.stringify({ licensePlate: 'SYN-KX71-FZX', vin: 'SYN-SJAAC2ZY9MC019283' }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'DETERMINISTIC_EXACT_MATCH',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P2_MEDIUM',
        isFictional: true,
        metadata: JSON.stringify({ registeredOwner: 'SUB-00001' })
      },
      {
        id: 'VEH-SYN-0002',
        type: 'Vehicle',
        name: 'Synthetic Vehicle VEH-SYN-0002 (Fictional Silver SUV)',
        aliases: JSON.stringify(['Iridium Silver G63']),
        identifierFields: JSON.stringify({ licensePlate: 'SYN-LX69-WYZ', vin: 'SYN-W1N4632761X091823' }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'DETERMINISTIC_EXACT_MATCH',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P3_LOW',
        isFictional: true,
        metadata: JSON.stringify({ registeredOwner: 'SUB-00002' })
      },
      {
        id: 'TEL-SYN-0001',
        type: 'Telecom',
        name: 'Synthetic Telecom Line TEL-SYN-0001 (Fictional Line)',
        aliases: JSON.stringify(['Bearer Line 4412']),
        identifierFields: JSON.stringify({ msisdn: '+44-7700-900412', imsi: '234159012345678', imei: '358910091234560' }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'DETERMINISTIC_EXACT_MATCH',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P2_MEDIUM',
        isFictional: true,
        metadata: JSON.stringify({ carrier: 'Synthetic Secure Telecom Provider' })
      },
      {
        id: 'FIN-SYN-0001',
        type: 'FinancialAccount',
        name: 'Synthetic Account FIN-SYN-0001 (Fictional Bank Account)',
        aliases: JSON.stringify(['Offshore Vault Account 88192']),
        identifierFields: JSON.stringify({ accountNumber: 'SYN-CH93-0024-8819-2091-8', bankName: 'Synthetic Helvetia Bank' }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'DETERMINISTIC_EXACT_MATCH',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P1_HIGH',
        isFictional: true,
        metadata: JSON.stringify({ accountHolder: 'SUB-00001' })
      },
      {
        id: 'LOC-SYN-0001',
        type: 'Location',
        name: 'Synthetic Location LOC-SYN-0001 (London Complex)',
        aliases: JSON.stringify(['London Curzon Node']),
        identifierFields: JSON.stringify({ address: '14 Curzon Street, London, UK', latitude: 51.5074, longitude: -0.1478 }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'LEAFLET_GEO_TEMPORAL',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P2_MEDIUM',
        isFictional: true,
        metadata: JSON.stringify({ facilityType: 'Synthetic Safehouse Facility' })
      },
      {
        id: 'LOC-SYN-0002',
        type: 'Location',
        name: 'Synthetic Location LOC-SYN-0002 (Zurich Hub)',
        aliases: JSON.stringify(['Zurich Gotthard Node']),
        identifierFields: JSON.stringify({ address: 'Gotthardstrasse 26, Zürich, Switzerland', latitude: 47.3667, longitude: 8.5333 }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'LEAFLET_GEO_TEMPORAL',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P3_LOW',
        isFictional: true,
        metadata: JSON.stringify({ facilityType: 'Synthetic Office Facility' })
      },
      {
        id: 'LOC-SYN-0003',
        type: 'Location',
        name: 'Synthetic Location LOC-SYN-0003 (Dubai Gate)',
        aliases: JSON.stringify(['Dubai Marina Gate Node']),
        identifierFields: JSON.stringify({ address: 'Marina Gate 1, Dubai, UAE', latitude: 25.0805, longitude: 55.1403 }),
        evidenceStatus: 'VERIFIED_RAW',
        assertionClass: 'CONFIRMED_FACT',
        confidenceMethod: 'LEAFLET_GEO_TEMPORAL',
        humanReviewStatus: 'UNREVIEWED',
        reviewPriority: 'P2_MEDIUM',
        isFictional: true,
        metadata: JSON.stringify({ facilityType: 'Synthetic Residence Facility' })
      }
    ];

    for (const e of entities) {
      await client.query(
        `INSERT INTO entities (id, type, name, aliases, identifier_fields, evidence_status, assertion_class, confidence_method, human_review_status, review_priority, is_fictional, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)`,
        [e.id, e.type, e.name, e.aliases, e.identifierFields, e.evidenceStatus, e.assertionClass, e.confidenceMethod, e.humanReviewStatus, e.reviewPriority, e.metadata]
      );
    }

    // 4. Evidence Metadata & Custody Ledger
    const rawPayload1 = "SYNTHETIC_CCTV_FRAME_20260824_MAYFAIR_060000_RAW_CAPTURE";
    const rawPayload2 = "SYNTHETIC_CDR_PCAP_STREAM_20260824_061500_CELL_LON881";
    const rawPayload3 = "SYNTHETIC_SWIFT_WIRE_ACKNOWLEDGEMENT_ZURICH_88192";

    const sha1 = crypto.createHash('sha256').update(rawPayload1).digest('hex');
    const sha2 = crypto.createHash('sha256').update(rawPayload2).digest('hex');
    const sha3 = crypto.createHash('sha256').update(rawPayload3).digest('hex');

    const evidenceItems = [
      {
        id: 'EVI-SYN-0001',
        title: 'Synthetic CCTV Frame Capture #4819 (London Node)',
        mediaType: 'IMAGE_JPEG',
        fileSize: '4.2 MB',
        sha256: sha1,
        isOriginal: true,
        parentId: null,
        custodian: 'Analyst Lead (Synthetic User)',
        sourceDevice: 'Synthetic CCTV Cam #42',
        caseId: 'CASE-SYN-0001',
        status: 'VERIFIED_RAW',
        meta: JSON.stringify({ associatedEntityIds: ['SUB-00001', 'VEH-SYN-0001', 'LOC-SYN-0001'] })
      },
      {
        id: 'EVI-SYN-0002',
        title: 'Synthetic Telecom CDR Packet Stream (London Node)',
        mediaType: 'AUDIO_RAW_PCAP',
        fileSize: '18.7 MB',
        sha256: sha2,
        isOriginal: true,
        parentId: null,
        custodian: 'Case Manager (Synthetic User)',
        sourceDevice: 'Synthetic Intercept Sensor #882',
        caseId: 'CASE-SYN-0001',
        status: 'VERIFIED_RAW',
        meta: JSON.stringify({ associatedEntityIds: ['SUB-00001', 'SUB-00003', 'TEL-SYN-0001'] })
      },
      {
        id: 'EVI-SYN-0003',
        title: 'Synthetic SWIFT Receipt Log & Derived Analysis',
        mediaType: 'PDF_DOCUMENT',
        fileSize: '840 KB',
        sha256: sha3,
        isOriginal: false,
        parentId: 'EVI-SYN-0001',
        custodian: 'Analyst Lead (Synthetic User)',
        sourceDevice: 'Synthetic Financial Monitor',
        caseId: 'CASE-SYN-0001',
        status: 'DERIVED_ANALYSIS',
        meta: JSON.stringify({ associatedEntityIds: ['SUB-00001', 'FIN-SYN-0001'] })
      }
    ];

    for (const ev of evidenceItems) {
      await client.query(
        `INSERT INTO evidence_metadata (id, title, media_type, file_size, sha256, is_original, parent_evidence_id, classification, custodian, source_device, case_id, evidence_status, human_review_status, review_priority, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE', $8, $9, $10, $11, 'UNREVIEWED', 'P2_MEDIUM', $12)`,
        [ev.id, ev.title, ev.mediaType, ev.fileSize, ev.sha256, ev.isOriginal, ev.parentId, ev.custodian, ev.sourceDevice, ev.caseId, ev.status, ev.meta]
      );

      const custHash = crypto.createHash('sha256').update(`${ev.id}:INGESTED_AND_HASHED:USR-101`).digest('hex');
      await client.query(
        `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
         VALUES ($1, $2, '2026-08-24T06:01:00Z', 'USR-101', 'Analyst Lead (Synthetic User)', 'INGESTED_AND_HASHED', 'SHA-256 integrity verified upon synthetic ingestion.', $3)`,
        [`CUST-${ev.id}-1`, ev.id, custHash]
      );
    }

    // 5. Observations (Spatio-Temporal Events)
    const observations = [
      {
        id: 'OBS-SYN-1001',
        entityId: 'SUB-00001',
        caseId: 'CASE-SYN-0001',
        type: 'CCTV_DETECTION',
        timestamp: '2026-08-24T06:00:00Z',
        locName: 'London Curzon CCTV Node 42',
        lat: 51.5074,
        lng: -0.1478,
        confidence: 0.96,
        evidenceStatus: 'VERIFIED_RAW',
        evidenceId: 'EVI-SYN-0001',
        raw: JSON.stringify({ description: 'Facial recognition match (96.4%) for Synthetic Subject SUB-00001 exiting SUV VEH-SYN-0001.' })
      },
      {
        id: 'OBS-SYN-1002',
        entityId: 'SUB-00001',
        caseId: 'CASE-SYN-0001',
        type: 'CDR_CALL_HOP',
        timestamp: '2026-08-24T06:15:00Z',
        locName: 'London Hyde Park Cell Tower UK-881',
        lat: 51.5085,
        lng: -0.1550,
        confidence: 0.92,
        evidenceStatus: 'VERIFIED_RAW',
        evidenceId: 'EVI-SYN-0002',
        raw: JSON.stringify({ description: 'Encrypted telemetry ping initiated from TEL-SYN-0001 to Dubai node +971-50-123-4567.' })
      },
      {
        id: 'OBS-SYN-1003',
        entityId: 'SUB-00002',
        caseId: 'CASE-SYN-0001',
        type: 'LPR_SIGHTING',
        timestamp: '2026-08-24T06:30:00Z',
        locName: 'Heathrow Airport Terminal 5 LPR Gate B',
        lat: 51.4700,
        lng: -0.4543,
        confidence: 0.99,
        evidenceStatus: 'VERIFIED_RAW',
        evidenceId: 'EVI-SYN-0003',
        raw: JSON.stringify({ description: 'LPR scan logged Synthetic Silver SUV VEH-SYN-0002 entering VIP Terminal.' })
      },
      {
        id: 'OBS-SYN-1004',
        entityId: 'SUB-00001',
        caseId: 'CASE-SYN-0001',
        type: 'BANK_TRANSACTION',
        timestamp: '2026-08-24T06:45:00Z',
        locName: 'Zurich Financial Terminal #099',
        lat: 47.3667,
        lng: 8.5333,
        confidence: 1.0,
        evidenceStatus: 'VERIFIED_RAW',
        evidenceId: 'EVI-SYN-0003',
        raw: JSON.stringify({ description: 'Synthetic ledger wire transfer of €4,500,000 executed from FIN-SYN-0001.' })
      },
      {
        id: 'OBS-SYN-1005',
        entityId: 'SUB-00003',
        caseId: 'CASE-SYN-0001',
        type: 'CCTV_DETECTION',
        timestamp: '2026-08-24T07:10:00Z',
        locName: 'Dubai Airport Private Helipad Node',
        lat: 25.2532,
        lng: 55.3657,
        confidence: 0.94,
        evidenceStatus: 'VERIFIED_RAW',
        evidenceId: 'EVI-SYN-0003',
        raw: JSON.stringify({ description: 'CCTV facial match for Synthetic Subject SUB-00003 meeting passenger.' })
      }
    ];

    for (const o of observations) {
      if (db.isPgMem) {
        await client.query(
          `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [o.id, o.entityId, o.caseId, o.type, o.timestamp, o.locName, o.lat, o.lng, o.confidence, o.evidenceStatus, o.raw, o.evidenceId]
        );
      } else {
        await client.query(
          `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, location_geom, confidence_score, evidence_status, raw_data, evidence_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography, $9, $10, $11, $12)`,
          [o.id, o.entityId, o.caseId, o.type, o.timestamp, o.locName, o.lat, o.lng, o.confidence, o.evidenceStatus, o.raw, o.evidenceId]
        );
      }
    }

    // 6. Assertions (Relationships)
    const assertions = [
      { id: 'AST-SYN-101', sub: 'SUB-00001', obj: 'SUB-00002', caseId: 'CASE-SYN-0001', rel: 'CO_TRAVELER_ASSOCIATE', conf: 0.96, method: 'PROBABILISTIC_JARO_WINKLER', classType: 'CORRELATED', reviewStatus: 'UNREVIEWED', priority: 'P2_MEDIUM', ev: 'EVI-SYN-0001' },
      { id: 'AST-SYN-102', sub: 'SUB-00001', obj: 'SUB-00003', caseId: 'CASE-SYN-0001', rel: 'ENCRYPTED_CALL_COMMUNICATION', conf: 0.91, method: 'DETERMINISTIC_EXACT_MATCH', classType: 'CONFIRMED_FACT', reviewStatus: 'UNREVIEWED', priority: 'P2_MEDIUM', ev: 'EVI-SYN-0002' },
      { id: 'AST-SYN-103', sub: 'SUB-00001', obj: 'VEH-SYN-0001', caseId: 'CASE-SYN-0001', rel: 'OWNS_OPERATES', conf: 0.99, method: 'DETERMINISTIC_EXACT_MATCH', classType: 'CONFIRMED_FACT', reviewStatus: 'UNREVIEWED', priority: 'P2_MEDIUM', ev: 'EVI-SYN-0001' },
      { id: 'AST-SYN-104', sub: 'SUB-00002', obj: 'VEH-SYN-0002', caseId: 'CASE-SYN-0001', rel: 'REGISTERED_OWNER', conf: 0.98, method: 'DETERMINISTIC_EXACT_MATCH', classType: 'CONFIRMED_FACT', reviewStatus: 'UNREVIEWED', priority: 'P3_LOW', ev: 'EVI-SYN-0003' },
      { id: 'AST-SYN-105', sub: 'SUB-00001', obj: 'FIN-SYN-0001', caseId: 'CASE-SYN-0001', rel: 'BENEFICIAL_OWNER', conf: 0.97, method: 'DETERMINISTIC_EXACT_MATCH', classType: 'CONFIRMED_FACT', reviewStatus: 'UNREVIEWED', priority: 'P1_HIGH', ev: 'EVI-SYN-0003' },
      { id: 'AST-SYN-106', sub: 'SUB-00001', obj: 'LOC-SYN-0001', caseId: 'CASE-SYN-0001', rel: 'FREQUENTS_SAFEHOUSE', conf: 0.94, method: 'LEAFLET_GEO_TEMPORAL', classType: 'CORRELATED', reviewStatus: 'UNREVIEWED', priority: 'P2_MEDIUM', ev: 'EVI-SYN-0001' }
    ];

    for (const a of assertions) {
      await client.query(
        `INSERT INTO assertions (id, subject_entity_id, object_entity_id, case_id, relation_type, confidence_score, confidence_method, assertion_class, human_review_status, review_priority, evidence_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [a.id, a.sub, a.obj, a.caseId, a.rel, a.conf, a.method, a.classType, a.reviewStatus, a.priority, a.ev]
      );
    }

    // 7. Candidate Resolution Workflows
    const comparedFields = JSON.stringify(['name', 'primaryPhone', 'passportNo', 'dob']);
    const individualScores = JSON.stringify({ name: 0.92, primaryPhone: 1.0, passportNo: 1.0, dob: 1.0 });
    const conflicts = JSON.stringify([{ field: 'primaryLocation', valA: 'Synthetic London Node', valB: 'Synthetic Heathrow Node' }]);

    await client.query(
      `INSERT INTO resolution_candidates (id, entity_a, entity_b, rule_version, match_score, compared_fields, individual_scores, conflicts, human_review_status, review_priority, reviewer, decision_reason, status)
       VALUES ('RES-SYN-301', 'SUB-00001', 'SUB-00004', 'v2.1-deterministic-probabilistic', 0.94, $1, $2, $3, 'PENDING_REVIEW', 'P1_HIGH', NULL, NULL, 'PENDING_REVIEW')`,
      [comparedFields, individualScores, conflicts]
    );

    // 8. Initial Audit Log Entries inside transaction
    await db.logAudit('USR-101', 'Analyst Lead (Synthetic User)', 'SYSTEM_INITIALIZATION', 'Platform', 'System initialized with PostgreSQL synthetic dataset.', null, 'CASE-SYN-0001', client);
    await db.logAudit('USR-101', 'Analyst Lead (Synthetic User)', 'READ', 'Subject 360', 'Accessed Subject 360 profile for SUB-00001', 'SUB-00001', 'CASE-SYN-0001', client);
    await db.logAudit('USR-102', 'Case Manager (Synthetic User)', 'SEARCH', 'Graph Engine', 'Queried synthetic network graph', 'SUB-00001', 'CASE-SYN-0001', client);

    // Emit initial Outbox event inside transaction
    await db.emitOutboxEvent('SYSTEM', 'SYS-001', 'DATASET_SEEDED', { totalEntities: 11, totalCases: 2 }, client);
  });

  console.log('[SYNTHETIC ENGINE] PostgreSQL Synthetic dataset seeded successfully.');
}

module.exports = { generateSyntheticData };
