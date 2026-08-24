# Andhra Pradesh Intelligence System (APIS)
## Phase 3 Master Prompt & Antigravity Production Blueprint

> **System Designation**: Andhra Pradesh Intelligence System (APIS)  
> **Classification**: SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE  
> **Target Production Architecture**: Palantir Gotham / Foundry Enterprise Pattern  
> **Master Execution Prompt**: Phase 2 Hardening Exit & Phase 3 Investigator Workspace Implementation

---

## Executive Summary & Production Roadmap

The **Andhra Pradesh Intelligence System (APIS)** is built across **8 Total Production Phases** to achieve full operational readiness:

| Phase | Title | Focus & Core Deliverables | Status |
|---|---|---|---|
| **Phase 1** | Foundation Architecture | Core schema DDL, PostGIS extension, Keycloak OIDC, Express skeleton, initial synthetic data generator. | **COMPLETED** |
| **Phase 2** | Production Hardening & Core Pipeline | Fix syntax errors, ABAC enforcement across all routes, real Postgres/MinIO production safeguards, genuine explainable entity resolution matching, outbox projection worker, append-only audit hash chain. | **COMPLETED / VERIFIED** |
| **Phase 3** | Investigator Workspace & Intelligence Analysis | Unified Investigator Workspace, Global Multi-Entity Search, Case 360, Subject 360, Interactive Knowledge Graph, Provenance Tracker, Synchronized Map & Timeline Scrubber, AP Police Light UI Theme. | **ACTIVE / IMPLEMENTED** |
| **Phase 4** | Geo-Temporal & Surveillance Sensor Processing | Live continuous sensor telemetry streams (CCTV, LPR, CDR, Financial), spatial buffer indexing, PostGIS bounding box queries. | Planned |
| **Phase 5** | High-Scale Ingestion & MinIO Storage Pipeline | Parallel batch ingestion worker pool, quarantine schema validation, S3 multipart chunk uploads, SHA-256 streaming verification. | Planned |
| **Phase 6** | Deep Knowledge Graph & Explainable Entity Resolution Engine | Multi-attribute Jaro-Winkler + Levenshtein fuzzy matching, graph pathfinding algorithms, canonical entity redirect graph traversal. | Planned |
| **Phase 7** | Real-Time Telemetry & Outbox Projections | Event-driven outbox projection processing, WebSocket/Socket.IO real-time telemetry streaming, live dashboard push notifications. | Planned |
| **Phase 8** | Production Deployment, Monitoring & Air-Gapped Readiness | Docker Compose multi-container orchestration, Nginx reverse proxy SSL/TLS termination, Prometheus/Grafana metrics, air-gapped offline package build. | Planned |

---

## Phase 2 Mandatory Exit Gates & Fixes (Verified)

Before proceeding to Phase 3 features, all Phase 2 exit criteria must be strictly validated:

1. **Backend Syntax Integrity**: Eliminate all syntax errors (including `src/backend/modules/import.js` bracket mismatches) blocking server execution.
2. **Authentication & Session Repair**: Remove obsolete `API.setUserId` methods. Enforce valid Bearer tokens signed with OIDC JWT standards.
3. **API Contract Reconciliation**: Reconcile all route mismatches across graph, map, audit, subject360, resolution, and evidence backend modules and frontend component consumers.
4. **Comprehensive ABAC & Case Isolation**: Apply ABAC authorization (`abacMiddleware`) and strict case-scoped filtering to every API route (`/api/evidence`, `/api/import`, `/api/resolution`, `/api/review`, `/api/graph`, `/api/subject360`, `/api/geospatial`).
5. **Real Database Row-Level Security (RLS)**: Replace placeholder `USING (true)` policies with real PostgreSQL RLS policies governed by session context.
6. **Explainable Entity Resolution Engine**: Replace hardcoded `0.91` match scores with dynamic, explainable multi-attribute candidate matching comparing names, phone numbers, aliases, and identifiers.
7. **Production Environment Hardening**: Prevent silent fallback to in-memory `pg-mem` or local disk storage when `NODE_ENV === 'production'`. Force fail-closed behavior.
8. **Security Hardening**: Replace default passwords, enable strict CORS origin restrictions, configure Content Security Policy (CSP), and sanitize all DOM rendering to block Stored-XSS.
9. **Outbox Projection Worker**: Ensure the background outbox worker processes projections (updating search indexes, candidate pairs, audit counters, and graph edges) rather than silently discarding events.
10. **Full-Spectrum Test Suite**: Validate system boot, API contracts, PostgreSQL connectivity, MinIO storage, ABAC enforcement, security headers, and browser integration.

---

## Phase 3 Specifications: Investigator Workspace & Intelligence Analysis

Phase 3 introduces the full **Investigator Workspace** tailored for intelligence analysts:

### 1. Light AP Police Design System & Branding
- **Branding**: System renamed everywhere to **Andhra Pradesh Intelligence System (APIS)**.
- **Palette**:
  - **Header & Primary Accents**: Deep AP Police Navy (`#0A2540` / `#1B365D`)
  - **Secondary & Badges**: AP Police Gold / Brass (`#C5A059` / `#D4AF37`)
  - **Background**: Clean Light Gray (`#F4F6F9`)
  - **Cards & Panels**: Pure White (`#FFFFFF`) with subtle shadow (`0 2px 8px rgba(0,0,0,0.06)`)
  - **Typography**: Inter for crisp interface text, JetBrains Mono for identifiers, hashes, and coordinates.

### 2. Global Multi-Entity Search
- Integrated search bar in the top navigation header.
- Searches across entities, synthetic cases, evidence items, observations, and assertions in real time.
- Categorized result dropdown with instant jump to Subject 360, Case Workspace, or Evidence Vault.

### 3. Unified Investigator Workspace (Case 360 & Subject 360)
- **Active Case Context Switcher**: Seamless switching between assigned cases with instant ABAC re-evaluation.
- **Subject 360 Dossier**: Comprehensive target overview detailing profile attributes, aliases, spatio-temporal observation timeline, linked network assertions, evidence vault attachments, and canonical merge state.
- **Case 360 View**: Full breakdown of case metadata, assigned targets, observation feed, and investigation timeline.

### 4. Interactive Knowledge Graph & Provenance Tracker
- 2D Canvas graph layout powered by force-directed physics.
- Color-coded node classifications (Person, Vehicle, Telecom, Financial Account, Location).
- Drag-and-drop node positioning, node label display, relationship edge labels, and click-to-open Subject 360 details.
- Provenance tracking rendering data lineage, custodian history, and SHA-256 integrity verification.

### 5. Synchronized Geospatial Map & Timeline Scrubber
- Leaflet map rendering PostGIS spatial coordinates and trajectory lines.
- Time-slider scrubber synchronized with map trajectory visualization.
- Playback controls (Play, Pause, Speed 1x/2x/5x, Time readout).

---

## Verification & Test Standard

All implementations must pass the automated test runner `npm test` verifying 100% pass rates across all test groups.
