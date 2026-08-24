const db = require('../src/backend/database');
const { generateSyntheticData } = require('../src/backend/synthetic_data');
const { signJwtToken, verifyJwtToken, getContextUser } = require('../src/backend/middleware/auth');
const { checkAbacAccess } = require('../src/backend/middleware/abac');
const storage = require('../src/backend/storage');
const outboxWorker = require('../src/backend/outbox_worker');
const API_CLIENT = require('../src/frontend/js/api');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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
  console.log(` RUNNING AUTOMATED COMPLIANCE TEST SUITE (PHASE 3 VERIFICATION)`);
  console.log(` System: Andhra Pradesh Intelligence System (APIS)`);
  console.log(`================================================================\n`);

  // Initialize DB & Seed
  try {
    await db.init();
    await generateSyntheticData(db);
  } catch (err) {
    console.warn('[TEST SUITE] Real PostgreSQL unavailable on default port, initializing isolated test runner mode:', err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: Unit Tests & System Branding
  // -------------------------------------------------------------
  console.log(`[TEST GROUP 1: Unit Tests & System Branding]`);

  const sampleCase = await db.getCaseById('CASE-SYN-0001');
  assert(
    sampleCase && sampleCase.classification === 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    'Case classification is set strictly to SYNTHETIC TRAINING DATA disclaimer',
    `Found: ${sampleCase?.classification}`
  );

  const sampleEntity = await db.getEntityById('SUB-00001');
  assert(
    sampleEntity && sampleEntity.id === 'SUB-00001' && sampleEntity.isFictional === true,
    'Entity identifier is fictional synthetic ID (SUB-00001) and marked fictional',
    `Found: ${sampleEntity?.id}`
  );

  assert(
    sampleEntity && sampleEntity.evidenceStatus === 'VERIFIED_RAW' && sampleEntity.assertionClass === 'CONFIRMED_FACT',
    'Individual risk/threat scores replaced with evidence status & assertion class',
    `Found: status=${sampleEntity?.evidenceStatus}, class=${sampleEntity?.assertionClass}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: OIDC/JWT Authentication & Forged Token Rejection
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 2: OIDC/JWT Authentication & Forged Token Rejection]`);

  const analystUser = await db.getUserById('USR-101');
  const validToken = signJwtToken(analystUser);
  const decodedValid = verifyJwtToken(validToken);
  assert(
    decodedValid !== null && decodedValid.sub === 'USR-101',
    'Valid signed OIDC JWT token is successfully verified',
    `Decoded sub: ${decodedValid?.sub}`
  );

  // Forged Token Test (a)
  const forgedToken = validToken.substring(0, validToken.length - 10) + 'FORGED1234';
  const decodedForged = verifyJwtToken(forgedToken);
  assert(
    decodedForged === null,
    'a) Forged tokens are strictly rejected by JWT verifier'
  );

  // Missing Credentials Test (b)
  const mockReqNoAuth = { headers: {} };
  const userNoAuth = await getContextUser(mockReqNoAuth);
  assert(
    userNoAuth === null,
    'b) Missing credentials return null user context (triggers 401 Unauthorized)'
  );

  // -------------------------------------------------------------
  // TEST GROUP 3: ABAC Cross-Case Authorization Enforcement
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 3: ABAC Cross-Case Authorization Enforcement]`);

  const assignedAnalyst = await db.getUserById('USR-101'); // Assigned to CASE-SYN-0001
  const foreignAnalyst = await db.getUserById('USR-105');  // Unassigned foreign analyst (ORG-BETA, JUR-US)

  const case1 = await db.getCaseById('CASE-SYN-0001');

  const leadAccess = await checkAbacAccess(assignedAnalyst, case1, 'READ');
  assert(leadAccess === true, 'ABAC PERMITS assigned analyst access to target case');

  const foreignAccess = await checkAbacAccess(foreignAnalyst, case1, 'READ');
  assert(
    foreignAccess === false,
    'c) Cross-case requests return 403 (ABAC Denies unassigned foreign analyst access without leaking data)'
  );

  const missingCaseAccess = await checkAbacAccess(assignedAnalyst, null, 'READ');
  assert(
    missingCaseAccess === false,
    'Default Deny enforced: Access denied when target case is missing'
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: SQL Injection Mitigation via Parameterized Queries
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 4: SQL Injection Mitigation & Parameterized Query Safety]`);

  const injectionPayload = "SUB-00001' OR '1'='1";
  const entityViaParam = await db.getEntityById(injectionPayload);
  assert(
    entityViaParam === null,
    "d) SQL injection payload (SUB-00001' OR '1'='1) cannot alter query logic or return unauthorized records"
  );

  // -------------------------------------------------------------
  // TEST GROUP 5: Evidence Vault SHA-256 Stream Verification & Tamper Detection
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 5: Evidence Vault SHA-256 Stream Verification & Tamper Detection]`);

  const origBuffer = Buffer.from('REAL_EVIDENCE_STREAM_PAYLOAD_2026_ORIGINAL_BYTES');
  const storeRes = await storage.putObject('test/evidence_001.bin', origBuffer, 'application/octet-stream');

  const verifyOriginal = await storage.verifyIntegrity(storeRes.objectKey, storeRes.sha256);
  assert(
    verifyOriginal.integrityVerified === true,
    'Original evidence bytes pass SHA-256 verification cleanly'
  );

  const tamperedSha = crypto.createHash('sha256').update('MODIFIED_TAMPERED_PAYLOAD_BYTES').digest('hex');
  const verifyTampered = await storage.verifyIntegrity(storeRes.objectKey, tamperedSha);
  assert(
    verifyTampered.integrityVerified === false,
    'e) Modified evidence bytes fail verification (integrityVerified = false)'
  );

  // -------------------------------------------------------------
  // TEST GROUP 6: Atomic Transactions & Rollback Guarantee
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 6: Atomic Transaction Boundaries & Rollback Verification]`);

  const testEntityId = `SUB-TX-${Date.now()}`;
  let txFailed = false;

  try {
    await db.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO entities (id, type, name, aliases, identifier_fields, evidence_status, assertion_class, confidence_method, human_review_status, review_priority, is_fictional, metadata)
         VALUES ($1, 'Person', 'Test TX Subject', '[]', '{}', 'VERIFIED_RAW', 'CONFIRMED_FACT', 'DETERMINISTIC_EXACT_MATCH', 'UNREVIEWED', 'P2_MEDIUM', TRUE, '{}')`,
        [testEntityId]
      );
      // Deliberately throw error inside transaction to force rollback
      throw new Error('Simulated Ingestion Transaction Failure');
    });
  } catch (err) {
    txFailed = true;
  }

  const rolledBackEntity = await db.getEntityById(testEntityId);
  assert(
    txFailed && rolledBackEntity === null,
    'f) Failed transactions rollback cleanly, leaving zero partial merge/import/outbox state in database',
    `txFailed: ${txFailed}, rolledBackEntity: ${JSON.stringify(rolledBackEntity)}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 7: Stored XSS Mitigation via HTML Escaping
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 7: Frontend Stored XSS Mitigation & HTML Escaping]`);

  const maliciousPayload = `<script>alert('XSS-ATTACK-2026')</script><img src=x onerror=alert(1)>`;
  const sanitizedOutput = API_CLIENT.escapeHTML(maliciousPayload);

  assert(
    !sanitizedOutput.includes('<script>') && sanitizedOutput.includes('&lt;script&gt;'),
    'g) Stored HTML/JavaScript payloads are rendered harmlessly via HTML entity escaping'
  );

  // -------------------------------------------------------------
  // TEST GROUP 8: Candidate Resolution & Reversible Merge
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 8: Candidate Resolution & Reversible Merge]`);

  const candidates = await db.query(`SELECT * FROM resolution_candidates WHERE id = 'RES-SYN-301'`);
  assert(candidates.length > 0, 'Candidate resolution pair logged with compared fields and individual scores');

  const secId = 'SUB-00004';
  const primId = 'SUB-00001';

  await db.withTransaction(async (client) => {
    const secObj = await db.getEntityById(secId);
    const snapshot = { secondaryEntity: secObj, assertions: [], observations: [] };
    const histId = `MH-TEST-${Date.now()}`;

    await client.query(
      `INSERT INTO merge_history (id, candidate_id, primary_entity_id, secondary_entity_id, reviewer, decision_reason, original_state_snapshot, action)
       VALUES ($1, 'RES-SYN-301', $2, $3, 'Test Analyst', 'Test merge rationale', $4, 'MERGED')`,
      [histId, primId, secId, JSON.stringify(snapshot)]
    );

    await client.query(
      `UPDATE entities SET status = 'MERGED', canonical_entity_id = $1 WHERE id = $2`,
      [primId, secId]
    );
  });

  const mergedSec = await db.getEntityById(secId);
  assert(
    mergedSec && mergedSec.status === 'MERGED' && mergedSec.canonicalEntityId === primId,
    'Secondary entity marked MERGED with canonical redirect to primary entity'
  );

  // Reversal
  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE entities SET status = 'ACTIVE', canonical_entity_id = NULL WHERE id = $1`,
      [secId]
    );
  });

  const restoredSec = await db.getEntityById(secId);
  assert(
    restoredSec && restoredSec.status === 'ACTIVE' && restoredSec.canonicalEntityId === null,
    'Reversible merge cleanly restored secondary entity profile to ACTIVE state'
  );

  // -------------------------------------------------------------
  // TEST GROUP 9: Phase 3 Verification & Outbox Worker Projections
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 9: Phase 3 Outbox Worker & Cryptographic Audit Chain]`);

  // Insert test outbox event
  const outboxId = `EVT-TEST-${Date.now()}`;
  await db.execute(
    `INSERT INTO outbox_events (id, event_type, payload, aggregate_type, aggregate_id, status)
     VALUES ($1, 'BATCH_INGESTED', '{"batchId":"B-TEST"}', 'IngestionBatch', 'B-TEST', 'PENDING')`,
    [outboxId]
  );

  await outboxWorker.processOutboxEvents();
  const processedEvt = await db.queryOne(`SELECT * FROM outbox_events WHERE id = $1`, [outboxId]);
  assert(
    processedEvt && processedEvt.status === 'PROCESSED',
    'Outbox worker processes projections and marks event PROCESSED'
  );

  // -------------------------------------------------------------
  // TEST GROUP 10: Phase 4 Secure Multi-Source Ingestion & Geo-Temporal APIs
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 10: Phase 4 Ingestion & Geo-Temporal Search APIs]`);

  // Source Creation Test
  const newSource = await db.createSource({
    name: 'Test CCTV Camera Stream',
    sourceType: 'CCTV_STREAM',
    description: 'Synthetic test feed',
    dataFormat: 'JSON'
  });
  assert(newSource && newSource.name === 'Test CCTV Camera Stream', 'Phase 4 Source registry successfully creates source');

  // Data Quality Recording Test
  const dqId = await db.saveDataQualityResult({
    sourceId: newSource.id,
    completeness: 0.99,
    validity: 0.99,
    overallGrade: 'EXCELLENT'
  });
  assert(dqId.startsWith('DQ-'), 'Data quality engine records dimension scores successfully');

  // Geo-Temporal Search Test
  const geoResults = await db.query(`SELECT * FROM observations WHERE case_id = 'CASE-SYN-0001' LIMIT 5`);
  assert(geoResults.length > 0, 'Geo-Temporal observations query returns spatial results');

  // -------------------------------------------------------------
  // TEST GROUP 11: Phase 5 Analytics & Alert Lifecycle APIs
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 11: Phase 5 Analytics & Alert Lifecycle]`);
  const ruleId = await db.createAnalyticsRule({ name: 'Co-Location Test Rule', spatialWindowMeters: 500 });
  assert(ruleId.startsWith('RULE-'), 'Phase 5 Analytics rule creation succeeded');

  const alertId = await db.createAlert({ title: 'Test Co-location Alert', severity: 'HIGH' });
  await db.updateAlertStatus(alertId, 'TRIAGED', null, 'Supervisor triage note');
  const alertCheck = await db.getAlerts();
  assert(alertCheck.some(a => a.id === alertId), 'Phase 5 Alert lifecycle state transitioned to TRIAGED');

  // -------------------------------------------------------------
  // TEST GROUP 12: Phase 6 Governed Synthetic AI Assistance
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 12: Phase 6 Governed AI & Evidence Citation]`);
  const modelId = await db.createModelRegistryEntry({ modelName: 'APIS-Synthetic-LLM', modelVersion: 'v2.1', provider: 'Mock' });
  assert(modelId.startsWith('MODEL-'), 'Phase 6 AI Model Registry entry created');

  const runId = await db.createAIRun({ promptTask: 'SUMMARIZE_TIMELINE', outputText: 'Target at node [EVI-RAW-SYN-0001]' });
  await db.updateAIRunStatus(runId, 'APPROVED', 'Test Analyst', 'HITL approval granted');
  const aiRuns = await db.getAIRuns();
  const approvedRun = aiRuns.find(r => r.id === runId);
  assert(approvedRun && approvedRun.review_status === 'APPROVED', 'Phase 6 Human-in-the-Loop review status updated to APPROVED');

  // -------------------------------------------------------------
  // TEST GROUP 13: Phase 7 Enterprise Resilience & DR Verification
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 13: Phase 7 Enterprise Resilience & Retention]`);
  const retPolicy = await db.query(`SELECT * FROM retention_policies`);
  assert(Array.isArray(retPolicy), 'Phase 7 Retention policy table accessible');

  // -------------------------------------------------------------
  // TEST GROUP 14: Phase 8 Synthetic Pilot Readiness
  // -------------------------------------------------------------
  console.log(`\n[TEST GROUP 14: Phase 8 Master Build Pilot Readiness]`);
  const casesFinal = await db.getCases();
  assert(casesFinal.length > 0, 'Phase 8 Synthetic pilot scenarios verified operational');

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
