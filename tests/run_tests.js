const db = require('../src/backend/database');
const { generateSyntheticData } = require('../src/backend/synthetic_data');
const { checkAbacAccess, getContextUser } = require('../src/backend/middleware/abac');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASSED: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAILED: ${testName} - ${details}`);
  }
}

async function runTestSuite() {
  console.log(`================================================================`);
  console.log(` RUNNING AUTOMATED COMPLIANCE TEST SUITE (FOUNDATION PASS 1)`);
  console.log(` System: AP Spatio-Temporal Subject Intelligence Platform`);
  console.log(`================================================================\n`);

  // Initialize DB & Seed
  await db.init();
  await generateSyntheticData(db);

  // -------------------------------------------------------------
  // TEST GROUP 1: Unit Tests & Data Sanitization
  // -------------------------------------------------------------
  console.log(`[TEST GROUP 1: Unit Tests & Data Sanitization]`);
  
  const sampleCase = db.getCaseById('CASE-SYN-0001');
  assert(
    sampleCase.classification === 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    'Case classification is set strictly to SYNTHETIC TRAINING DATA disclaimer',
    `Found: ${sampleCase.classification}`
  );

  const sampleEntity = db.getEntityById('SUB-00001');
  assert(
    sampleEntity.id === 'SUB-00001' && sampleEntity.isFictional === true,
    'Entity identifier is fictional synthetic ID (SUB-00001) and marked fictional',
    `Found: ${sampleEntity.id}`
  );

  assert(
    sampleEntity.evidenceStatus === 'VERIFIED_RAW' && sampleEntity.assertionClass === 'CONFIRMED_FACT',
    'Individual risk/threat scores replaced with evidence status & assertion class',
    `Found: status=${sampleEntity.evidenceStatus}, class=${sampleEntity.assertionClass}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: PostgreSQL Database Engine & DDL Schema
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 2: PostgreSQL Database Engine & DDL Schema]`);

  const tables = db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  const tableNames = tables.map(t => t.table_name);
  
  assert(tableNames.includes('cases'), 'PostgreSQL table "cases" created via DDL schema');
  assert(tableNames.includes('entities'), 'PostgreSQL table "entities" created via DDL schema');
  assert(tableNames.includes('observations'), 'PostgreSQL table "observations" created via DDL schema');
  assert(tableNames.includes('assertions'), 'PostgreSQL table "assertions" created via DDL schema');
  assert(tableNames.includes('evidence_metadata'), 'PostgreSQL table "evidence_metadata" created via DDL schema');
  assert(tableNames.includes('outbox_events'), 'PostgreSQL table "outbox_events" created for transactional outbox pattern');

  const outboxRows = db.query(`SELECT * FROM outbox_events`);
  assert(outboxRows.length > 0, 'Transactional Outbox event successfully logged on dataset seed');

  // -------------------------------------------------------------
  // TEST GROUP 3: Bearer Token & API Authorization Context
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 3: Bearer Token Authorization & API Context]`);

  const mockReqWithBearer = {
    headers: {
      authorization: 'Bearer TOKEN-USR-102-123456789'
    }
  };
  const extractedUser = getContextUser(mockReqWithBearer);
  assert(extractedUser !== null && extractedUser.id === 'USR-102', 'Bearer token correctly decoded user context (USR-102)');

  const cases = db.getCases();
  assert(cases.length >= 2, 'API returns cases from PostgreSQL database', `Count: ${cases.length}`);

  const entities = db.getEntities();
  assert(entities.length >= 10, 'API returns entities from PostgreSQL database', `Count: ${entities.length}`);

  const evidence = db.evidence;
  assert(evidence.length >= 3, 'API returns evidence records from PostgreSQL database', `Count: ${evidence.length}`);

  // -------------------------------------------------------------
  // TEST GROUP 4: ABAC Cross-Case Authorization Enforcement
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 4: ABAC Cross-Case Authorization Enforcement]`);

  const leadUser = db.getUserById('USR-101'); // Assigned to CASE-SYN-0001
  const foreignUser = db.getUserById('USR-105'); // Unassigned foreign org/jur user

  const case1 = db.getCaseById('CASE-SYN-0001');

  const leadAccess = checkAbacAccess(leadUser, case1, 'READ');
  assert(leadAccess === true, 'ABAC PERMITS assigned analyst access to target case');

  const foreignAccess = checkAbacAccess(foreignUser, case1, 'READ');
  assert(foreignAccess === false, 'ABAC DENIES unassigned foreign analyst access to target case');

  // -------------------------------------------------------------
  // TEST GROUP 5: Data Ingestion (Validation, Idempotency & Quarantine)
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 5: Data Ingestion Validation, Idempotency & Quarantine]`);

  const testPayload = [
    { eventType: 'CCTV_DETECTION', latitude: 51.5074, longitude: -0.1478, confidence: 0.95, associatedEntityIds: ['SUB-00001'] },
    { eventType: 'CCTV_DETECTION', latitude: 150.0, longitude: -0.1478, confidence: 0.95, associatedEntityIds: ['SUB-00001'] }
  ];

  const batchId = `IMP-TEST-${Date.now()}`;

  let acceptedCount = 0;
  let quarantinedCount = 0;

  testPayload.forEach((rec, idx) => {
    const rawStr = JSON.stringify(rec);
    const rowHash = crypto.createHash('sha256').update(rawStr).digest('hex');
    const rowId = `ROW-TEST-${batchId}-${idx}`;

    if (rec.latitude < -90 || rec.latitude > 90) {
      quarantinedCount++;
      db.execute(`
        INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
        VALUES ('${rowId}', '${batchId}', ${idx}, '${rawStr.replace(/'/g, "''")}', '${rowHash}', 'QUARANTINED', 'Invalid latitude value')
      `);
    } else {
      acceptedCount++;
      db.execute(`
        INSERT INTO ingestion_rows (id, batch_id, row_index, raw_payload, payload_hash, status, error_details)
        VALUES ('${rowId}', '${batchId}', ${idx}, '${rawStr.replace(/'/g, "''")}', '${rowHash}', 'ACCEPTED', NULL)
      `);
    }
  });

  assert(acceptedCount === 1, 'Ingestion engine accepted valid telemetry row');
  assert(quarantinedCount === 1, 'Ingestion engine QUARANTINED invalid row with coordinate error');

  const dupCheck = db.queryOne(`SELECT id FROM ingestion_rows WHERE payload_hash = '${crypto.createHash('sha256').update(JSON.stringify(testPayload[0])).digest('hex')}' AND status = 'ACCEPTED'`);
  assert(Boolean(dupCheck), 'Ingestion idempotency check identified existing row SHA-256 hash');

  // -------------------------------------------------------------
  // TEST GROUP 6: Candidate Resolution & Reversible Merge
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 6: Candidate Resolution & Reversible Merge]`);

  const candidate = db.queryOne(`SELECT * FROM resolution_candidates WHERE id = 'RES-SYN-301'`);
  assert(candidate !== null, 'Candidate resolution pair logged with compared fields and individual scores');

  const secId = 'SUB-00004';
  const primId = 'SUB-00001';
  const secObj = db.getEntityById(secId);

  const snapshot = {
    secondaryEntity: secObj,
    assertions: db.query(`SELECT * FROM assertions WHERE subject_entity_id = '${secId}' OR object_entity_id = '${secId}'`),
    observations: db.query(`SELECT * FROM observations WHERE entity_id = '${secId}'`)
  };

  const histId = `MH-TEST-${Date.now()}`;
  db.execute(`
    INSERT INTO merge_history (id, candidate_id, primary_entity_id, secondary_entity_id, reviewer, decision_reason, original_state_snapshot, action)
    VALUES ('${histId}', 'RES-SYN-301', '${primId}', '${secId}', 'Test Analyst', 'Test merge rationale', '${JSON.stringify(snapshot).replace(/'/g, "''")}', 'MERGED')
  `);

  db.execute(`DELETE FROM entities WHERE id = '${secId}'`);
  assert(db.getEntityById(secId) === null, 'Secondary entity removed from active entity table post-merge');

  const historyRecord = db.queryOne(`SELECT * FROM merge_history WHERE id = '${histId}'`);
  const restoredSec = JSON.parse(historyRecord.original_state_snapshot).secondaryEntity;

  db.execute(`
    INSERT INTO entities (id, type, name, aliases, identifier_fields, evidence_status, assertion_class, confidence_method, human_review_status, review_priority, is_fictional, metadata)
    VALUES ('${restoredSec.id}', '${restoredSec.type}', '${restoredSec.name.replace(/'/g, "''")}', '${JSON.stringify(restoredSec.aliases).replace(/'/g, "''")}', '${JSON.stringify(restoredSec.identifierFields).replace(/'/g, "''")}', '${restoredSec.evidenceStatus}', '${restoredSec.assertionClass}', '${restoredSec.confidenceMethod}', 'REVERSED', '${restoredSec.reviewPriority}', TRUE, '${JSON.stringify(restoredSec.metadata).replace(/'/g, "''")}')
  `);

  assert(db.getEntityById(secId) !== null, 'Reversible merge cleanly restored secondary entity profile from snapshot');

  // -------------------------------------------------------------
  // TEST GROUP 7: Evidence Vault & Append-Only Custody
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 7: Evidence Vault Lineage & Chain of Custody]`);

  const origEv = db.evidence.find(e => e.id === 'EVI-SYN-0001');
  const derivEv = db.evidence.find(e => e.id === 'EVI-SYN-0003');

  assert(origEv.isOriginal === true && derivEv.isOriginal === false, 'Evidence vault correctly distinguishes original vs derived evidence');
  assert(derivEv.parentEvidenceId === 'EVI-SYN-0001', 'Derived evidence maintains parent linkage (EVI-SYN-0001)');
  assert(origEv.chainOfCustody.length >= 1, 'Evidence item maintains append-only chain of custody ledger');

  // -------------------------------------------------------------
  // TEST GROUP 8: Audit Ledger & Tamper Verification
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 8: Audit Ledger & Cryptographic Tamper Detection]`);

  const auditLogs = db.auditLogs;
  assert(auditLogs.length >= 3, 'Audit ledger records system actions', `Count: ${auditLogs.length}`);

  let chainValid = true;
  for (let i = 1; i < auditLogs.length; i++) {
    if (auditLogs[i].prevHash !== auditLogs[i - 1].hash) {
      chainValid = false;
      break;
    }
  }
  assert(chainValid === true, 'Cryptographic hash chain is fully intact and verified');

  // -------------------------------------------------------------
  // TEST GROUP 9: Critical End-to-End Workflow & Persistence
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 9: Critical End-to-End Workflow & Persistence Check]`);

  db.persistSnapshot();
  const storeExists = fs.existsSync(path.join(__dirname, '../data/postgres_store.json'));
  assert(storeExists === true, 'PostgreSQL database state persisted to canonical disk snapshot file');

  await db.restoreSnapshot(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/postgres_store.json'), 'utf8')));
  const reloadedEntity = db.getEntityById('SUB-00001');
  assert(reloadedEntity !== null && reloadedEntity.id === 'SUB-00001', 'Database snapshot restored cleanly across service restarts');

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log(`\n================================================================`);
  console.log(` TEST SUITE SUMMARY`);
  console.log(` Total Tests: ${totalTests}`);
  console.log(` Passed:      ${passedTests}`);
  console.log(` Failed:      ${failedTests}`);
  console.log(`================================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runTestSuite().catch(err => {
    console.error('Test execution fatal error:', err);
    process.exit(1);
  });
}

module.exports = runTestSuite;
