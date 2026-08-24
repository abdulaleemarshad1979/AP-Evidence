const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/backend/database');
const seed = require('./src/backend/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize PostgreSQL database & seed dataset
(async () => {
  try {
    await db.init();
    await seed();
  } catch (err) {
    console.error('Server DB initialization failed:', err);
  }
})();

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
    version: '1.0.0-FOUNDATION-PASS-1',
    status: 'IMPLEMENTED',
    classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    databaseEngine: 'PostgreSQL (pg-mem with DDL migrations, persistent disk snapshot & outbox)',
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
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` AP SPATIO-TEMPORAL INTELLIGENCE PLATFORM (Foundation Pass 1)`);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(` Classification: SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE`);
    console.log(` Storage Engine: PostgreSQL System of Record (Outbox Enabled)`);
    console.log(`================================================================`);
  });
}

module.exports = app;
