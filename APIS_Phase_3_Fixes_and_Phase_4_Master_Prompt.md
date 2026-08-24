# Andhra Pradesh Intelligence System (APIS)
## Phase 3 Fixes & Phase 4 Master Execution Prompt

> **System Designation**: Andhra Pradesh Intelligence System (APIS)  
> **Classification**: SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE  
> **Target Production Architecture**: Palantir Gotham / Foundry Enterprise Pattern  
> **Git Branch Directive**: Must create and operate on `feature/phase-4-secure-ingestion-geotemporal`  
> **Repository**: AP-Evidence  
> **UI Branding & Palette**: AP Police Navy (`#0A2540`), Gold (`#C5A059`), Light Gray (`#F4F6F9`), Pure White (`#FFFFFF`)

---

## Executive Summary & System Roadmap

The **Andhra Pradesh Intelligence System (APIS)** is an enterprise-grade spatio-temporal intelligence platform modeled on Palantir Gotham/Foundry architectures. The system is constructed across **8 Total Production Phases**:

| Phase | Title | Focus & Core Deliverables | Status |
|---|---|---|---|
| **Phase 1** | Foundation Architecture | Core schema DDL, PostGIS extension, Express skeleton, initial synthetic data generator. | **COMPLETED** |
| **Phase 2** | Production Hardening | DB migration layer, MinIO vault, basic ABAC policies, audit hash chain. | **COMPLETED** |
| **Phase 3** | Investigator Workspace | Unified Case/Subject 360, Knowledge Graph, Map & Scrubber, AP Police Palette. | **REMEDIATION REQUIRED** |
| **Phase 4** | Secure Ingestion, Interoperability & Sensor Processing | CCTV/LPR/CDR/Financial connectors, NIEM/STIX/GeoJSON exchange, PostGIS spatio-temporal queries, metrics monitoring, Phase 4 UI. | **ACTIVE TARGET** |
| **Phase 5** | High-Scale Ingestion & MinIO Storage Pipeline | Parallel batch worker pool, quarantine validation, S3 multipart chunk uploads, SHA-256 streaming verification. | Planned |
| **Phase 6** | Deep Knowledge Graph & Resolution Engine | Multi-attribute Jaro-Winkler + Levenshtein fuzzy matching, graph pathfinding, canonical entity redirect graph traversal. | Planned |
| **Phase 7** | Real-Time Telemetry & Outbox Projections | Event-driven outbox projection processing, WebSocket real-time telemetry streaming, live dashboard push notifications. | Planned |
| **Phase 8** | Production Deployment & Air-Gapped Readiness | Docker Compose multi-container orchestration, Nginx reverse proxy SSL/TLS, Prometheus/Grafana metrics, air-gapped build. | Planned |

---

## MANDATORY STEP 0: Git Branch Creation

Before executing any fixes or building Phase 4 features:
```bash
git checkout -b feature/phase-4-secure-ingestion-geotemporal
```
All commits for Phase 3 fixes and Phase 4 enhancements MUST be committed to `feature/phase-4-secure-ingestion-geotemporal`.

---

## SECTION 1: Phase 3 Critical Remediation Specifications

Phase 3 was committed to `main` (commit `21743c9`), but audit testing identified 12 critical defects that MUST be remediated before declaring Phase 3 complete and advancing Phase 4.

### 1.1 Plaintext Credentials & Auto-Login Cleanup
- **Defect**: Frontend code contains plaintext test credentials and automatic login bypass logic.
- **Fix**: Remove all plaintext credentials and automatic login bypass from `src/frontend/js/app.js` and component files. Force genuine user interaction through the authentication screen.

### 1.2 Genuine Keycloak OIDC Authentication Integration
- **Defect**: Authentication uses locally signed fallback HS256 JWT tokens rather than genuine Keycloak OIDC tokens.
- **Fix**: Refactor `src/backend/middleware/auth.js` and `src/backend/modules/auth.js` to validate Keycloak OIDC Bearer tokens using Keycloak's JWKS public keys. Extract user identity, clearance level, role attributes, and assigned cases directly from OIDC token claims.

