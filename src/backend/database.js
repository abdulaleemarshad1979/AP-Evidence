const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.users = [];
    this.cases = [];
    this.entities = [];
    this.relationships = [];
    this.events = [];
    this.evidence = [];
    this.resolutionCandidates = [];
    this.auditLogs = [];
    this.imports = [];
  }

  // Hash helper
  static sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // User methods
  getUserByUsername(username) {
    return this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  // Audit Ledger helper
  logAudit(userId, username, action, moduleName, details, targetEntityId = null) {
    const prevHash = this.auditLogs.length > 0 
      ? this.auditLogs[this.auditLogs.length - 1].hash 
      : '0000000000000000000000000000000000000000000000000000000000000000';
    
    const timestamp = new Date().toISOString();
    const payloadStr = JSON.stringify({ userId, action, moduleName, details, targetEntityId, timestamp, prevHash });
    const hash = Database.sha256(payloadStr);

    const auditEntry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      username: username || 'System',
      action,
      module: moduleName,
      details,
      targetEntityId,
      timestamp,
      prevHash,
      hash
    };

    this.auditLogs.push(auditEntry);
    return auditEntry;
  }

  // Case methods
  getCases() {
    return this.cases;
  }

  getCaseById(id) {
    return this.cases.find(c => c.id === id);
  }

  createCase(caseData, user) {
    const newCase = {
      id: `CASE-${Date.now().toString().slice(-6)}`,
      title: caseData.title,
      codeName: caseData.codeName || `OPERATION_${caseData.title.toUpperCase().replace(/\s+/g, '_')}`,
      description: caseData.description,
      classification: caseData.classification || 'SECRET',
      threatLevel: caseData.threatLevel || 'HIGH',
      status: caseData.status || 'ACTIVE',
      assignedAnalysts: caseData.assignedAnalysts || [user.name],
      targetEntityIds: caseData.targetEntityIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.cases.push(newCase);
    this.logAudit(user.id, user.name, 'CREATE_CASE', 'Case Management', `Created case ${newCase.id} - ${newCase.title}`);
    return newCase;
  }

  // Entity & Subject 360 methods
  getEntities(filter = {}) {
    let result = this.entities;
    if (filter.type) {
      result = result.filter(e => e.type === filter.type);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(e => 
        e.name?.toLowerCase().includes(q) || 
        e.id.toLowerCase().includes(q) ||
        e.primaryPhone?.includes(q) ||
        e.passportNo?.toLowerCase().includes(q) ||
        e.licensePlate?.toLowerCase().includes(q)
      );
    }
    return result;
  }

  getEntityById(id) {
    return this.entities.find(e => e.id === id);
  }

  getSubject360(entityId) {
    const subject = this.getEntityById(entityId);
    if (!subject) return null;

    // Direct relationships
    const rels = this.relationships.filter(r => r.source === entityId || r.target === entityId);
    
    // Linked entities
    const linkedIds = new Set();
    rels.forEach(r => {
      linkedIds.add(r.source === entityId ? r.target : r.source);
    });

    const linkedEntities = this.entities.filter(e => linkedIds.has(e.id));

    // Subject events
    const subjectEvents = this.events.filter(ev => 
      ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Linked evidence
    const linkedEvidence = this.evidence.filter(ev => 
      ev.associatedEntityIds && ev.associatedEntityIds.includes(entityId)
    );

    // Linked cases
    const linkedCases = this.cases.filter(c => 
      c.targetEntityIds && c.targetEntityIds.includes(entityId)
    );

    // Resolution history
    const resolutions = this.resolutionCandidates.filter(rc => 
      rc.entityA === entityId || rc.entityB === entityId
    );

    return {
      subject,
      relationships: rels,
      linkedEntities,
      events: subjectEvents,
      evidence: linkedEvidence,
      cases: linkedCases,
      resolutions
    };
  }

  // Graph network helper
  getGraphNetwork(centerId = null, depth = 2, caseId = null) {
    let nodes = [];
    let edges = [];

    if (!centerId) {
      // Return top network
      nodes = this.entities.slice(0, 30);
      const nodeSet = new Set(nodes.map(n => n.id));
      edges = this.relationships.filter(r => nodeSet.has(r.source) && nodeSet.has(r.target));
    } else {
      const visited = new Set();
      const queue = [{ id: centerId, currentDepth: 0 }];

      while (queue.length > 0) {
        const { id, currentDepth } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);

        const entity = this.getEntityById(id);
        if (entity) nodes.push(entity);

        if (currentDepth < depth) {
          const connectedRels = this.relationships.filter(r => r.source === id || r.target === id);
          connectedRels.forEach(r => {
            edges.push(r);
            const neighbor = r.source === id ? r.target : r.source;
            if (!visited.has(neighbor)) {
              queue.push({ id: neighbor, currentDepth: currentDepth + 1 });
            }
          });
        }
      }
    }

    // Deduplicate edges
    const edgeMap = new Map();
    edges.forEach(e => {
      const key = [e.source, e.target].sort().join('::') + '::' + e.type;
      edgeMap.set(key, e);
    });

    return {
      nodes: nodes.map(n => ({
        id: n.id,
        label: n.name || n.id,
        type: n.type,
        riskScore: n.riskScore || 50,
        classification: n.classification || 'SECRET',
        details: n
      })),
      edges: Array.from(edgeMap.values()).map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        confidence: e.confidence || 0.85,
        evidenceRef: e.evidenceRef
      }))
    };
  }

  // Merge entities (Human review outcome)
  mergeEntities(primaryId, secondaryId, reviewer) {
    const primary = this.getEntityById(primaryId);
    const secondary = this.getEntityById(secondaryId);

    if (!primary || !secondary) {
      throw new Error("One or both entities not found for merge");
    }

    // Merge aliases and phones
    primary.aliases = Array.from(new Set([...(primary.aliases || []), ...(secondary.aliases || []), secondary.name]));
    primary.phoneNumbers = Array.from(new Set([...(primary.phoneNumbers || []), ...(secondary.phoneNumbers || []), secondary.primaryPhone].filter(Boolean)));
    primary.notes = (primary.notes || '') + `\n[MERGED] Integrated data from ${secondary.id} (${secondary.name})`;
    primary.riskScore = Math.max(primary.riskScore || 0, secondary.riskScore || 0);

    // Re-point relationships
    this.relationships.forEach(r => {
      if (r.source === secondaryId) r.source = primaryId;
      if (r.target === secondaryId) r.target = primaryId;
    });

    // Re-point events
    this.events.forEach(ev => {
      if (ev.associatedEntityIds) {
        ev.associatedEntityIds = ev.associatedEntityIds.map(id => id === secondaryId ? primaryId : id);
      }
    });

    // Re-point evidence
    this.evidence.forEach(ev => {
      if (ev.associatedEntityIds) {
        ev.associatedEntityIds = ev.associatedEntityIds.map(id => id === secondaryId ? primaryId : id);
      }
    });

    // Update candidate state
    this.resolutionCandidates.forEach(rc => {
      if ((rc.entityA === primaryId && rc.entityB === secondaryId) || (rc.entityA === secondaryId && rc.entityB === primaryId)) {
        rc.status = 'MERGED';
        rc.reviewedBy = reviewer.name;
        rc.reviewedAt = new Date().toISOString();
      }
    });

    // Remove secondary entity
    this.entities = this.entities.filter(e => e.id !== secondaryId);

    this.logAudit(reviewer.id, reviewer.name, 'MERGE_ENTITIES', 'Entity Resolution', `Merged ${secondaryId} into ${primaryId}`);
    return primary;
  }
}

const db = new Database();
module.exports = db;
