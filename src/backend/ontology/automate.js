const db = require('../database');
const ontologyEngine = require('./engine');

class AutomateEngine {
  constructor() {
    this.intervalHandle = null;
    this.subscribers = new Set();
  }

  // Haversine distance in meters between two lat/lon pairs
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Ensure default operational Automate rules exist in system
  async ensureSeedAutomations() {
    try {
      const existingModel = await db.queryOne(`SELECT * FROM model_registry WHERE id = 'AUTOMATE_ALERT_ENGINE_V1'`);
      if (!existingModel) {
        await db.createModelRegistryEntry({
          id: 'AUTOMATE_ALERT_ENGINE_V1',
          modelName: 'Automate Alert Engine',
          modelVersion: 'v1.0',
          provider: 'Palantir Automate Engine',
          intendedUse: 'Automated condition evaluation and governed proposal generation',
          prohibitedUse: 'Direct autonomous execution without human approval'
        });
      }
    } catch (e) {
      console.warn('[AUTOMATE] Model registry seed note:', e.message);
    }

    const existing = await db.getAutomations();
    if (existing && existing.length > 0) return;

    // Seed Default Rule 1: High-Speed Movement Anomaly Alert
    await db.saveAutomation({
      id: 'AUTO-RULE-001',
      name: 'High-Speed Teleportation Anomaly',
      description: 'Triggers when consecutive subject detections imply physical movement speed exceeding 120 km/h',
      proposedActionType: 'FLAG_SUBJECT',
      conditionDefinition: {
        type: 'SPEED_PLAUSIBILITY',
        maxSpeedKmH: 120,
        targetObjectType: 'Observation'
      },
      reviewRequired: true,
      enabled: true,
      createdBy: 'System Engine'
    });

    // Seed Default Rule 2: Multi-Subject Co-Location Detector
    await db.saveAutomation({
      id: 'AUTO-RULE-002',
      name: 'Spatio-Temporal Co-Location (500m Window)',
      description: 'Triggers when two subjects are detected within 500 meters inside a 30-minute window',
      proposedActionType: 'FLAG_SUBJECT',
      conditionDefinition: {
        type: 'CO_LOCATION',
        radiusMeters: 500,
        timeWindowMinutes: 30,
        targetObjectType: 'Observation'
      },
      reviewRequired: true,
      enabled: true,
      createdBy: 'System Engine'
    });
  }

