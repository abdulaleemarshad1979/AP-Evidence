const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../middleware/auth');
const { abacMiddleware } = require('../middleware/abac');

// Ensure default seed environments exist
async function ensureSeedEnvironments() {
  const envs = await db.getApolloEnvironments();
  if (envs && envs.length > 0) return;

  await db.saveApolloEnvironment({
    id: 'ENV-DEV',
    name: 'Development Sandbox',
    environmentType: 'DEV',
    configJson: { dbPoolSize: 10, logLevel: 'DEBUG', enableExperimentalFeatures: true },
    targetVersion: '2.1.0',
    currentVersion: '2.1.0',
    healthStatus: 'HEALTHY'
  });

  await db.saveApolloEnvironment({
    id: 'ENV-STAGING',
    name: 'Staging Validation Cluster',
    environmentType: 'STAGING',
    configJson: { dbPoolSize: 20, logLevel: 'INFO', enableExperimentalFeatures: true },
    targetVersion: '2.0.0',
    currentVersion: '2.0.0',
    healthStatus: 'HEALTHY'
  });

  await db.saveApolloEnvironment({
    id: 'ENV-PROD-HQ',
    name: 'Production Police HQ Cluster',
    environmentType: 'PROD',
    configJson: { dbPoolSize: 100, logLevel: 'WARN', enableExperimentalFeatures: false, haMode: true },
    targetVersion: '2.0.0',
    currentVersion: '2.0.0',
    healthStatus: 'HEALTHY'
  });
}