### 1.3 Secret & Credential Hardening
- **Defect**: Committed default passwords exist for PostgreSQL, MinIO, Keycloak, and JWT secrets across code and compose files.
- **Fix**: Audit `.env.example`, `docker-compose.yml`, `server.js`, `src/backend/database.js`, and `src/backend/storage.js`. Enforce runtime environment variable loading (`process.env.*`) and throw an explicit startup error in production mode if default credentials are detected.

### 1.4 PostgreSQL Fail-Closed Row-Level Security (RLS)
- **Defect**: PostgreSQL RLS policies fail open when session context variables (`app.current_user_id`, `app.current_case_id`) are missing or null.
- **Fix**: Update DDL in `src/backend/migrations/001_initial_schema.sql` so that all RLS policies strictly require active session variables:
  ```sql
  CREATE POLICY case_isolation_policy ON entities
    USING (
      current_setting('app.current_case_id', true) IS NOT NULL 
      AND case_id = current_setting('app.current_case_id', true)::uuid
    );
  ```

### 1.5 Non-Superuser Database Application Role
- **Defect**: Application connects to PostgreSQL using the `postgres` superuser role, which bypasses RLS policies entirely.
- **Fix**: Create a dedicated application database user `apis_app_user` with restricted privileges. Update `src/backend/database.js` connection pool configuration to connect as `apis_app_user`, ensuring RLS policies are strictly enforced by the PostgreSQL engine.

### 1.6 Strict Case-Scoped API Query Filtering
- **Defect**: Backend modules (`graph.js`, `subject360.js`, `resolution.js`, `evidence.js`, `import.js`, `review.js`, `geospatial.js`) execute unscoped SQL queries that leak cross-case data.
- **Fix**: Modify every SQL query across all backend modules to include explicit `WHERE case_id = $1` filters and pass `req.user.clearance` to `abacMiddleware`. Block any cross-case query attempts with `403 Forbidden`.

### 1.7 Accurate Service Health Verification (`/api/ready`)
- **Defect**: `/api/ready` reports PostgreSQL and MinIO as "healthy" even when relying on in-memory `pg-mem` or local disk fallbacks.
- **Fix**: Refactor `/api/ready` probe in `server.js` to execute live database queries (`SELECT 1`) and live MinIO bucket head calls. Return `HTTP 503 Service Unavailable` with detailed error status if live PostgreSQL or MinIO services are unreachable.

### 1.8 Cryptographic Evidence Storage Integrity Verification
- **Defect**: `/api/evidence/:id/verify` and export endpoints report `integrityVerified: true` even when MinIO storage verification fails.
- **Fix**: Refactor `src/backend/modules/evidence.js` and `storage.js` to compute the live SHA-256 hash of the object stored in MinIO and compare it against the immutable audit ledger entry. Set `integrityVerified: true` ONLY if both storage hash and audit chain verify successfully. Return `integrityVerified: false` with audit alerts if hash mismatch occurs.

### 1.9 Dynamic Explainable Entity Resolution Engine
- **Defect**: Background outbox worker creates hardcoded `0.85` similarity matches between the first two entities.
- **Fix**: Refactor `src/backend/outbox_worker.js` and `src/backend/modules/resolution.js` to compute dynamic similarity vectors using Jaro-Winkler for names/aliases, exact string matching for Aadhaar/PAN/phone, and PostGIS distance for spatial observations. Generate human-readable match rationale explaining score components.

### 1.10 Reactive Active-Case Context Propagation
- **Defect**: Selecting an active case in the frontend header only updates the top header text without propagating `X-Case-ID` to subsequent API calls.
- **Fix**: Update `src/frontend/js/app.js` and `src/frontend/js/api.js` so case selection updates global state, attaches `X-Case-ID` header to all fetch requests, and triggers reactive refresh across all active components (`graph.js`, `subject360.js`, `map.js`, `evidence.js`, `review.js`).

### 1.11 Multi-Category Global Search
- **Defect**: Top navigation global search is a simple redirect to Subject 360 rather than a true categorized search engine.
- **Fix**: Refactor `/api/search` endpoint in `server.js` and frontend search bar component to return structured, categorized search results (Subjects, Cases, Evidence Vault, Observations, Sensors) with interactive dropdown navigation.

