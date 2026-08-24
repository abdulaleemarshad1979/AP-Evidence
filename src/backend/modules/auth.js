const express = require('express');
const router = express.Router();
const db = require('../database');

// Login Route
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const user = db.getUserByUsername(username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid intelligence platform credentials' });
  }

  // Create mock token
  const token = `JWT-MOCK-CLEARANCE-${user.clearance}-${user.id}-${Date.now()}`;

  db.logAudit(user.id, user.name, 'USER_LOGIN', 'Auth', `Successful login for user ${user.username} with clearance ${user.clearance}`);

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      clearance: user.clearance,
      department: user.department
    }
  });
});

// Current user profile route
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: missing authorization header' });
  }
  // Default to lead analyst for mock session
  const defaultUser = db.users[0];
  res.json({ user: defaultUser });
});

module.exports = router;
