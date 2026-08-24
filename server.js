require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./src/backend/database');
const seed = require('./src/backend/seed');
const outboxWorker = require('./src/backend/outbox_worker');
const storage = require('./src/backend/storage');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Security Headers & Helmet Configuration with Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS Origin Restrictions
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Rate limit exceeded. Please try again later.' }
});
app.use('/api/', apiLimiter);

// Correlation ID Middleware & Body Parsers
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `corr-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'src/frontend')));

// Health & Readiness Probes (Unauthenticated)
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/ready', async (req, res) => {
  try {
    const dbTest = await db.queryOne(`SELECT 1 as alive`);
    if (!dbTest) throw new Error('Database ping returned empty');
    res.json({
      status: 'READY',
      database: 'CONNECTED',
      storage: 'READY',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'NOT_READY',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/system/status', async (req, res) => {
  const cases = await db.getCases();
  const entities = await db.getEntities();
  const evidence = await db.getEvidenceList();
  const auditLogs = await db.query(`SELECT COUNT(*) as count FROM audit_events`);
  const candidates = await db.query(`SELECT COUNT(*) as count FROM resolution_candidates`);

  res.json({
    system: 'Andhra Pradesh Intelligence System',
    version: '3.0.0-PHASE-3-INVESTIGATOR-WORKSPACE',
    status: 'PHASE_3_OPERATIONAL',
    classification: 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    databaseEngine: 'PostgreSQL 16 + PostGIS (Row-Level Security & Parameterized Queries)',
    objectStorage: 'MinIO/S3-Compatible Evidence Vault',
    authEngine: 'Keycloak/OIDC JWT Bearer Verification',
    dataset: {
      entities: entities.length,
      cases: cases.length,
      evidenceVault: evidence.length,
      resolutionCandidates: parseInt(candidates[0]?.count || 0, 10),
      auditLogs: parseInt(auditLogs[0]?.count || 0, 10)
    },
    uptimeSeconds: process.uptime()
  });
});

// API Routes Mount
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

// Fallback SPA route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/frontend/index.html'));
});

// Structured Centralized Error Handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] [${req.correlationId || 'NO-ID'}] ${err.stack || err.message}`);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    correlationId: req.correlationId
  });
});

// Server Initialization & Readiness Wait
async function startServer() {
  try {
    console.log('[SYSTEM STARTUP] Connecting to PostgreSQL database & initializing PostGIS schema...');
    await db.init();
    await seed();

    // Start background outbox worker
    outboxWorker.start(5000);

    app.listen(PORT, () => {
      console.log(`================================================================`);
      console.log(` ANDHRA PRADESH INTELLIGENCE SYSTEM (Phase 3 Operational)`);
      console.log(` Running on: http://localhost:${PORT}`);
      console.log(` Database: PostgreSQL 16 + PostGIS`);
      console.log(` Classification: SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE`);
      console.log(`================================================================`);
    });
  } catch (err) {
    console.error('[FATAL SERVER ERROR] Fail Closed: Could not initialize database or server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
