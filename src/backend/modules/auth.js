const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../database');
const { signJwtToken, authenticateMiddleware } = require('../middleware/auth');

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

// Synthetic user passwords mapping for dev/test credentials
const SYNTHETIC_USER_PASSWORDS = {
  'analyst_lead': 'pass_lead_101',
  'case_manager': 'pass_mgr_102',
  'compliance_auditor': 'pass_audit_103',
  'sys_admin': 'pass_admin_104',
  'unassigned_analyst': 'pass_foreign_105'
};

// Login route returning signed OIDC JWT access tokens
router.post('/login', async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation Error', details: parseResult.error.errors });
  }

  const { username, password } = parseResult.data;

  const user = await db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid synthetic platform credentials' });
  }

  // Password verification - Never accept missing or universal passwords
  const expectedPassword = SYNTHETIC_USER_PASSWORDS[username.toLowerCase()];
  if (!expectedPassword || password !== expectedPassword) {
    await db.logAudit(user.id, user.username, 'LOGIN_FAILED', 'Auth', `Failed login attempt for user ${username}: invalid password`);
    return res.status(401).json({ error: 'Invalid password credentials' });
  }

  const token = signJwtToken(user);
  await db.logAudit(user.id, user.name, 'USER_LOGIN', 'Auth', `Successful OIDC JWT login for user ${user.username} (${user.role})`);

  // Set secure HttpOnly session cookie
  res.cookie('apis_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 3600 * 1000
  });

  return res.json({
    token,
    tokenType: 'Bearer',
    expiresIn: '8h',
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      organization: user.organization,
      jurisdiction: user.jurisdiction,
      purposeClearance: user.purposeClearance,
      classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE'
    }
  });
});

// Logout route clearing session cookies
router.post('/logout', authenticateMiddleware, async (req, res) => {
  if (req.user) {
    await db.logAudit(req.user.id, req.user.name, 'USER_LOGOUT', 'Auth', `User ${req.user.username} logged out.`);
  }
  res.clearCookie('apis_session');
  res.json({ message: 'Logged out successfully' });
});

// Current user profile route
router.get('/me', authenticateMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      organization: req.user.organization,
      jurisdiction: req.user.jurisdiction,
      purposeClearance: req.user.purposeClearance,
      classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE'
    }
  });
});

module.exports = router;
