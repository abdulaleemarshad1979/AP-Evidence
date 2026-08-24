const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../database');
const { abacMiddleware } = require('../middleware/abac');
const { authenticateMiddleware } = require('../middleware/auth');

const mergeSchema = z.object({
  primaryId: z.string().min(1, 'primaryId is required'),
  secondaryId: z.string().min(1, 'secondaryId is required'),
  candidateId: z.string().optional(),
  rationale: z.string().optional(),
  expectedVersion: z.number().optional()
});

const reverseSchema = z.object({
  historyId: z.string().optional(),
  candidateId: z.string().optional(),
  rationale: z.string().optional()
});

const rejectSchema = z.object({
  candidateId: z.string().min(1, 'candidateId is required'),
  rationale: z.string().optional()
});

// List Merge History
router.get('/history', authenticateMiddleware, async (req, res) => {
  const history = await db.query(`SELECT * FROM merge_history ORDER BY created_at DESC`);
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

// Execute Entity Merge (Analyst Decision - Canonical Mapping Redirect, Optimistic Locking, Atomic Transaction)
router.post('/merge', authenticateMiddleware, abacMiddleware('MERGE', async req => {
  const primary = await db.getEntityById(req.body.primaryId);
  if (!primary) return null;
  // Resolve case from primary entity's observations/assertions or fallback
  const obs = await db.queryOne(`SELECT case_id FROM observations WHERE entity_id = $1 LIMIT 1`, [primary.id]);
  return obs ? obs.case_id : 'CASE-SYN-0001';
}), async (req, res) => {
  const parseResult = mergeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
  }

  const user = req.user;
  const { primaryId, secondaryId, candidateId, rationale, expectedVersion } = parseResult.data;

  const primary = await db.getEntityById(primaryId);
  const secondary = await db.getEntityById(secondaryId);

  if (!primary || !secondary) {
    return res.status(404).json({ error: 'One or both entities not found for merge' });
  }

  if (secondary.status === 'MERGED') {
    return res.status(400).json({ error: `Entity '${secondaryId}' is already merged into '${secondary.canonicalEntityId}'` });
  }

  // Optimistic locking check
  if (expectedVersion !== undefined && primary.version !== expectedVersion) {
    return res.status(409).json({
      error: 'Conflict',
      message: `Optimistic Lock Exception: Entity ${primaryId} version (${primary.version}) does not match expected version (${expectedVersion}).`
    });
  }

  const decisionReason = rationale || 'Analyst verified candidate correlation';
  const historyId = `MH-${Date.now()}`;

  await db.withTransaction(async (client) => {
    // 1. Capture full original snapshot of secondary entity prior to merge
    const assertions = await client.query(`SELECT * FROM assertions WHERE subject_entity_id = $1 OR object_entity_id = $2`, [secondaryId, secondaryId]);
    const observations = await client.query(`SELECT * FROM observations WHERE entity_id = $1`, [secondaryId]);
    const snapshot = {
      secondaryEntity: secondary,
      assertions: assertions.rows,
      observations: observations.rows
    };

    // 2. Insert into merge_history
    await client.query(
      `INSERT INTO merge_history (id, candidate_id, primary_entity_id, secondary_entity_id, reviewer, decision_reason, original_state_snapshot, action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'MERGED')`,
      [historyId, candidateId || 'MANUAL', primaryId, secondaryId, user.name, decisionReason, JSON.stringify(snapshot)]
    );

    // 3. Update primary entity in DB (merge aliases, increment version)
    const mergedAliases = Array.from(new Set([...(primary.aliases || []), ...(secondary.aliases || []), secondary.name]));
    const primaryMeta = primary.metadata || {};
    primaryMeta.notes = (primaryMeta.notes || '') + `\n[MERGED ${new Date().toISOString()}] Integrated synthetic data from ${secondary.id} (${secondary.name})`;

    await client.query(
      `UPDATE entities 
       SET aliases = $1, human_review_status = 'APPROVED_MERGED', metadata = $2, version = version + 1, updated_at = $3
       WHERE id = $4`,
      [JSON.stringify(mergedAliases), JSON.stringify(primaryMeta), new Date().toISOString(), primaryId]
    );

    // 4. Mark secondary entity as MERGED with canonical redirect (DO NOT DELETE identity record!)
    await client.query(
      `UPDATE entities 
       SET status = 'MERGED', canonical_entity_id = $1, human_review_status = 'APPROVED_MERGED', updated_at = $2
       WHERE id = $3`,
      [primaryId, new Date().toISOString(), secondaryId]
    );

    // 5. Re-point assertions in DB
    await client.query(`UPDATE assertions SET subject_entity_id = $1 WHERE subject_entity_id = $2`, [primaryId, secondaryId]);
    await client.query(`UPDATE assertions SET object_entity_id = $1 WHERE object_entity_id = $2`, [primaryId, secondaryId]);

    // 6. Re-point observations in DB
    await client.query(`UPDATE observations SET entity_id = $1 WHERE entity_id = $2`, [primaryId, secondaryId]);

    // 7. Update candidate status in DB
    if (candidateId) {
      await client.query(
        `UPDATE resolution_candidates 
         SET status = 'APPROVED_MERGED', human_review_status = 'APPROVED_MERGED', reviewer = $1, decision_reason = $2, version = version + 1, updated_at = $3
         WHERE id = $4`,
        [user.name, decisionReason, new Date().toISOString(), candidateId]
      );
    }

    await db.logAudit(user.id, user.name, 'MERGE_ENTITIES', 'Human Review Queue', `Merged entity ${secondaryId} into canonical profile ${primaryId}. Rationale: ${rationale}`, primaryId, null, client);
    await db.emitOutboxEvent('ENTITY', primaryId, 'ENTITY_MERGED', { primaryId, secondaryId, historyId }, client);
  });

  const updatedPrimary = await db.getEntityById(primaryId);
  res.json({
    message: 'Entities merged successfully into canonical profile via redirect mapping',
    historyId,
    primaryEntity: updatedPrimary
  });
});

// Execute Reversible Merge / Split (Unmerge - Atomic Transaction)
router.post('/reverse', authenticateMiddleware, abacMiddleware('REVERSE', async req => {
  return 'CASE-SYN-0001';
}), async (req, res) => {
  const parseResult = reverseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
  }

  const user = req.user;
  const { historyId, candidateId, rationale } = parseResult.data;

  let historyRecord = null;
  if (historyId) {
    historyRecord = await db.queryOne(`SELECT * FROM merge_history WHERE id = $1`, [historyId]);
  } else if (candidateId) {
    historyRecord = await db.queryOne(`SELECT * FROM merge_history WHERE candidate_id = $1 ORDER BY created_at DESC`, [candidateId]);
  }

  if (!historyRecord) {
    return res.status(404).json({ error: 'No merge history record found for reversal' });
  }

  if (historyRecord.action === 'REVERSED') {
    return res.status(400).json({ error: 'Merge operation has already been reversed' });
  }

  const snapshot = JSON.parse(historyRecord.original_state_snapshot);
  const sec = snapshot.secondaryEntity;
  const primaryId = historyRecord.primary_entity_id;
  const secondaryId = historyRecord.secondary_entity_id;
  const reason = rationale || 'Analyst reversed previous entity merge';

  await db.withTransaction(async (client) => {
    // 1. Restore secondary entity status to ACTIVE & clear canonical redirect
    await client.query(
      `UPDATE entities
       SET status = 'ACTIVE', canonical_entity_id = NULL, human_review_status = 'REVERSED', updated_at = $1
       WHERE id = $2`,
      [new Date().toISOString(), secondaryId]
    );

    // 2. Re-point assertions back to secondary entity based on snapshot
    if (Array.isArray(snapshot.assertions)) {
      for (const a of snapshot.assertions) {
        await client.query(
          `UPDATE assertions 
           SET subject_entity_id = $1, object_entity_id = $2
           WHERE id = $3`,
          [a.subject_entity_id, a.object_entity_id, a.id]
        );
      }
    }

    // 3. Re-point observations back to secondary entity based on snapshot
    if (Array.isArray(snapshot.observations)) {
      for (const o of snapshot.observations) {
        await client.query(`UPDATE observations SET entity_id = $1 WHERE id = $2`, [sec.id, o.id]);
      }
    }

    // 4. Update merge history & resolution candidate
    const newHistId = `MH-REV-${Date.now()}`;
    await client.query(
      `INSERT INTO merge_history (id, candidate_id, primary_entity_id, secondary_entity_id, reviewer, decision_reason, original_state_snapshot, action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'REVERSED')`,
      [newHistId, historyRecord.candidate_id, primaryId, secondaryId, user.name, reason, historyRecord.original_state_snapshot]
    );

    if (historyRecord.candidate_id) {
      await client.query(
        `UPDATE resolution_candidates 
         SET status = 'REVERSED', human_review_status = 'REVERSED', reviewer = $1, decision_reason = $2, updated_at = $3
         WHERE id = $4`,
        [user.name, reason, new Date().toISOString(), historyRecord.candidate_id]
      );
    }

    await db.logAudit(user.id, user.name, 'REVERSE_ENTITY_MERGE', 'Human Review Queue', `Reversed merge for ${secondaryId} from ${primaryId}. Rationale: ${rationale}`, secondaryId, null, client);
    await db.emitOutboxEvent('ENTITY', secondaryId, 'ENTITY_UNMERGED', { primaryId, secondaryId, historyId: newHistId }, client);
  });

  const restoredEntity = await db.getEntityById(secondaryId);
  res.json({
    message: 'Reversible merge executed cleanly. Secondary entity restored.',
    restoredEntity
  });
});

