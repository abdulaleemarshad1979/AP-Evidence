const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../database');
const { signJwtToken, authenticateMiddleware } = require('../middleware/auth');

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

// Operational user passwords and profile definitions for system authentication
const OPERATIONAL_USERS = {
  'admin': {
    id: 'USR-ADMIN',
    username: 'Admin',
    name: 'System Administrator',
    role: 'Admin',
    organization: 'ORG-ALPHA',
    jurisdiction: 'JUR-ALL',
    purposeClearance: 'SYSTEM_ADMINISTRATION',
    password: 'admin'
  },
  'user': {
    id: 'USR-USER',
    username: 'user',
    name: 'Standard User',
    role: 'Analyst',
    organization: 'ORG-ALPHA',
    jurisdiction: 'JUR-AP',
    purposeClearance: 'COUNTER_TERRORISM',
    password: 'user'
  },
  'analyst_lead': {
    id: 'USR-101',
    username: 'analyst_lead',
    name: 'Lead Investigator',
    role: 'Lead Investigator',
    organization: 'ORG-ALPHA',
    jurisdiction: 'JUR-UK',
    purposeClearance: 'COUNTER_TERRORISM',
    password: 'pass_lead_101'
  },
  'case_manager': {
    id: 'USR-102',
    username: 'case_manager',
    name: 'Case Manager',
    role: 'Case Manager',
    organization: 'ORG-ALPHA',
    jurisdiction: 'JUR-UK',
    purposeClearance: 'CASE_MANAGEMENT',
    password: 'pass_mgr_102'
  },
  'compliance_auditor': {
    id: 'USR-103',
    username: 'compliance_auditor',
    name: 'Compliance Auditor',
    role: 'Auditor',
    organization: 'ORG-ALPHA',
    jurisdiction: 'JUR-UK',
    purposeClearance: 'AUDIT',
    password: 'pass_audit_103'
  },
  'sys_admin': {
    id: 'USR-104',
    username: 'sys_admin',
    name: 'System Admin',
    role: 'Admin',
    organization: 'ORG-ALPHA',
    jurisdiction: 'JUR-ALL',
    purposeClearance: 'SYSTEM_ADMINISTRATION',
    password: 'pass_admin_104'
  },
  'unassigned_analyst': {
    id: 'USR-105',
    username: 'unassigned_analyst',
    name: 'Unassigned Analyst',
    role: 'Field Analyst',
    organization: 'ORG-BETA',
    jurisdiction: 'JUR-US',
    purposeClearance: 'CYBER_INTEL',
    password: 'pass_foreign_105'
  }
};

const OPERATIONAL_USER_PASSWORDS = {
  'admin': 'admin',
  'user': 'user',
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
  const lowerUsername = username.toLowerCase();

  let user = await db.getUserByUsername(username);

  // Dynamic user seeding fallback for operational accounts if not yet in database
  if (!user && OPERATIONAL_USERS[lowerUsername]) {
    const op = OPERATIONAL_USERS[lowerUsername];
    try {
      await db.execute(
        `INSERT INTO users (id, username, name, role, organization, jurisdiction, purpose_clearance)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [op.id, op.username, op.name, op.role, op.organization, op.jurisdiction, op.purposeClearance]
      );
      user = await db.getUserByUsername(username);
    } catch (e) {
      user = {
        id: op.id,
        username: op.username,
        name: op.name,
        role: op.role,
        organization: op.organization,
        jurisdiction: op.jurisdiction,
        purposeClearance: op.purposeClearance
      };
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid platform credentials' });
  }

  // Password verification
  const expectedPassword = OPERATIONAL_USER_PASSWORDS[lowerUsername];
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
      classification: 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY'
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
      classification: 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY'
    }
  });
});

module.exports = router;
