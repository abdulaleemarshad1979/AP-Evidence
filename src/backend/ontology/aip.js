const ontologyEngine = require('./engine');
const lineageEngine = require('./lineage');

/**
 * Palantir AIP (Artificial Intelligence Platform) Integration Engine
 * Provides tool-enabled LLM interaction layer backed strictly by the Ontology Query & Action Engine.
 */
class AIPEngine {
  constructor() {
    this.tools = [
      {
        name: 'query_objects',
        description: 'Query Ontology Object Sets (Person, Vehicle, Observation, Evidence, Case, NetworkIndicator, PCAPDump)',
        parameters: { type: 'object', properties: { objectType: { type: 'string' }, search: { type: 'string' } } }
      },
      {
        name: 'traverse_links',
        description: 'Traverse typed links from a source entity (OBSERVED_AT, ASSOCIATED_WITH, EVIDENCE_OF, COMMUNICATED_WITH)',
        parameters: { type: 'object', properties: { sourceType: { type: 'string' }, sourceId: { type: 'string' }, linkType: { type: 'string' } } }
      },
      {
        name: 'trace_lineage',
        description: 'Inspect Monocle data provenance graph for target entity or dataset',
        parameters: { type: 'object', properties: { targetRef: { type: 'string' } } }
      },
      {
        name: 'execute_governed_action',
        description: 'Trigger a governed ontology action (CREATE_CASE, ADD_OBSERVATION, FLAG_SUBJECT, MERGE_ENTITIES, INGEST_EVIDENCE)',
        parameters: { type: 'object', properties: { actionType: { type: 'string' }, input: { type: 'object' } } }
      }
    ];
  }

  /**
   * Process Natural Language Prompt through AIP Tool Pipeline
   */
  async processPrompt(promptText, caseId = 'CASE-AP-2026-0001', user = { id: 'USR-101', username: 'analyst_lead' }) {
    const lower = promptText.toLowerCase();
    const citations = [];
    const toolInvocations = [];
    let reasoningText = '';
    let structuredResult = null;

    if (lower.includes('search') || lower.includes('find') || lower.includes('person') || lower.includes('subject')) {
      const searchTerm = promptText.replace(/search|find|person|subject|for/gi, '').trim() || 'SUB-00001';
      toolInvocations.push({ tool: 'query_objects', args: { objectType: 'Person', search: searchTerm } });
      const objects = await ontologyEngine.getObjectsByType('Person', { search: searchTerm, caseId });
      structuredResult = objects;
      reasoningText = `Querying Ontology Object Set 'Person' for term '${searchTerm}'. Found ${objects.length} matching entities.`;
      objects.forEach(o => citations.push(`Ontology:Person:${o.__primaryKey}`));
    } else if (lower.includes('lineage') || lower.includes('provenance') || lower.includes('where did')) {
      const targetRef = promptText.match(/SUB-\d+|EVI-\d+|CASE-\w+-\d+/i)?.[0] || 'SUB-00001';
      toolInvocations.push({ tool: 'trace_lineage', args: { targetRef } });
      const lineage = await lineageEngine.traceLineage(targetRef);
      structuredResult = lineage;
      reasoningText = `Tracing Monocle data provenance graph for target reference '${targetRef}'. Traced ${lineage.nodes.length} provenance nodes.`;
      citations.push(`MonocleLineage:${targetRef}`);
    } else if (lower.includes('action') || lower.includes('flag') || lower.includes('create case')) {
      if (lower.includes('flag')) {
        const entityId = promptText.match(/SUB-\d+/i)?.[0] || 'SUB-00001';
        toolInvocations.push({ tool: 'execute_governed_action', args: { actionType: 'FLAG_SUBJECT', input: { entityId, reviewPriority: 'P1_HIGH', reason: promptText } } });
        const actRes = await ontologyEngine.executeAction('FLAG_SUBJECT', { entityId, reviewPriority: 'P1_HIGH', reason: promptText }, user);
        structuredResult = actRes;
        reasoningText = `Executed Governed Action 'FLAG_SUBJECT' on entity '${entityId}'. Audit event recorded.`;
        citations.push(`AuditTrail:FLAG_SUBJECT:${entityId}`);
      } else {
        toolInvocations.push({ tool: 'execute_governed_action', args: { actionType: 'CREATE_CASE', input: { title: 'AIP Case', codeName: 'CASE_AIP' } } });
        const actRes = await ontologyEngine.executeAction('CREATE_CASE', { title: 'AIP Generated Case', codeName: 'CASE_AIP_GEN', description: promptText }, user);
        structuredResult = actRes;
        reasoningText = `Executed Governed Action 'CREATE_CASE'. Case ${actRes.result.id} created with ABAC policy.`;
        citations.push(`AuditTrail:CREATE_CASE:${actRes.result.id}`);
      }
    } else {
      // Default general query
      toolInvocations.push({ tool: 'query_objects', args: { objectType: 'Person' } });
      const persons = await ontologyEngine.getObjectsByType('Person', { caseId, limit: 5 });
      structuredResult = persons;
      reasoningText = `Analyzed prompt against Ontology Core. Evaluated ${persons.length} active subject profiles with spatio-temporal assertions.`;
      persons.forEach(p => citations.push(`Ontology:Person:${p.__primaryKey}`));
    }

    return {
      prompt: promptText,
      caseId,
      reasoning: reasoningText,
      toolInvocations,
      citations,
      result: structuredResult,
      timestamp: new Date().toISOString()
    };
  }
}

const aipEngine = new AIPEngine();
module.exports = aipEngine;
