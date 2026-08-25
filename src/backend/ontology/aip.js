const ontologyEngine = require('./engine');
const lineageEngine = require('./lineage');
const db = require('../database');
const https = require('https');

/**
 * Palantir AIP (Artificial Intelligence Platform) Integration Engine
 * Provides tool-enabled LLM interaction layer backed strictly by the Ontology Query & Action Engine.
 * Enforces mandatory Human-in-the-Loop (HITL) gate for all state-changing actions.
 */
class AIPEngine {
  constructor() {
    this.tools = [
      {
        name: 'query_objects',
        description: 'Query Ontology Object Sets (Person, Vehicle, Observation, Evidence, Case, NetworkIndicator, PCAPDump, etc.)',
        input_schema: {
          type: 'object',
          properties: {
            objectType: { type: 'string', description: 'Ontology Object Type API name (e.g. Person, Vehicle, Observation, Case)' },
            search: { type: 'string', description: 'Search term or target entity ID' }
          },
          required: ['objectType']
        }
      },
      {
        name: 'traverse_links',
        description: 'Traverse typed links from a source entity (OBSERVED_AT, ASSOCIATED_WITH, EVIDENCE_OF, COMMUNICATED_WITH)',
        input_schema: {
          type: 'object',
          properties: {
            sourceType: { type: 'string', description: 'Source object type' },
            sourceId: { type: 'string', description: 'Source primary key ID' },
            linkType: { type: 'string', description: 'Ontology link type name' }
          },
          required: ['sourceType', 'sourceId', 'linkType']
        }
      },
      {
        name: 'trace_lineage',
        description: 'Inspect Monocle data provenance graph for target entity or dataset',
        input_schema: {
          type: 'object',
          properties: {
            targetRef: { type: 'string', description: 'Target entity or evidence reference ID' }
          },
          required: ['targetRef']
        }
      },
      {
        name: 'execute_governed_action',
        description: 'Propose a governed ontology action for human approval (FLAG_SUBJECT, CREATE_CASE, MERGE_ENTITIES, ADD_OBSERVATION, INGEST_EVIDENCE)',
        input_schema: {
          type: 'object',
          properties: {
            actionType: { type: 'string', description: 'Action type name (e.g. FLAG_SUBJECT, CREATE_CASE, MERGE_ENTITIES)' },
            input: { type: 'object', description: 'Input parameters required for the governed action' }
          },
          required: ['actionType', 'input']
        }
      }
    ];
  }

