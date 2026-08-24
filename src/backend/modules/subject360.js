const express = require('express');
const router = express.Router();
const db = require('../database');

// Search subjects / entities
router.get('/search', (req, res) => {
  const { query, type } = req.query;
  const entities = db.getEntities({ search: query, type });
  res.json({ entities });
});

// Get Subject 360 unified profile
router.get('/:id', (req, res) => {
  const subjectData = db.getSubject360(req.params.id);
  if (!subjectData) {
    return res.status(404).json({ error: 'Subject target entity not found' });
  }

  db.logAudit('USR-101', 'Dr. Sarah Vance', 'VIEW_SUBJECT_360', 'Subject 360', `Loaded 360 operational profile for ${subjectData.subject.name || subjectData.subject.id}`, subjectData.subject.id);

  res.json(subjectData);
});

module.exports = router;
