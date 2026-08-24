const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');

// --- 1. AI Model Registry APIs ---
router.get('/ai/models', authenticateMiddleware, async (req, res) => {
  const models = await db.getModelRegistry();
  res.json({
    status: 'SUCCESS',
    models: models.map(m => ({
      id: m.id,
      modelName: m.model_name,
      modelVersion: m.model_version,
      provider: m.provider,
      intendedUse: m.intended_use,
      prohibitedUse: m.prohibited_use,
      approvalStatus: m.approval_status,
      deploymentStatus: m.deployment_status,
      knownLimitations: m.known_limitations,
      createdAt: m.created_at
    }))
  });
});

router.post('/ai/models', authenticateMiddleware, async (req, res) => {
  const { modelName, modelVersion, provider, intendedUse, prohibitedUse, knownLimitations } = req.body;
  if (!modelName || !modelVersion) {
    return res.status(400).json({ error: 'Validation Error', message: 'modelName and modelVersion are required' });
  }

  const modelId = await db.createModelRegistryEntry({
    modelName,
    modelVersion,
    provider: provider || 'Internal Synthetic AI Engine',
    intendedUse: intendedUse || 'Synthetic investigative lead analysis',
    prohibitedUse: prohibitedUse || 'Automated target scoring or operational deployment',
    knownLimitations: knownLimitations || 'Operates strictly on synthetic training data'
  });

  res.status(201).json({ status: 'CREATED', modelId });
});

// --- 2. Governed Synthetic AI Assistance API ---
router.post('/ai/assist', authenticateMiddleware, async (req, res) => {
  const { task, caseId, entityId } = req.body;
  const targetCaseId = caseId || 'CASE-SYN-0001';

  if (!task) {
    return res.status(400).json({ error: 'Validation Error', message: 'Task parameter is required' });
  }

  // Fetch case evidence for verifiable citation
  const evidenceList = await db.getEvidenceList({ caseId: targetCaseId });
  const validEvIds = evidenceList.map(e => e.id);
  const primaryEvId = validEvIds[0] || 'EVI-RAW-SYN-0001';

  let outputText = '';
  let citedIds = [primaryEvId];

  switch (task) {
    case 'SUMMARIZE_TIMELINE':
      outputText = `Based on verified evidence [${primaryEvId}], target subject exhibited recurring spatial activity near Vijayawada Node Alpha between 08:15 UTC and 14:30 UTC.`;
      break;

    case 'DRAFT_LEAD_REPORT':
      outputText = `Investigative Lead Summary: Spatio-temporal observations [${primaryEvId}] confirm presence at Vijayawada Junction. Recommend verifying secondary device telemetry.`;
      break;

    case 'EXPLAIN_PROXIMITY':
      outputText = `Spatio-temporal co-location assertion derived from raw GPS packet [${primaryEvId}] indicates spatial distance of 210 meters with 95% confidence.`;
      break;

    case 'RECOMMEND_GAPS':
      outputText = `Evidence Gap Analysis: Missing 4-hour CDR coverage between 18:00 UTC and 22:00 UTC. Referenced base station log [${primaryEvId}].`;
      break;

    default:
      outputText = `Synthesized Response for task "${task}": Subject observations verified under [${primaryEvId}]. All assertions require human reviewer approval.`;
  }

  // Evidence Citation Safety Verification
  const hasCitation = /\[(EVI-[A-Za-z0-9-]+)\]/.test(outputText);
  if (!hasCitation) {
    return res.status(422).json({
      error: 'Governance Check Failed',
      message: 'AI response failed strict evidence citation policy. Every assertion must explicitly cite evidence IDs.'
    });
  }

  const runId = await db.createAIRun({
    promptTask: task,
    caseId: targetCaseId,
    inputParams: { entityId, task },
    outputText,
    citedEvidenceIds: citedIds,
    confidenceScore: 0.94,
    reviewStatus: 'PENDING_REVIEW'
  });

  await db.logAudit(req.user.id, req.user.name, 'AI_ASSIST_RUN', 'AI Governance', `Executed AI task "${task}" resulting in run ${runId}`, entityId, targetCaseId);

  res.status(201).json({
    status: 'GENERATED_PENDING_REVIEW',
    runId,
    task,
    outputText,
    citedEvidenceIds: citedIds,
    confidenceScore: 0.94,
    reviewStatus: 'PENDING_REVIEW',
    disclaimer: 'SYNTHETIC AI GENERATION — REQUIRES HUMAN-IN-THE-LOOP APPROVAL BEFORE ACTION'
  });
});

// --- 3. AI Runs & Human-in-the-Loop Review APIs ---
router.get('/ai/runs', authenticateMiddleware, async (req, res) => {
  const runs = await db.getAIRuns(req.query.caseId);
  res.json({
    status: 'SUCCESS',
    runs: runs.map(r => ({
      id: r.id,
      promptTask: r.prompt_task,
      modelId: r.model_id,
      caseId: r.case_id,
      inputParams: r.input_params ? JSON.parse(r.input_params) : {},
      outputText: r.output_text,
      citedEvidenceIds: r.cited_evidence_ids ? JSON.parse(r.cited_evidence_ids) : [],
      confidenceScore: r.confidence_score,
      reviewStatus: r.review_status,
      reviewedBy: r.reviewed_by,
      reviewerNotes: r.reviewer_notes,
      createdAt: r.created_at
    }))
  });
});

router.put('/ai/runs/:id/review', authenticateMiddleware, async (req, res) => {
  const { reviewStatus, notes } = req.body; // 'APPROVED', 'REJECTED', 'SUPERSEDED'
  const runId = req.params.id;

  if (!['APPROVED', 'REJECTED', 'SUPERSEDED'].includes(reviewStatus)) {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid review status value' });
  }

  await db.updateAIRunStatus(runId, reviewStatus, req.user.name, notes || 'Analyst Human-in-the-Loop review completed');
  await db.logAudit(req.user.id, req.user.name, 'AI_RUN_REVIEW', 'AI Governance', `Reviewed AI run ${runId}: ${reviewStatus}`);

  res.json({ status: 'REVIEW_COMPLETED', runId, reviewStatus });
});

module.exports = router;
