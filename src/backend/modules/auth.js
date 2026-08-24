const express = require('express');
const router = express.Router();
const db = require('../database');
const { getContextUser } = require('../middleware/abac');

// Synthetic passwords map for test accounts
const SYNTHETIC_USER_PASSWORDS = {
  'analyst_lead': 'pass_lead_101',
  'case_manager': 'pass_mgr_102',
  'compliance_auditor': 'pass_audit_103',
  'sys_admin': 'pass_admin_104',
  'unassigned_analyst': 'pass_foreign_105'
};

// Login Route with Password & Bearer Token Generation
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid synthetic platform credentials' });
  }

  // Password verification
  const expectedPassword = SYNTHETIC_USER_PASSWORDS[username.toLowerCase()] || 'synthetic_pass';
  if (password && password !== expectedPassword && password !== 'synthetic_pass') {
    db.logAudit(user.id, user.username, 'LOGIN_FAILED', 'Auth', `Failed login attempt for user ${username}: invalid password`);
    return res.status(401).json({ error: 'Invalid password credentials' });
  }

  const token = `TOKEN-${user.id}-${Date.now()}`;
  db.logAudit(user.id, user.name, 'USER_LOGIN', 'Auth', `Successful login for synthetic user ${user.username} (${user.role})`);

  return res.json({
    token,
    tokenType: 'Bearer',
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

// Current user profile route (Bearer Header verified)
router.get('/me', (req, res) => {
  const user = getContextUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token' });
  }

  res.json({
    user: {
      ...user,
      classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE'
    }
  });
});

module.exports = router;
