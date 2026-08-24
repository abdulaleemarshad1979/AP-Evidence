const db = require('../database');

function getContextUser(req) {
  // 1. Check Authorization header (Bearer token)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Token format: TOKEN-USR-xxx-<timestamp>
    const match = token.match(/TOKEN-(USR-\d+)/);
    if (match) {
      const user = db.getUserById(match[1]);
      if (user) return user;
    }
  }

  // 2. Fallback to X-User-Id header for testing
  const userId = req.headers['x-user-id'] || 'USR-101';
  return db.getUserById(userId);
}

function checkAbacAccess(user, targetCase, action) {
  if (!user || !targetCase) return false;

  // 1. Classification check
  if (targetCase.classification !== 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE') {
    return false;
  }

  // 2. Admin & Auditor exceptions for systemic actions
  if (user.role === 'Admin') return true;
  if (user.role === 'Auditor' && (action === 'READ' || action === 'LIST' || action === 'AUDIT')) return true;

  // 3. Organization & Jurisdiction match
  const orgMatch = user.organization === targetCase.organization;
  const jurMatch = user.jurisdiction === targetCase.jurisdiction || user.jurisdiction === 'JUR-GLOBAL';

  // 4. Case assignment check
  const assignments = db.getCaseAssignments(targetCase.id);
  const isAssigned = assignments.includes(user.id);

  if (!isAssigned && !(orgMatch && jurMatch)) {
    return false;
  }

  // 5. Purpose Clearance match
  const permittedPurposes = targetCase.permittedPurposes || [];
  if (user.purposeClearance !== 'SYSTEM_ADMIN' && !permittedPurposes.includes(user.purposeClearance)) {
    return false;
  }

  // 6. Action permission based on role
  if (action === 'CHANGE' || action === 'MERGE' || action === 'INGEST') {
    if (user.role !== 'Analyst' && user.role !== 'Case Manager') return false;
  }

  return true;
}

function abacMiddleware(action, caseIdResolver = null) {
  return (req, res, next) => {
    const user = getContextUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token authorization header' });
    }

    req.user = user;

    // Resolve Case ID
    let caseId = null;
    if (caseIdResolver) {
      caseId = caseIdResolver(req);
    } else {
      caseId = req.params.caseId || req.params.id || req.query.caseId;
    }

    if (caseId) {
      const targetCase = db.getCaseById(caseId);
      if (!targetCase) {
        return res.status(404).json({ error: `Case ${caseId} not found` });
      }

      const permitted = checkAbacAccess(user, targetCase, action);
      if (!permitted) {
        db.logAudit(
          user.id,
          user.name,
          'ACCESS_DENIED',
          'ABAC Enforcement',
          `Access denied for action '${action}' on case ${caseId} (Role: ${user.role}, Org: ${user.organization}, Jur: ${user.jurisdiction}, Purpose: ${user.purposeClearance})`,
          null,
          caseId
        );
        return res.status(403).json({
          error: 'Access Denied',
          message: `ABAC policy denied user '${user.username}' for action '${action}' on case '${caseId}'`
        });
      }
      req.targetCase = targetCase;
    }

    next();
  };
}

module.exports = {
  abacMiddleware,
  getContextUser,
  checkAbacAccess
};