// GET List all environments
router.get('/environments', authenticateMiddleware, async (req, res) => {
  try {
    await ensureSeedEnvironments();
    const envs = await db.getApolloEnvironments();
    res.json({
      success: true,
      count: envs.length,
      environments: envs.map(e => ({
        id: e.id,
        name: e.name,
        environmentType: e.environment_type,
        configJson: typeof e.config_json === 'string' ? JSON.parse(e.config_json) : e.config_json,
        targetVersion: e.target_version,
        currentVersion: e.current_version,
        healthStatus: e.health_status,
        lastPing: e.last_ping,
        updatedAt: e.updated_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch environments', message: err.message });
  }
});

// POST Register / update environment
router.post('/environments', authenticateMiddleware, abacMiddleware('ANALYTICAL_EXECUTION'), async (req, res) => {
  try {
    const { id, name, environmentType, configJson, targetVersion, currentVersion, healthStatus } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const saved = await db.saveApolloEnvironment({
      id,
      name,
      environmentType: environmentType || 'PROD',
      configJson: configJson || {},
      targetVersion: targetVersion || '2.0.0',
      currentVersion: currentVersion || '2.0.0',
      healthStatus: healthStatus || 'HEALTHY'
    });

    await db.logAudit(req.user.id, req.user.username, 'SAVE_APOLLO_ENV', 'APOLLO_ORCHESTRATION', `Saved Apollo environment ${saved.name}`, saved.id);

    res.status(201).json({ success: true, environment: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save environment', message: err.message });
  }
});

// GET Environment details by ID
router.get('/environments/:id', authenticateMiddleware, async (req, res) => {
  try {
    const env = await db.getApolloEnvironmentById(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });
    res.json({
      success: true,
      environment: {
        id: env.id,
        name: env.name,
        environmentType: env.environment_type,
        configJson: typeof env.config_json === 'string' ? JSON.parse(env.config_json) : env.config_json,
        targetVersion: env.target_version,
        currentVersion: env.current_version,
        healthStatus: env.health_status,
        lastPing: env.last_ping,
        updatedAt: env.updated_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch environment', message: err.message });
  }
});

// GET List release plans
router.get('/plans', authenticateMiddleware, async (req, res) => {
  try {
    const plans = await db.getApolloReleasePlans();
    res.json({
      success: true,
      count: plans.length,
      plans: plans.map(p => ({
        id: p.id,
        environmentId: p.environment_id,
        fromVersion: p.from_version,
        toVersion: p.to_version,
        status: p.status,
        approvalRequired: Boolean(p.approval_required),
        approvedBy: p.approved_by,
        stepsJson: typeof p.steps_json === 'string' ? JSON.parse(p.steps_json) : p.steps_json,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch release plans', message: err.message });
  }
});

// POST Create new release plan
router.post('/plans', authenticateMiddleware, abacMiddleware('ANALYTICAL_EXECUTION'), async (req, res) => {
  try {
    const { environmentId, fromVersion, toVersion, steps } = req.body;
    if (!environmentId || !toVersion) {
      return res.status(400).json({ error: 'environmentId and toVersion are required' });
    }

    const env = await db.getApolloEnvironmentById(environmentId);
    if (!env) return res.status(404).json({ error: 'Environment not found' });

    const defaultSteps = steps || [
      { step: 1, name: 'Pre-flight Database Schema Migration Check', status: 'PENDING' },
      { step: 2, name: 'Canary Binary Deployment', status: 'PENDING' },
      { step: 3, name: 'Post-deploy Health & Telemetry Verification', status: 'PENDING' }
    ];

    const plan = await db.saveApolloReleasePlan({
      environmentId,
      fromVersion: fromVersion || env.current_version,
      toVersion,
      status: 'PENDING_APPROVAL',
      approvalRequired: env.environment_type === 'PROD',
      approvedBy: req.user.username,
      stepsJson: defaultSteps
    });

    // Update environment target_version
    await db.saveApolloEnvironment({
      id: environmentId,
      targetVersion: toVersion
    });

    await db.logAudit(req.user.id, req.user.username, 'CREATE_RELEASE_PLAN', 'APOLLO_ORCHESTRATION', `Created release plan ${plan.id} for ${env.name} (v${env.current_version} -> v${toVersion})`, plan.id);

    res.status(201).json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create release plan', message: err.message });
  }
});

// POST Trigger Rollback
router.post('/plans/:id/rollback', authenticateMiddleware, abacMiddleware('ANALYTICAL_EXECUTION'), async (req, res) => {
  try {
    const originalPlan = await db.getApolloReleasePlanById(req.params.id);
    if (!originalPlan) return res.status(404).json({ error: 'Original release plan not found' });

    const env = await db.getApolloEnvironmentById(originalPlan.environment_id);

    // Create rollback plan
    const rollbackPlan = await db.saveApolloReleasePlan({
      environmentId: originalPlan.environment_id,
      fromVersion: env ? env.current_version : originalPlan.to_version,
      toVersion: originalPlan.from_version,
      status: 'SUCCESS',
      approvalRequired: false,
      approvedBy: req.user.username,
      stepsJson: [
        { step: 1, name: 'Automated Immediate Rollback Execution', status: 'COMPLETED' },
        { step: 2, name: 'Reverted Schema & Binary State', status: 'COMPLETED' }
      ]
    });

    // Immediately revert environment current_version & target_version
    await db.saveApolloEnvironment({
      id: originalPlan.environment_id,
      currentVersion: originalPlan.from_version,
      targetVersion: originalPlan.from_version,
      healthStatus: 'HEALTHY'
    });

    await db.logAudit(req.user.id, req.user.username, 'APOLLO_ROLLBACK', 'APOLLO_ORCHESTRATION', `Executed rollback on env ${originalPlan.environment_id} to version ${originalPlan.from_version}`, rollbackPlan.id);

    res.json({
      success: true,
      message: 'Rollback executed successfully',
      rollbackPlanId: rollbackPlan.id,
      revertedVersion: originalPlan.from_version
    });
  } catch (err) {
    res.status(500).json({ error: 'Rollback failed', message: err.message });
  }
});

// --- PULL-BASED AGENT MOCK ENDPOINTS ---

// POST Agent Ping / Poll
router.post('/agent/poll', async (req, res) => {
  try {
    const { environmentId, currentVersion, healthStatus } = req.body;
    if (!environmentId) return res.status(400).json({ error: 'environmentId required' });

    let env = await db.getApolloEnvironmentById(environmentId);
    if (!env) {
      env = await db.saveApolloEnvironment({
        id: environmentId,
        name: `Agent Env ${environmentId}`,
        currentVersion: currentVersion || '2.0.0',
        targetVersion: currentVersion || '2.0.0',
        healthStatus: healthStatus || 'HEALTHY'
      });
    } else {
      await db.execute(
        `UPDATE apollo_environments SET current_version = COALESCE($1, current_version), health_status = COALESCE($2, health_status), last_ping = CURRENT_TIMESTAMP WHERE id = $3`,
        [currentVersion || null, healthStatus || null, environmentId]
      );
      env = await db.getApolloEnvironmentById(environmentId);
    }

    // Find any active pending/deploying release plan for this env
    const plans = await db.getApolloReleasePlans();
    const activePlan = plans.find(p => p.environment_id === environmentId && (p.status === 'PENDING_APPROVAL' || p.status === 'DEPLOYING' || p.status === 'DRAFT'));

    res.json({
      success: true,
      environment: {
        id: env.id,
        currentVersion: env.current_version,
        targetVersion: env.target_version,
        configJson: typeof env.config_json === 'string' ? JSON.parse(env.config_json) : env.config_json
      },
      hasPendingRelease: Boolean(activePlan),
      activePlan: activePlan ? {
        id: activePlan.id,
        fromVersion: activePlan.from_version,
        toVersion: activePlan.to_version,
        status: activePlan.status,
        steps: typeof activePlan.steps_json === 'string' ? JSON.parse(activePlan.steps_json) : activePlan.steps_json
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Agent poll failed', message: err.message });
  }
});

// POST Agent Progress Update
router.post('/agent/progress', async (req, res) => {
  try {
    const { planId, stepIndex, stepStatus, isComplete } = req.body;
    if (!planId) return res.status(400).json({ error: 'planId is required' });

    const plan = await db.getApolloReleasePlanById(planId);
    if (!plan) return res.status(404).json({ error: 'Release plan not found' });

    const steps = typeof plan.steps_json === 'string' ? JSON.parse(plan.steps_json) : plan.steps_json;
    if (typeof stepIndex === 'number' && steps[stepIndex]) {
      steps[stepIndex].status = stepStatus || 'COMPLETED';
    }

    const allFinished = isComplete || steps.every(s => s.status === 'COMPLETED');
    const newStatus = allFinished ? 'SUCCESS' : 'DEPLOYING';

    await db.saveApolloReleasePlan({
      id: planId,
      status: newStatus,
      stepsJson: steps
    });

    if (allFinished) {
      await db.saveApolloEnvironment({
        id: plan.environment_id,
        currentVersion: plan.to_version,
        targetVersion: plan.to_version,
        healthStatus: 'HEALTHY'
      });
      await db.logAudit('APOLLO_AGENT', 'Apollo Release Agent', 'DEPLOYMENT_SUCCESS', 'APOLLO_ORCHESTRATION', `Environment ${plan.environment_id} upgraded to v${plan.to_version}`, plan.id);
    }

    res.json({
      success: true,
      planId,
      status: newStatus,
      targetVersion: plan.to_version,
      environmentUpdated: allFinished
    });
  } catch (err) {
    res.status(500).json({ error: 'Agent progress update failed', message: err.message });
  }
});

module.exports = router;