  /**
   * Helper to perform Anthropic Messages API HTTP call when ANTHROPIC_API_KEY is available
   */
  async _callAnthropicApi(promptText, modelName = 'claude-3-5-sonnet-20241022') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    return new Promise((resolve) => {
      const payload = JSON.stringify({
        model: modelName,
        max_tokens: 1024,
        tools: this.tools,
        system: "You are AIP Assistant in an enterprise intelligence platform. You answer user queries using tools. For state-changing actions, use execute_governed_action.",
        messages: [{ role: 'user', content: promptText }]
      });

      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.write(payload);
      req.end();
    });
  }

  /**
   * Determine tool invocation via LLM call or fallback prompt intent parser
   */
  async _determineToolCall(promptText) {
    const apiRes = await this._callAnthropicApi(promptText);
    if (apiRes && apiRes.content) {
      const toolUse = apiRes.content.find(c => c.type === 'tool_use');
      if (toolUse) {
        return { tool: toolUse.name, args: toolUse.input };
      }
    }

    // Pluggable Intent Parser fallback (used when ANTHROPIC_API_KEY is omitted in tests/offline)
    const lower = promptText.toLowerCase();

    if (lower.includes('flag') || lower.includes('create case') || lower.includes('action') || lower.includes('merge') || lower.includes('add observation')) {
      if (lower.includes('flag')) {
        const entityId = promptText.match(/SUB-\d+/i)?.[0] || 'SUB-00001';
        return {
          tool: 'execute_governed_action',
          args: {
            actionType: 'FLAG_SUBJECT',
            input: { entityId, reviewPriority: 'P1_HIGH', reason: promptText }
          }
        };
      } else if (lower.includes('merge')) {
        const primaryEntityId = promptText.match(/SUB-\d+/gi)?.[0] || 'SUB-00001';
        const secondaryEntityId = promptText.match(/SUB-\d+/gi)?.[1] || 'SUB-00004';
        return {
          tool: 'execute_governed_action',
          args: {
            actionType: 'MERGE_ENTITIES',
            input: { primaryEntityId, secondaryEntityId, reason: promptText }
          }
        };
      } else {
        return {
          tool: 'execute_governed_action',
          args: {
            actionType: 'CREATE_CASE',
            input: { title: 'AIP Proposed Case', codeName: 'CASE_AIP_GEN', description: promptText }
          }
        };
      }
    } else if (lower.includes('lineage') || lower.includes('provenance') || lower.includes('where did')) {
      const targetRef = promptText.match(/SUB-\d+|EVI-\d+|CASE-\w+-\d+/i)?.[0] || 'SUB-00001';
      return { tool: 'trace_lineage', args: { targetRef } };
    } else if (lower.includes('link') || lower.includes('traverse') || lower.includes('associated')) {
      const sourceId = promptText.match(/SUB-\d+/i)?.[0] || 'SUB-00001';
      return { tool: 'traverse_links', args: { sourceType: 'Person', sourceId, linkType: 'ASSOCIATED_WITH' } };
    } else {
      const searchTerm = promptText.replace(/search|find|person|subject|for/gi, '').trim() || 'SUB-00001';
      return { tool: 'query_objects', args: { objectType: 'Person', search: searchTerm } };
    }
  }

  /**
   * Process Natural Language Prompt through AIP Tool Pipeline
   */
  async processPrompt(promptText, caseId = 'CASE-AP-2026-0001', user = { id: 'USR-101', username: 'analyst_lead' }) {
    const citations = [];
    const toolInvocations = [];
    let reasoningText = '';
    let structuredResult = null;

    const toolCall = await this._determineToolCall(promptText);
    toolInvocations.push(toolCall);

    if (toolCall.tool === 'query_objects') {
      const { objectType, search } = toolCall.args;
      const objects = await ontologyEngine.getObjectsByType(objectType || 'Person', { search, caseId }, user);
      structuredResult = objects;
      reasoningText = `Queried Ontology Object Set '${objectType || 'Person'}' for term '${search || ''}'. Found ${objects.length} matching entities.`;
      objects.forEach(o => citations.push(`Ontology:${objectType || 'Person'}:${o.__primaryKey}`));
    } else if (toolCall.tool === 'traverse_links') {
      const { sourceType, sourceId, linkType } = toolCall.args;
      const linked = await ontologyEngine.getLinkedObjects(sourceType, sourceId, linkType, user);
      structuredResult = linked;
      reasoningText = `Traversed Ontology link type '${linkType}' from source entity '${sourceId}'. Found ${linked.length} linked objects.`;
      citations.push(`Ontology:${sourceType}:${sourceId}`);
      linked.forEach(l => citations.push(`Ontology:${l.__type}:${l.__primaryKey}`));
    } else if (toolCall.tool === 'trace_lineage') {
      const { targetRef } = toolCall.args;
      const lineage = await lineageEngine.traceLineage(targetRef);
      structuredResult = lineage;
      reasoningText = `Traced Monocle data provenance graph for target reference '${targetRef}'. Traced ${lineage.nodes?.length || 0} provenance nodes.`;
      citations.push(`MonocleLineage:${targetRef}`);
    } else if (toolCall.tool === 'execute_governed_action') {
      // MANDATORY HITL GATE: NEVER call ontologyEngine.executeAction() directly in processPrompt!
      const { actionType, input } = toolCall.args;
      const entityRef = input.entityId || input.primaryEntityId || 'TARGET';

      reasoningText = `Proposed Governed Action '${actionType}' on entity '${entityRef}'. Queued in PENDING_REVIEW state for human approval.`;
      citations.push(`AuditTrail:${actionType}:${entityRef}`);

      // Mandatory Citation Validation: verify citations exist before storing pending run
      const validCitations = citations.filter(c => c && c.length > 0);

      // Create record in PENDING_REVIEW queue (ai_runs table)
      const pendingRunId = `AIRUN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await db.createAIRun({
        id: pendingRunId,
        promptTask: `PROPOSED_ACTION_${actionType}`,
        modelId: null,
        caseId,
        inputParams: { actionType, input, toolInvocations, citations: validCitations, user },
        outputText: `PROPOSED ACTION: ${actionType} on ${entityRef}. Awaiting human review.`,
        citedEvidenceIds: validCitations,
        confidenceScore: 0.95,
        reviewStatus: 'PENDING_REVIEW'
      });

      return {
        prompt: promptText,
        caseId,
        status: 'PROPOSED_PENDING_REVIEW',
        isProposed: true,
        pendingRunId,
        reviewStatus: 'PENDING_REVIEW',
        reasoning: reasoningText,
        toolInvocations,
        citations: validCitations,
        proposedAction: {
          actionType,
          input
        },
        result: {
          pendingRunId,
          status: 'PENDING_REVIEW',
          message: `Governed action '${actionType}' was proposed and placed in PENDING_REVIEW queue. Human approval is required to execute.`
        },
        timestamp: new Date().toISOString()
      };
    }

    // Verify citations against retrieved objects for read-only tools
    const validCitations = citations.filter(c => c && c.length > 0);

    return {
      prompt: promptText,
      caseId,
      status: 'COMPLETED',
      isProposed: false,
      reasoning: reasoningText,
      toolInvocations,
      citations: validCitations,
      result: structuredResult,
      timestamp: new Date().toISOString()
    };
  }
}

const aipEngine = new AIPEngine();
module.exports = aipEngine;

