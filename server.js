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

// Prometheus Metrics Counters
let ingestionMetricsCount = 0;
let totalHttpRequestCount = 0;

// Security Headers & Helmet Configuration with Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-case-id']
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Rate limit exceeded. Please try again later.' }
});
app.use('/api/', apiLimiter);

// Request tracking & Correlation ID
app.use((req, res, next) => {
  totalHttpRequestCount++;
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
    if (db.isPgMem && process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        status: 'NOT_READY',
        database: 'FALLBACK_MEMORY_PG_MEM',
        error: 'Real PostgreSQL 16 database unavailable in production mode',
        timestamp: new Date().toISOString()
      });
    }

    const dbTest = await db.queryOne(`SELECT 1 as alive`);
    if (!dbTest) throw new Error('Database ping returned empty');

    res.json({
      status: 'READY',
      database: db.isPgMem ? 'CONNECTED_PG_MEM_TEST' : 'CONNECTED_POSTGRES_16',
      storage: storage.useS3 ? 'CONNECTED_MINIO_S3' : 'LOCAL_DISK_STORE',
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

// Prometheus System Metrics Endpoint
app.get('/metrics', async (req, res) => {
  const cases = await db.getCases();
  const entities = await db.getEntities();
  const pendingOutbox = await db.query(`SELECT COUNT(*) as count FROM outbox_events WHERE status = 'PENDING'`);
  
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP apis_http_requests_total Total number of HTTP requests handled
# TYPE apis_http_requests_total counter
apis_http_requests_total ${totalHttpRequestCount}

# HELP apis_entities_total Total count of active entities
# TYPE apis_entities_total gauge
apis_entities_total ${entities.length}

# HELP apis_cases_total Total count of active cases
# TYPE apis_cases_total gauge
apis_cases_total ${cases.length}

# HELP apis_outbox_lag_pending Number of pending outbox events
# TYPE apis_outbox_lag_pending gauge
apis_outbox_lag_pending ${parseInt(pendingOutbox[0]?.count || 0, 10)}
  `.trim());
});

// Global Categorized Search Endpoint (Defect 1.11 Remediation)
app.get('/api/search', async (req, res) => {
  const queryStr = String(req.query.q || req.query.query || '').trim().toLowerCase();
  const caseId = req.query.caseId || req.headers['x-case-id'] || 'CASE-AP-2026-0001';

  if (!queryStr) {
    return res.json({ subjects: [], cases: [], evidence: [], observations: [] });
  }

  const allEntities = await db.getEntities();
  const matchedEntities = allEntities.filter(e =>
    e.name?.toLowerCase().includes(queryStr) ||
    e.id.toLowerCase().includes(queryStr) ||
    (e.aliases && e.aliases.some(a => a.toLowerCase().includes(queryStr)))
  );

  const allCases = await db.getCases();
  const matchedCases = allCases.filter(c =>
    c.title.toLowerCase().includes(queryStr) ||
    c.id.toLowerCase().includes(queryStr) ||
    c.codeName.toLowerCase().includes(queryStr)
  );

  const evidenceList = await db.getEvidenceList({ caseId });
  const matchedEvidence = evidenceList.filter(ev =>
    ev.title.toLowerCase().includes(queryStr) ||
    ev.id.toLowerCase().includes(queryStr)
  );

  const obs = await db.query(
    `SELECT * FROM observations WHERE case_id = $1 AND (LOWER(location_name) LIKE $2 OR LOWER(observation_type) LIKE $2) LIMIT 10`,
    [caseId, `%${queryStr}%`]
  );

  res.json({
    subjects: matchedEntities,
    cases: matchedCases,
    evidence: matchedEvidence,
    observations: obs
  });
});

app.get('/api/system/status', async (req, res) => {
  const cases = await db.getCases();
  const entities = await db.getEntities();
  const evidence = await db.getEvidenceList();
  const auditLogs = await db.query(`SELECT COUNT(*) as count FROM audit_events`);
  const candidates = await db.query(`SELECT COUNT(*) as count FROM resolution_candidates`);

  res.json({
    system: 'Andhra Pradesh Intelligence System',
    version: '6.0.0-PHASE-10-ONTOLOGY-WORKSHOP',
    status: 'PHASE_10_OPERATIONAL',
    classification: 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY',
    databaseEngine: db.isPgMem ? 'pg-mem (Unit-Test Fallback Engine)' : 'PostgreSQL 16 + PostGIS (Row-Level Security & Parameterized Queries)',
    objectStorage: storage.useS3 ? 'MinIO/S3-Compatible Evidence Vault' : 'Local Disk Fallback Store',
    authEngine: 'Keycloak OIDC Bearer Token Validation',
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
app.use('/api/v1', require('./src/backend/modules/phase4_routes'));
app.use('/api/v1', require('./src/backend/modules/phase5_routes'));
app.use('/api/v1', require('./src/backend/modules/phase6_routes'));
app.use('/api/v1', require('./src/backend/modules/phase7_routes'));
app.use('/api/v1', require('./src/backend/modules/phase8_routes'));
app.use('/api/interop', require('./src/backend/modules/interop'));
app.use('/api/alerts', require('./src/backend/modules/alerts'));

// Phase 10 Foundry Parity Modules Mount
app.use('/api/ontology', require('./src/backend/modules/ontology'));
app.use('/api/lineage', require('./src/backend/modules/lineage'));
app.use('/api/workbook', require('./src/backend/modules/workbook'));
app.use('/api/workshop', require('./src/backend/modules/workshop'));
app.use('/api/aip', require('./src/backend/modules/aip'));
app.use('/api/quiver', require('./src/backend/modules/quiver'));
app.use('/api/dossier', require('./src/backend/modules/dossier'));
app.use('/api/automate', require('./src/backend/modules/automate'));
app.use('/api/apollo', require('./src/backend/modules/apollo'));

// Phase 4 & Phase 9 Ingestion Connectors Mount
app.use('/api/v1/connectors/cctv', require('./src/backend/connectors/cctv_connector'));
app.use('/api/v1/connectors/cdr', require('./src/backend/connectors/cdr_connector'));
app.use('/api/v1/connectors/telemetry', require('./src/backend/connectors/telemetry_connector'));
app.use('/api/v1/connectors/documents', require('./src/backend/connectors/document_connector'));
app.use('/api/ingest/cctv', require('./src/backend/connectors/cctv_connector'));
app.use('/api/ingest/cdr', require('./src/backend/connectors/cdr_connector'));
app.use('/api/ingest/telemetry', require('./src/backend/connectors/telemetry_connector'));

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

    const bindServer = (rawPort, maxAttempts = 10) => {
      const portNum = parseInt(rawPort, 10);
      return new Promise((resolve, reject) => {
        const server = app.listen(portNum, () => {
          console.log(`================================================================`);
          console.log(` PALANTIR ENTERPRISE INTELLIGENCE OS (FOUNDRY, GOTHAM, AIP, APOLLO)`);
          console.log(` Running on: http://localhost:${portNum}`);
          console.log(` Database: ${db.isPgMem ? 'pg-mem Unit Test Fallback' : 'PostgreSQL 16 + PostGIS'}`);
          console.log(` Classification: LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY`);
          console.log(`================================================================`);
          resolve({ server, port: portNum });
        });

        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE' && maxAttempts > 0) {
            const nextPort = portNum + 1;
            console.warn(`[PORT RECOVERY] Port ${portNum} in use, automatically selecting port ${nextPort}...`);
            bindServer(nextPort, maxAttempts - 1).then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
      });
    };

    await bindServer(PORT);
  } catch (err) {
    console.error('[FATAL SERVER ERROR] Fail Closed: Could not initialize database or server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