### 1.12 Stored-XSS Prevention via DOM Sanitization
- **Defect**: Frontend components (`subject360.js`, `review.js`, `evidence.js`, `graph.js`, `cases.js`, `map.js`) render untrusted entity data via `innerHTML`.
- **Fix**: Audit all frontend component render methods. Replace direct `innerHTML` string interpolation of untrusted data with safe DOM construction (`document.createElement`, `element.textContent`) or sanitize via `DOMPurify.sanitize()`.

---

## SECTION 2: Phase 4 Implementation Specifications

Phase 4 introduces secure data ingestion connectors, standardized intelligence exchange formats, PostGIS spatio-temporal queries, sensor telemetry processing, monitoring metrics, and UI enhancements.

```
+-----------------------------------------------------------------------------------+
|                            APIS PHASE 4 ARCHITECTURE                              |
+-----------------------------------------------------------------------------------+
|  [Ingestion Connectors]    [Interoperability]      [PostGIS Geo-Temporal Engine]  |
|  - CCTV / LPR Stream       - NIEM JSON / XML       - Spatial GIST Index           |
|  - CDR Telemetry Feeds     - STIX 2.1 Objects      - ST_MakeEnvelope Bounding Box |
|  - Financial Transactions  - GeoJSON Trajectories  - ST_DWithin Co-Location       |
|  - Quarantine Schema       - Standard Importers    - Temporal Scrubber Slider     |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  [Real-Time Sensor Processing]                     [Metrics & System Health]      |
|  - LPR Watchlist Plate Hit Alerts                  - Prometheus /metrics Endpoint |
|  - CDR Triangulation Engine                        - Outbox & DB Connection Pool  |
|  - Financial Rapid Transfer Anomaly Triggers       - System Health UI Dashboard   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  [Phase 4 AP Police UI]                                                           |
|  - AP Navy (#0A2540), Gold (#C5A059), Light Gray (#F4F6F9) Theme Preserved        |
|  - Integrated Geotemporal Scrubber & Map View                                     |
|  - Real-time Sensor Alert Ticker                                                  |
|  - NIEM / STIX / GeoJSON Export Modal                                             |
+-----------------------------------------------------------------------------------+
```

### 2.1 Secure Ingestion Connectors Architecture
1. **Connector Modules** (`src/backend/connectors/`):
   - `cctv_connector.js`: Ingests camera telemetry & LPR metadata payloads.
   - `cdr_connector.js`: Ingests Call Detail Records (caller, receiver, duration, tower lat/lon, timestamp).
   - `financial_connector.js`: Ingests bank transactions (sender, recipient, amount, currency, timestamp, location).
   - `telemetry_connector.js`: Ingests continuous GPS device streams.
2. **Quarantine & Validation Engine**:
   - Save unverified or malformed payloads into `quarantine_records` table with validation failure reasons.
   - Enforce HMAC signature verification on incoming webhook payloads using configurable secrets (`INGESTION_HMAC_SECRET`).
   - Implement SHA-256 payload deduplication to enforce idempotency.

### 2.2 Data Interoperability & Exchange Formats
1. **Export & Import Services** (`src/backend/modules/interop.js`):
   - **NIEM (National Information Exchange Model)**: Export and import case summaries and entity profiles formatted as NIEM JSON/XML.
   - **STIX 2.1 (Structured Threat Information eXpression)**: Export and import intelligence threat graphs as STIX 2.1 Cyber Observable and Identity JSON objects.
   - **GeoJSON**: Export and import spatio-temporal trajectories as GeoJSON `FeatureCollection` objects containing Point and LineString geometries with time properties.
2. **API Routes**:
   - `GET /api/interop/export/niem?case_id=:id`
   - `GET /api/interop/export/stix?case_id=:id`
   - `GET /api/interop/export/geojson?case_id=:id`
   - `POST /api/interop/import/niem`
   - `POST /api/interop/import/stix`
   - `POST /api/interop/import/geojson`

### 2.3 Advanced PostGIS Geo-Temporal Spatial Query Engine
1. **Database Spatial Indexing**:
   - Ensure `GIST` spatial index exists on `observations.location` (geometry Point, 4326).
