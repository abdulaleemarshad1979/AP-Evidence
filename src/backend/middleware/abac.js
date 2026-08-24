const db = require('../database');
const { getContextUser } = require('./auth');

/**
 * Route Policy Matrix Definition
 * Maps routes to required permission actions
 */
const ROUTE_POLICY_MATRIX = {
  'POST /api/cases': 'CREATE_CASE',
  'GET /api/cases': 'LIST',
  'GET /api/cases/:id': 'READ',
  'POST /api/import/ingest': 'INGEST',
  'POST /api/review/merge': 'MERGE',
  'POST /api/review/reverse': 'REVERSE',
  'POST /api/review/reject': 'MERGE',
  'GET /api/evidence/export/:id': 'EXPORT_EVIDENCE',
  'GET /api/audit/logs': 'READ_AUDIT',
  'GET /api/audit/verify': 'READ_AUDIT'
};

async function checkAbacAccess(user, targetCase, action) {
  if (!user) return false;

  // Global Auditors can read audit logs without case binding
  if (action === 'READ_AUDIT') {
    return user.role === 'Auditor' || user.role === 'Admin';
  }

  if (action === 'CREATE_CASE') {
    return user.role === 'Analyst' || user.role === 'Case Manager' || user.role === 'Admin';
  }

  if (!targetCase) {
    // Default Deny: Never infer access if targetCase is missing for case-scoped actions
    return false;
  }

  // 1. Classification check
  if (targetCase.classification !== 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE') {
    return false;
  }

  // 2. Admin exception for systemic administration
  if (user.role === 'Admin') return true;

  // 3. Auditor exception for read access
  if (user.role === 'Auditor' && (action === 'READ' || action === 'LIST' || action === 'READ_AUDIT')) return true;

  // 4. Organization & Jurisdiction match
  const orgMatch = user.organization === targetCase.organization;
  const jurMatch = user.jurisdiction === targetCase.jurisdiction || user.jurisdiction === 'JUR-GLOBAL';

  // 5. Case assignment check
  const assignments = await db.getCaseAssignments(targetCase.id);
  const isAssigned = assignments.includes(user.id);

  if (!isAssigned && !(orgMatch && jurMatch)) {
    return false;
  }

  // 6. Purpose Clearance match
  const permittedPurposes = targetCase.permittedPurposes || [];
  if (user.purposeClearance !== 'SYSTEM_ADMIN' && !permittedPurposes.includes(user.purposeClearance)) {
    return false;
  }

  // 7. Action role requirement
  if (action === 'INGEST' || action === 'MERGE' || action === 'REVERSE') {
    if (user.role !== 'Analyst' && user.role !== 'Case Manager') return false;
  }

  if (action === 'EXPORT_EVIDENCE') {
    if (user.role !== 'Analyst' && user.role !== 'Case Manager' && user.role !== 'Admin') return false;
  }

  return true;
}

/**
 * ABAC Express Middleware
 */
function abacMiddleware(action, caseIdResolver = null) {
  return async (req, res, next) => {
    const user = req.user || (await getContextUser(req));
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid OIDC JWT bearer access token.'
      });
    }

    req.user = user;

    if (action === 'READ_AUDIT') {
      if (user.role !== 'Auditor' && user.role !== 'Admin') {
        await db.logAudit(user.id, user.name, 'ACCESS_DENIED', 'Audit Log', `Access denied to audit ledger for role '${user.role}'`);
        return res.status(403).json({ error: 'Access Denied', message: 'Explicit READ_AUDIT permission required.' });
      }
      return next();
    }

    if (action === 'CREATE_CASE') {
      if (user.role !== 'Analyst' && user.role !== 'Case Manager' && user.role !== 'Admin') {
        return res.status(403).json({ error: 'Access Denied', message: 'Explicit CREATE_CASE permission required.' });
      }
      return next();
    }

    // Resolve Case ID for case-scoped checks
    let caseId = null;
    if (caseIdResolver) {
      caseId = await caseIdResolver(req);
    } else {
      caseId = req.params.caseId || req.params.id || req.query.caseId || (req.body && req.body.caseId);
    }

    if (!caseId) {
      // Default Deny if route requires case context but caseId is missing
      await db.logAudit(user.id, user.name, 'ACCESS_DENIED', 'ABAC', `Access denied: missing case context for action '${action}'`);
      return res.status(403).json({
        error: 'Access Denied',
        message: `Default Deny: Action '${action}' requires explicit case context.`
      });
    }

    const targetCase = await db.getCaseById(caseId);
    if (!targetCase) {
      return res.status(404).json({ error: `Case '${caseId}' not found` });
    }

    const permitted = await checkAbacAccess(user, targetCase, action);
    if (!permitted) {
      await db.logAudit(
        user.id,
        user.name,
        'ACCESS_DENIED',
        'ABAC Enforcement',
        `Access denied for action '${action}' on case ${caseId} (User: ${user.username}, Role: ${user.role}, Org: ${user.organization}, Jur: ${user.jurisdiction}, Purpose: ${user.purposeClearance})`,
        null,
        caseId
      );
      return res.status(403).json({
        error: 'Access Denied',
        message: `ABAC policy denied user '${user.username}' for action '${action}' on case '${caseId}'`
      });
    }

    req.targetCase = targetCase;
    next();
  };
}

module.exports = {
  ROUTE_POLICY_MATRIX,
  checkAbacAccess,
  abacMiddleware
};
