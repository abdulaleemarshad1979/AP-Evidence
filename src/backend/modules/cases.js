const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../database');
const { abacMiddleware } = require('../middleware/abac');
const { authenticateMiddleware } = require('../middleware/auth');

const createCaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  codeName: z.string().optional(),
  description: z.string().optional(),
  organization: z.string().optional(),
  jurisdiction: z.string().optional(),
  permittedPurposes: z.string().optional(),
  targetEntityIds: z.array(z.string()).optional()
});

// List cases (Filtered by ABAC organization/jurisdiction & assignments)
router.get('/', authenticateMiddleware, async (req, res) => {
  const user = req.user;
  const allCases = await db.getCases();

  const permittedCases = [];
  for (const c of allCases) {
    if (user.role === 'Admin' || user.role === 'Auditor') {
      permittedCases.push(c);
      continue;
    }
    const assignments = await db.getCaseAssignments(c.id);
    if (assignments.includes(user.id)) {
      permittedCases.push(c);
      continue;
    }
    if (user.organization === c.organization && (user.jurisdiction === c.jurisdiction || user.jurisdiction === 'JUR-GLOBAL')) {
      permittedCases.push(c);
    }
  }

  await db.logAudit(user.id, user.name, 'LIST_CASES', 'Case Workspace', `Listed ${permittedCases.length} accessible cases for user ${user.username}`);
  res.json({ cases: permittedCases });
});

// Get case by ID (ABAC Enforcement)
router.get('/:id', authenticateMiddleware, abacMiddleware('READ'), async (req, res) => {
  const caseObj = req.targetCase || (await db.getCaseById(req.params.id));
  if (!caseObj) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const allEntities = await db.getEntities();
  const targetEntities = allEntities.filter(e => caseObj.targetEntityIds.includes(e.id));
  await db.logAudit(req.user.id, req.user.name, 'READ_CASE', 'Case Workspace', `Opened case ${caseObj.id} (${caseObj.title})`, caseObj.id, caseObj.id);

  res.json({
    case: caseObj,
    targetEntities
  });
});

// Create new case (Transactional, explicit CREATE_CASE permission, parameterized queries)
router.post('/', authenticateMiddleware, abacMiddleware('CREATE_CASE'), async (req, res) => {
  const parseResult = createCaseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
  }

  const user = req.user;
  const caseData = parseResult.data;

  const id = `CASE-AP-${Date.now().toString().slice(-4)}`;
  const title = caseData.title;
  const codeName = caseData.codeName || `CASE_OP_${caseData.title.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const organization = caseData.organization || user.organization || 'ORG-ALPHA';
  const jurisdiction = caseData.jurisdiction || user.jurisdiction || 'JUR-UK';
  const classification = 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY';
  const permittedPurposes = caseData.permittedPurposes || 'COUNTER_TERRORISM,LAW_ENFORCEMENT';
  const status = 'ACTIVE';
  const targetEntityIds = JSON.stringify(caseData.targetEntityIds || []);

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO cases (id, title, code_name, description, organization, jurisdiction, classification_level, permitted_purposes, status, target_entity_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, title, codeName, caseData.description || 'Operational intelligence case file', organization, jurisdiction, classification, permittedPurposes, status, targetEntityIds]
    );

    await client.query(
      `INSERT INTO case_assignments (case_id, user_id) VALUES ($1, $2)`,
      [id, user.id]
    );

    await db.logAudit(user.id, user.name, 'CREATE_CASE', 'Case Workspace', `Created case ${id} - ${title}`, id, id, client);
    await db.emitOutboxEvent('CASE', id, 'CASE_CREATED', { id, title, organization, jurisdiction }, client);
  });

  const createdCase = await db.getCaseById(id);
  res.status(201).json({ case: createdCase });
});

module.exports = router;
