const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/backend/database');
const seed = require('./src/backend/seed');

// Initialize synthetic dataset
seed();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'src/frontend')));

// API Router mounts
app.use('/api/auth', require('./src/backend/modules/auth'));
app.use('/api/cases', require('./src/backend/modules/cases'));
app.use('/api/import', require('./src/backend/modules/import'));
app.use('/api/resolution', require('./src/backend/modules/resolution'));
app.use('/api/subject360', require('./src/backend/modules/subject360'));
app.use('/api/graph', require('./src/backend/modules/graph'));
app.use('/api/geospatial', require('./src/backend/modules/geospatial'));
app.use('/api/evidence', require('./src/backend/modules/evidence'));
app.use('/api/review', require('./src/backend/modules/review'));
app.use('/api/audit', require('./src/backend/modules/audit'));

// Health & System Info API
app.get('/api/system/status', (req, res) => {
  res.json({
    system: 'AP Spatio-Temporal Subject Intelligence Platform',
    version: '1.0.0-ENTERPRISE-SKELETON',
    status: 'OPERATIONAL',
    classification: 'TOP_SECRET//SI-GAMMA/TK//NOFORN',
    dataset: {
      entities: db.entities.length,
      cases: db.cases.length,
      events: db.events.length,
      evidenceVault: db.evidence.length,
      resolutionCandidates: db.resolutionCandidates.length,
      auditLogs: db.auditLogs.length
    },
    uptimeSeconds: process.uptime()
  });
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/frontend/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(` AP SPATIO-TEMPORAL INTELLIGENCE PLATFORM (Palantir Architecture)`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Classification Level: TOP SECRET // SCI`);
  console.log(` Synthetic Data Engine: ONLINE (${db.entities.length} entities loaded)`);
  console.log(`================================================================`);
});
