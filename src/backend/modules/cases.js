const express = require('express');
const router = express.Router();
const db = require('../database');

// List cases
router.get('/', (req, res) => {
  const cases = db.getCases();
  res.json({ cases });
});

// Get case by ID
router.get('/:id', (req, res) => {
  const caseObj = db.getCaseById(req.params.id);
  if (!caseObj) {
    return res.status(404).json({ error: 'Case not found' });
  }

  // Get targets details
  const targetEntities = db.entities.filter(e => caseObj.targetEntityIds.includes(e.id));
  db.logAudit('USR-101', 'Dr. Sarah Vance', 'VIEW_CASE', 'Case Management', `Opened case ${caseObj.id}`, caseObj.id);

  res.json({
    case: caseObj,
    targetEntities
  });
});

// Create new case
router.post('/', (req, res) => {
  const caseData = req.body;
  if (!caseData.title) {
    return res.status(400).json({ error: 'Title is required for new case' });
  }

  const user = req.user || db.users[0];
  const newCase = db.createCase(caseData, user);
  res.status(201).json({ case: newCase });
});

module.exports = router;
