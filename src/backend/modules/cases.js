const express = require('express');
const router = express.Router();
const db = require('../database');
const { abacMiddleware, getContextUser } = require('../middleware/abac');

// List cases (Filtered by ABAC)
router.get('/', (req, res) => {
  const user = getContextUser(req);
  const allCases = db.getCases();

  const permittedCases = allCases.filter(c => {
    if (user.role === 'Admin' || user.role === 'Auditor') return true;
    const assignments = db.getCaseAssignments(c.id);
    if (assignments.includes(user.id)) return true;
    return (user.organization === c.organization && user.jurisdiction === c.jurisdiction);
  });

  db.logAudit(user.id, user.name, 'LIST_CASES', 'Case Workspace', `Listed ${permittedCases.length} accessible cases for user ${user.username}`);
  res.json({ cases: permittedCases });
});

// Get case by ID (ABAC Enforcement)
router.get('/:id', abacMiddleware('READ'), (req, res) => {
  const caseObj = req.targetCase || db.getCaseById(req.params.id);
  if (!caseObj) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const targetEntities = db.getEntities().filter(e => caseObj.targetEntityIds.includes(e.id));
  db.logAudit(req.user.id, req.user.name, 'READ_CASE', 'Case Workspace', `Opened case ${caseObj.id} (${caseObj.title})`, caseObj.id, caseObj.id);

  res.json({
    case: caseObj,
    targetEntities
  });
});

// Create new case
router.post('/', (req, res) => {
  const user = getContextUser(req);
  const caseData = req.body;
  if (!caseData.title) {
    return res.status(400).json({ error: 'Title is required for new case' });
  }

  const id = `CASE-SYN-${Date.now().toString().slice(-4)}`;
  const title = caseData.title.startsWith('Synthetic') ? caseData.title : `Synthetic Case ${caseData.title} (Fictional Operation)`;
  const codeName = caseData.codeName || `CASE_SYN_${caseData.title.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const organization = caseData.organization || user.organization || 'ORG-ALPHA';
  const jurisdiction = caseData.jurisdiction || user.jurisdiction || 'JUR-UK';
  const classification = 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE';
  const permittedPurposes = caseData.permittedPurposes || 'COUNTER_TERRORISM,TRAINING';
  const status = 'ACTIVE';
  const targetEntityIds = JSON.stringify(caseData.targetEntityIds || []);

  const sql = `
    INSERT INTO cases (id, title, code_name, description, organization, jurisdiction, classification_level, permitted_purposes, status, target_entity_ids)
    VALUES ('${id}', '${title.replace(/'/g, "''")}', '${codeName}', '${(caseData.description || 'Synthetic operation case').replace(/'/g, "''")}', '${organization}', '${jurisdiction}', '${classification}', '${permittedPurposes}', '${status}', '${targetEntityIds}')
  `;
  db.execute(sql);
  db.execute(`INSERT INTO case_assignments (case_id, user_id) VALUES ('${id}', '${user.id}')`);

  db.logAudit(user.id, user.name, 'CREATE_CASE', 'Case Workspace', `Created case ${id} - ${title}`, id, id);
  db.emitOutboxEvent('CASE', id, 'CASE_CREATED', { id, title, organization, jurisdiction });

  res.status(201).json({ case: db.getCaseById(id) });
});

module.exports = router;