  // Main background evaluator method
  async evaluateAutomations() {
    await this.ensureSeedAutomations();
    const rules = await db.getAutomations();
    const activeRules = rules.filter(r => r.enabled);
    const proposalsCreated = [];

    // Query observations strictly through OntologyEngine generic access
    const observations = await ontologyEngine.getObjectsByType('Observation', {});

    for (const rule of activeRules) {
      let cond = typeof rule.condition_definition === 'string' ? JSON.parse(rule.condition_definition) : (rule.condition_definition || {});

      if (cond.type === 'SPEED_PLAUSIBILITY') {
        const maxSpeed = cond.maxSpeedKmH || 120;
        // Group observations by entity_id or license plate
        const obsByEntity = {};
        observations.forEach(o => {
          const entityId = o.properties?.entity_id || o.properties?.entityId || o.properties?.licensePlate;
          if (entityId) {
            if (!obsByEntity[entityId]) obsByEntity[entityId] = [];
            obsByEntity[entityId].push(o);
          }
        });

        for (const [entityId, obsList] of Object.entries(obsByEntity)) {
          if (obsList.length < 2) continue;
          obsList.sort((a, b) => new Date(a.properties.timestamp) - new Date(b.properties.timestamp));

          for (let i = 0; i < obsList.length - 1; i++) {
            const o1 = obsList[i];
            const o2 = obsList[i + 1];
            const lat1 = o1.properties.latitude || o1.properties.lat;
            const lon1 = o1.properties.longitude || o1.properties.lon;
            const lat2 = o2.properties.latitude || o2.properties.lat;
            const lon2 = o2.properties.longitude || o2.properties.lon;
            const t1 = new Date(o1.properties.timestamp).getTime();
            const t2 = new Date(o2.properties.timestamp).getTime();

            if (lat1 && lon1 && lat2 && lon2 && t2 > t1) {
              const distMeters = AutomateEngine.haversineDistance(lat1, lon1, lat2, lon2);
              const hours = (t2 - t1) / (3600 * 1000);
              const speedKmH = (distMeters / 1000) / hours;

              if (speedKmH > maxSpeed) {
                // Rule condition met -> create PENDING_REVIEW action proposal
                const proposalId = await this.createPendingReviewProposal(rule, {
                  entityId,
                  reviewPriority: 'P1_HIGH',
                  reason: `Automate Rule '${rule.name}' triggered: Calculated speed ${Math.round(speedKmH)} km/h exceeds threshold ${maxSpeed} km/h`
                });
                proposalsCreated.push({ ruleId: rule.id, proposalId, entityId, speedKmH });
              }
            }
          }
        }
      } else if (cond.type === 'CO_LOCATION') {
        const radius = cond.radiusMeters || 500;
        for (let i = 0; i < observations.length; i++) {
          for (let j = i + 1; j < observations.length; j++) {
            const o1 = observations[i];
            const o2 = observations[j];
            const e1 = o1.properties?.entity_id || o1.properties?.entityId;
            const e2 = o2.properties?.entity_id || o2.properties?.entityId;

            if (e1 && e2 && e1 !== e2) {
              const lat1 = o1.properties.latitude || o1.properties.lat;
              const lon1 = o1.properties.longitude || o1.properties.lon;
              const lat2 = o2.properties.latitude || o2.properties.lat;
              const lon2 = o2.properties.longitude || o2.properties.lon;

              if (lat1 && lon1 && lat2 && lon2) {
                const dist = AutomateEngine.haversineDistance(lat1, lon1, lat2, lon2);
                if (dist <= radius) {
                  const proposalId = await this.createPendingReviewProposal(rule, {
                    entityId: e1,
                    secondaryEntityId: e2,
                    reviewPriority: 'P1_HIGH',
                    reason: `Automate Rule '${rule.name}' triggered: Subjects detected within ${Math.round(dist)} meters`
                  });
                  proposalsCreated.push({ ruleId: rule.id, proposalId, entityId: e1 });
                }
              }
            }
          }
        }
      }
    }

    this.notifySubscribers({ event: 'EVALUATION_COMPLETE', count: proposalsCreated.length, proposals: proposalsCreated });
    return proposalsCreated;
  }

  // Create PENDING_REVIEW proposed action using shared review queue in ai_runs
  async createPendingReviewProposal(rule, actionInput) {
    const runId = `AUTO-PROP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const proposedActionType = rule.proposed_action_type || rule.proposedActionType || 'FLAG_SUBJECT';

    await db.createAIRun({
      id: runId,
      promptTask: 'AUTOMATE_PROPOSED_ACTION',
      modelId: 'AUTOMATE_ALERT_ENGINE_V1',
      caseId: actionInput.caseId || 'CASE-AP-2026-0001',
      inputParams: {
        actionType: proposedActionType,
        input: actionInput,
        ruleId: rule.id,
        ruleName: rule.name
      },
      outputText: `[AUTOMATE PROPOSAL] Rule '${rule.name}' proposed execution of Action '${proposedActionType}' on ${actionInput.entityId}. Requires Human Approval.`,
      citedEvidenceIds: actionInput.evidenceId ? [actionInput.evidenceId] : [],
      confidenceScore: 0.98,
      reviewStatus: 'PENDING_REVIEW'
    });

    await db.logAudit('AUTOMATE_ENGINE', 'Automate Engine', 'CREATE_PROPOSAL', 'AUTOMATE_ALERTING', `Proposed action ${proposedActionType} for ${actionInput.entityId}`, actionInput.entityId, actionInput.caseId || 'CASE-AP-2026-0001');

    return runId;
  }

  // Subscriber methods for SSE / live updates
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(data) {
    for (const sub of this.subscribers) {
      try {
        sub(data);
      } catch (e) {}
    }
  }

  startPeriodicEvaluation(intervalMs = 30000) {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = setInterval(() => {
      this.evaluateAutomations().catch(err => console.error('[AUTOMATE ENGINE] Evaluation error:', err.message));
    }, intervalMs);
  }

  stopPeriodicEvaluation() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

const automateEngine = new AutomateEngine();
module.exports = automateEngine;
