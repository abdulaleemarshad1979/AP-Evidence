const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'AP_INTELLIGENCE_PLATFORM_SECURE_JWT_SECRET_2026_PASS2';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://keycloak.internal/realms/ap-intelligence';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ap-evidence-app';

// Safety check for production mode
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('YOUR_SECURE'))) {
  console.warn('[SECURITY ALERT] Production mode requires a custom strong JWT_SECRET environment variable!');
}

/**
 * Helper to parse cookies from raw Header string
 */
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

/**
 * Get numerical clearance level for role
 */
function getClearanceLevel(role) {
  if (role === 'Admin') return 4;
  if (role === 'Lead Investigator') return 3;
  if (role === 'Field Analyst' || role === 'Analyst' || role === 'Case Manager') return 2;
  if (role === 'Auditor') return 1;
  return 1;
}

/**
 * Sign a JWT token with full claim set including clearance level
 */
function signJwtToken(user) {
  const clearanceLevel = getClearanceLevel(user.role);
  const payload = {
    sub: user.id,
    preferred_username: user.username,
    name: user.name,
    role: user.role,
    clearance_level: clearanceLevel,
    organization: user.organization,
    jurisdiction: user.jurisdiction,
    purpose_clearance: user.purposeClearance
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '8h',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256'
  });
}

/**
 * Verify JWT access token with full verification of issuer, audience, signature, and expiration
 */
function verifyJwtToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256']
    });
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Extract and verify authenticated user context from request
 * Supports Authorization header or HttpOnly apis_session cookie
 */
async function getContextUser(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookies = parseCookies(req);
    token = cookies['apis_session'] || null;
  }

  if (!token) return null;

  const decoded = verifyJwtToken(token);
  if (!decoded || !decoded.sub) {
    return null;
  }

  const user = await db.getUserById(decoded.sub);
  if (!user) return null;

  const clearanceLevel = getClearanceLevel(user.role);
  return {
    ...user,
    clearanceLevel,
    jwtClaims: decoded
  };
}

/**
 * Need-to-know Data Masking:
 * If entity clearance > user clearance, automatically mask identifiers and sensitive fields
 */
function maskSubjectData(entity, userClearanceLevel = 2) {
  if (!entity) return null;
  const requiredClearance = entity.metadata?.clearanceRequired || entity.clearanceRequired || 2;
  
  if (userClearanceLevel < requiredClearance) {
    const maskedId = entity.id.length > 3 ? `${entity.id.substring(0, 2)}-******` : '******';
    return {
      ...entity,
      name: `CLASSIFIED SUBJECT (${maskedId})`,
      aliases: ['[REDACTED ALIAS]'],
      identifierFields: {
        nationalId: '***-REDACTED-CLEARANCE-LEVEL-3-REQUIRED-***',
        primaryPhone: '+91-XXXXX-XXXXX',
        passportNo: 'SYN-XX-XXXXXX',
        registeredVehicles: ['[REDACTED VEHICLE]']
      },
      metadata: {
        ...(entity.metadata || {}),
        primaryLocation: 'CLASSIFIED LOCATION [REDACTED]',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        dataMasked: true,
        clearanceNotice: `Requires Clearance Level ${requiredClearance}. Session Clearance: Level ${userClearanceLevel}.`
      },
      isMasked: true
    };
  }
  return entity;
}

/**
 * Express middleware returning 401 for unauthorized requests
 */
async function authenticateMiddleware(req, res, next) {
  const user = await getContextUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid OIDC JWT bearer access token.'
    });
  }
  req.user = user;
  next();
}

module.exports = {
  signJwtToken,
  verifyJwtToken,
  getContextUser,
  authenticateMiddleware,
  getClearanceLevel,
  maskSubjectData,
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE
};
