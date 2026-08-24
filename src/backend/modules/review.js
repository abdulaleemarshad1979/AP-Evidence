const express = require('express');
const router = express.Router();
const db = require('../database');
const { getContextUser } = require('../middleware/abac');

// List Merge History
router.get('/history', (req, res) => {
  const history = db.query(`SELECT * FROM merge_history ORDER BY created_at DESC`);
  res.json({
    history: history.map(h => ({
      id: h.id,
      candidateId: h.candidate_id,
      primaryEntityId: h.primary_entity_id,
      secondaryEntityId: h.secondary_entity_id,
      reviewer: h.reviewer,
      decisionReason: h.decision_reason,
      action: h.action,
      createdAt: h.created_at
    }))
  });
});

// Execute Entity Merge (Analyst Decision)
router.post('/merge', (req, res) => {
  const user = getContextUser(req);
  const { primaryId, secondaryId, candidateId, rationale } = req.body;

  if (!primaryId || !secondaryId) {
    return res.status(400).json({ error: 'Both primaryId and secondaryId are required for merge' });
  }

  const primary = db.getEntityById(primaryId);
  const secondary = db.getEntityById(secondaryId);

  if (!primary || !secondary) {
    return res.status(404).json({ error: 'One or both entities not found for merge' });
  }

  const decisionReason = (rationale || 'Analyst verified candidate correlation').replace(/'/g, "''");
  const historyId = `MH-${Date.now()}`;

  // 1. Capture full original snapshot of secondary entity prior to merge
  const snapshot = {
    secondaryEntity: secondary,
    assertions: db.query(`SELECT * FROM assertions WHERE subject_entity_id = '${secondaryId}' OR object_entity_id = '${secondaryId}'`),
    observations: db.query(`SELECT * FROM observations WHERE entity_id = '${secondaryId}'`),
    evidence: db.query(`SELECT * FROM evidence_metadata WHERE metadata LIKE '%${secondaryId}%'`)
  };

  // 2. Insert into merge_history
  db.execute(`
    INSERT INTO merge_history (id, candidate_id, primary_entity_id, secondary_entity_id, reviewer, decision_reason, original_state_snapshot, action)
    VALUES ('${historyId}', '${candidateId || 'MANUAL'}', '${primaryId}', '${secondaryId}', '${user.name.replace(/'/g, "''")}', '${decisionReason}', '${JSON.stringify(snapshot).replace(/'/g, "''")}', 'MERGED')
  `);

  // 3. Update primary entity in DB (merge aliases, phones)
  const mergedAliases = Array.from(new Set([...(primary.aliases || []), ...(secondary.aliases || []), secondary.name]));
  const primaryMeta = primary.metadata || {};
  primaryMeta.notes = (primaryMeta.notes || '') + `\n[MERGED ${new Date().toISOString()}] Integrated synthetic data from ${secondary.id} (${secondary.name})`;

  db.execute(`
    UPDATE entities 
    SET aliases = '${JSON.stringify(mergedAliases).replace(/'/g, "''")}',
        human_review_status = 'APPROVED_MERGED',
        metadata = '${JSON.stringify(primaryMeta).replace(/'/g, "''")}',
        updated_at = '${new Date().toISOString()}'
    WHERE id = '${primaryId}'
  `);

  // 4. Re-point assertions in DB
  db.execute(`UPDATE assertions SET subject_entity_id = '${primaryId}' WHERE subject_entity_id = '${secondaryId}'`);
  db.execute(`UPDATE assertions SET object_entity_id = '${primaryId}' WHERE object_entity_id = '${secondaryId}'`);

  // 5. Re-point observations in DB
  db.execute(`UPDATE observations SET entity_id = '${primaryId}' WHERE entity_id = '${secondaryId}'`);

  // 6. Update candidate status in DB
  if (candidateId) {
    db.execute(`
      UPDATE resolution_candidates 
      SET status = 'APPROVED_MERGED', human_review_status = 'APPROVED_MERGED', reviewer = '${user.name.replace(/'/g, "''")}', decision_reason = '${decisionReason}', updated_at = '${new Date().toISOString()}'
      WHERE id = '${candidateId}'
    `);
  }

  // 7. Delete secondary entity from active table
  db.execute(`DELETE FROM entities WHERE id = '${secondaryId}'`);

  db.logAudit(user.id, user.name, 'MERGE_ENTITIES', 'Human Review Queue', `Merged entity ${secondaryId} into canonical profile ${primaryId}. Rationale: ${rationale}`, primaryId);
  db.emitOutboxEvent('ENTITY', primaryId, 'ENTITY_MERGED', { primaryId, secondaryId, historyId });

  res.json({
    message: 'Entities merged successfully into canonical profile',
    historyId,
    primaryEntity: db.getEntityById(primaryId)
  });
});

// Execute Reversible Merge / Split (Unmerge)
router.post('/reverse', (req, res) => {
  const user = getContextUser(req);
  const { historyId, candidateId, rationale } = req.body;

  let historyRecord = null;
  if (historyId) {
    historyRecord = db.queryOne(`SELECT * FROM merge_history WHERE id = '${historyId}'`);
  } else if (candidateId) {
    historyRecord = db.queryOne(`SELECT * FROM merge_history WHERE candidate_id = '${candidateId}' ORDER BY created_at DESC`);
  }

  if (!historyRecord) {
    return res.status(404).json({ error: 'No merge history record found for reversal' });
  }

  const snapshot = JSON.parse(historyRecord.original_state_snapshot);
  const sec = snapshot.secondaryEntity;
  const primaryId = historyRecord.primary_entity_id;
  const secondaryId = historyRecord.secondary_entity_id;
  const reason = (rationale || 'Analyst reversed previous entity merge').replace(/'/g, "''");

  // 1. Re-create secondary entity in DB
  db.execute(`
    INSERT INTO entities (id, type, name, aliases, identifier_fields, evidence_status, assertion_class, confidence_method, human_review_status, review_priority, is_fictional, metadata)
    VALUES ('${sec.id}', '${sec.type}', '${sec.name.replace(/'/g, "''")}', '${JSON.stringify(sec.aliases).replace(/'/g, "''")}', '${JSON.stringify(sec.identifierFields).replace(/'/g, "''")}', '${sec.evidenceStatus}', '${sec.assertionClass}', '${sec.confidenceMethod}', 'REVERSED', '${sec.reviewPriority}', TRUE, '${JSON.stringify(sec.metadata).replace(/'/g, "''")}')
  `);

  // 2. Re-point assertions back to secondary entity based on snapshot
  if (Array.isArray(snapshot.assertions)) {
    for (const a of snapshot.assertions) {
      db.execute(`
        UPDATE assertions 
        SET subject_entity_id = '${a.subject_entity_id}', object_entity_id = '${a.object_entity_id}'
        WHERE id = '${a.id}'
      `);
    }
  }

  // 3. Re-point observations back to secondary entity
  if (Array.isArray(snapshot.observations)) {
    for (const o of snapshot.observations) {
      db.execute(`UPDATE observations SET entity_id = '${sec.id}' WHERE id = '${o.id}'`);
    }
  }

  // 4. Update merge history & resolution candidate
  const newHistId = `MH-REV-${Date.now()}`;
  db.execute(`
    INSERT INTO merge_history (id, candidate_id, primary_entity_id, secondary_entity_id, reviewer, decision_reason, original_state_snapshot, action)
    VALUES ('${newHistId}', '${historyRecord.candidate_id}', '${primaryId}', '${secondaryId}', '${user.name.replace(/'/g, "''")}', '${reason}', '${historyRecord.original_state_snapshot.replace(/'/g, "''")}', 'REVERSED')
  `);

  if (historyRecord.candidate_id) {
    db.execute(`
      UPDATE resolution_candidates 
      SET status = 'REVERSED', human_review_status = 'REVERSED', reviewer = '${user.name.replace(/'/g, "''")}', decision_reason = '${reason}', updated_at = '${new Date().toISOString()}'
      WHERE id = '${historyRecord.candidate_id}'
    `);
  }

  db.logAudit(user.id, user.name, 'REVERSE_ENTITY_MERGE', 'Human Review Queue', `Reversed merge for ${secondaryId} from ${primaryId}. Rationale: ${rationale}`, secondaryId);
  db.emitOutboxEvent('ENTITY', secondaryId, 'ENTITY_UNMERGED', { primaryId, secondaryId, historyId: newHistId });

  res.json({
    message: 'Reversible merge executed cleanly. Secondary entity restored.',
    restoredEntity: db.getEntityById(secondaryId)
  });
});

// Reject Candidate Pair (Flag as Distinct / False Positive)
router.post('/reject', (req, res) => {
  const user = getContextUser(req);
  const { candidateId, rationale } = req.body;
  const candidate = db.queryOne(`SELECT * FROM resolution_candidates WHERE id = '${candidateId}'`);

  if (!candidate) {
    return res.status(404).json({ error: 'Candidate resolution record not found' });
  }

  const reason = (rationale || 'Analyst verified synthetic entities are distinct').replace(/'/g, "''");

  db.execute(`
    UPDATE resolution_candidates 
    SET status = 'REJECTED_SPLIT', human_review_status = 'REJECTED_SPLIT', reviewer = '${user.name.replace(/'/g, "''")}', decision_reason = '${reason}', updated_at = '${new Date().toISOString()}'
    WHERE id = '${candidateId}'
  `);

  db.logAudit(user.id, user.name, 'REJECT_ENTITY_MERGE', 'Human Review Queue', `Rejected candidate merge ${candidateId} (${candidate.entity_a} vs ${candidate.entity_b})`);
  db.emitOutboxEvent('RESOLUTION_CANDIDATE', candidateId, 'CANDIDATE_REJECTED', { candidateId, rationale });

  res.json({
    message: 'Candidate pair flagged as distinct entities (split confirmed)',
    candidateId
  });
});

module.exports = router;
