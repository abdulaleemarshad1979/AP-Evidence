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
 * Sign a JWT token with full claim set
 */
function signJwtToken(user) {
  const payload = {
    sub: user.id,
    preferred_username: user.username,
    name: user.name,
    role: user.role,
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

  return {
    ...user,
    jwtClaims: decoded
  };
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
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE
};