2. **Spatial Queries** (`src/backend/modules/geospatial.js`):
   - Bounding Box Query: Filter observations inside `ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)`.
   - Proximity Buffer Query: `ST_DWithin(location, ST_SetSRID(ST_MakePoint(lon, lat), 4326), distance_meters)`.
   - Co-Location Engine: Identify distinct entities present within `N` meters and `T` minutes of each other.
3. **API Routes**:
   - `GET /api/geospatial/bbox?minLon=&minLat=&maxLon=&maxLat=&case_id=`
   - `GET /api/geospatial/colocation?target_id=&radius_meters=&time_window_mins=&case_id=`
   - `GET /api/geospatial/trajectory?entity_id=&start_time=&end_time=&case_id=`

### 2.4 Real-Time Sensor Processing & Alert Engine
1. **LPR Watchlist Engine**: Match incoming license plates against high-value targets in `entities` table. Trigger `CRITICAL` alert on match.
2. **CDR Triangulation Engine**: Correlate cell tower hits across multiple CDR feeds to estimate target movement corridors.
3. **Financial Anomaly Detector**: Detect rapid sequence transfers (> ₹5,00,000 within 15 minutes) and trigger suspicious financial activity alerts.
4. **Alerts API**: `GET /api/alerts?case_id=` & `POST /api/alerts/acknowledge`

### 2.5 System Metrics & Prometheus Monitoring
1. **Prometheus Metrics Endpoint** (`GET /metrics`):
   - Expose operational metrics: `apis_ingestion_total`, `apis_http_requests_total`, `apis_outbox_lag_seconds`, `apis_db_pool_active`, `apis_active_users`.
2. **Operational Health Service**:
   - Detailed component status reporting PostgreSQL connectivity, MinIO bucket health, PostGIS extension status, and outbox worker queue size.

### 2.6 Phase 4 UI Upgrades & AP Police Branding
1. **Theme & Palette**: Preserve deep AP Police Navy (`#0A2540`), Gold (`#C5A059`), and Light Gray (`#F4F6F9`).
2. **UI Enhancements**:
   - **Geo-Temporal Map & Scrubber Tab**: Interactive Leaflet map with time slider, heatmaps, and spatial bounding box selector.
   - **Sensor Feeds & Alerts Ticker Bar**: Real-time ticker showing incoming CCTV/LPR hits, CDR correlations, and financial alerts.
   - **Interoperability Import/Export Modal**: One-click modal to export or import NIEM, STIX 2.1, or GeoJSON datasets.
   - **System Health & Monitoring View**: Visual dashboard displaying system metrics, database pool health, and ingestion processing queues.

---

## SECTION 3: Verification & Exit Criteria

To declare Phase 3 fixed and Phase 4 complete, all of the following requirements MUST be met and verified:

1. **Git Branch & Push**:
   - Branch `feature/phase-4-secure-ingestion-geotemporal` created and pushed to origin.
   - Pull Request created targeting `main`.
2. **Test Suite Execution**:
   - Execute `npm test` and verify 100% pass rate.
   - All Phase 3 defect tests (Keycloak OIDC, RLS fail-closed, DB user non-superuser, case isolation, storage hash verification, XSS sanitization) MUST pass.
   - All Phase 4 feature tests (Connectors, Interoperability NIEM/STIX/GeoJSON, PostGIS BBox/Co-location, Sensor Alerts, Prometheus `/metrics`) MUST pass.
3. **Services Integration**:
   - Full validation using live PostgreSQL 16 + PostGIS, MinIO object storage, and Keycloak OIDC container services.
4. **UI Validation**:
   - AP Police color palette intact and verified across all views.
   - Zero untrusted `innerHTML` assignments.

---

## SECTION 4: Execution Output Protocol

Upon completing execution of this prompt, Antigravity MUST provide:
1. Full git commit log on `feature/phase-4-secure-ingestion-geotemporal`.
2. Summary table of all 12 Phase 3 remediations.
3. Summary table of all Phase 4 features implemented.
4. Test execution results (`npm test` log summary).
5. The Pull Request URL for merging `feature/phase-4-secure-ingestion-geotemporal` into `main`.