// Reject Candidate Pair (Flag as Distinct / False Positive)
router.post('/reject', authenticateMiddleware, abacMiddleware('MERGE', async () => 'CASE-SYN-0001'), async (req, res) => {
  const parseResult = rejectSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
  }

  const user = req.user;
  const { candidateId, rationale } = parseResult.data;
  const candidate = await db.queryOne(`SELECT * FROM resolution_candidates WHERE id = $1`, [candidateId]);

  if (!candidate) {
    return res.status(404).json({ error: 'Candidate resolution record not found' });
  }

  const reason = rationale || 'Analyst verified synthetic entities are distinct';

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE resolution_candidates 
       SET status = 'REJECTED_SPLIT', human_review_status = 'REJECTED_SPLIT', reviewer = $1, decision_reason = $2, updated_at = $3
       WHERE id = $4`,
      [user.name, reason, new Date().toISOString(), candidateId]
    );

    await db.logAudit(user.id, user.name, 'REJECT_ENTITY_MERGE', 'Human Review Queue', `Rejected candidate merge ${candidateId} (${candidate.entity_a} vs ${candidate.entity_b})`, null, null, client);
    await db.emitOutboxEvent('RESOLUTION_CANDIDATE', candidateId, 'CANDIDATE_REJECTED', { candidateId, rationale }, client);
  });

  res.json({
    message: 'Candidate pair flagged as distinct entities (split confirmed)',
    candidateId
  });
});

module.exports = router;
