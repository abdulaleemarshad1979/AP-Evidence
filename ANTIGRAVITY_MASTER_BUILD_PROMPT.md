# MISSION SPECIFICATION: AP-EVIDENCE PROTOTYPE HARDENING & ENTERPRISE ARCHITECTURE PROMPT

## OBJECTIVE
Transform and elevate the `AP-Evidence` repository into a pilot-grade, defense-architected intelligence platform tailored for the Andhra Pradesh (AP) Police Department. 

The system architecture mirrors Palantir's core ecosystem:
1. **Foundry** (Dynamic Ontology Engine, Data Fusion, Pluggable Ingestion Adapters)
2. **Gotham** (Multi-Hop Graph Explorer, HD GIS Geospatial Fusion, Video/FRS/ANPR Workflows)
3. **AIP** (Ontology-Grounded LLM Copilot, Human-in-the-Loop Verification, Case Dossier RAG)
4. **Apollo** (Multi-Node On-Prem Edge Clustering for 6TB–7TB Server Hardware, Staging Gating, RBAC Middleware)

---

## 1. CI/CD PIPELINE HOTFIX & SERVICE VERIFICATION
- **Root Cause**: The docker image tag `minio/minio:RELEASE.2024-01-31T02-03-41Z` was removed/pruned from Docker Hub, and `options: server /data` in GitHub Actions service container definition is invalid syntax.
- **Applied Fix**:
  In `.github/workflows/ci.yml`, update the `minio` service block to use a verified image tag and valid healthcheck parameters:
  ```yaml
      minio:
        image: minio/minio:RELEASE.2024-01-29T20-56-42Z
        env:
          MINIO_ROOT_USER: minioadmin
          MINIO_ROOT_PASSWORD: minioadmin
        ports:
          - 9000:9000
        options: >-
          --health-cmd "curl -f http://localhost:9000/minio/health/live || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
  ```

---

## 2. HARD DATA & INTEGRATION BOUNDARIES (SAFE PROTO PROTOCOL)
- **No Real PII**: Do not ingest or embed real citizen names, Aadhaar numbers, real FIR numbers, or live vehicle registrations in code, fixtures, seeds, or documentation.
- **Simulated Camera & FRS Feeds**: Video analytics, FRS, and ANPR modules must operate on simulated video feeds/synthetic embeddings behind feature flags (`FRS_DEMO_MODE=true`). All FRS outputs must be visually flagged: `"Assistive match — human verification required"`.
- **Pluggable Adapter Interfaces**: Build modular source adapters for CCTNS, ICJS, NCRB, and e-Challan pointing to synthetic data endpoints so real database wiring is a single configuration swap later.
- **Mandatory Synthetic Banner**: Maintain an unmissable `"SYNTHETIC / TRAINING DATA"` banner across all UI data views in this phase.

---

## 3. CORE ARCHITECTURE IMPLEMENTATION SPECS

### 3.1 Foundry Tier (Dynamic Ontology & Compliance Engine)
- **Ontology Schemas**: Define typed domain objects (`Person`, `Vehicle`, `Case`, `FIR`, `Location`, `CommunicationEvent`, `Organization`, `Evidence`, `Officer`) and their relationships (`ASSOCIATED_WITH`, `OWNER_OF`, `PRESENT_AT`, `COMMITTED_IN`).
- **Data Lineage**: Tag every record with source adapter metadata, ingestion timestamp, and batch ID.
- **BSA (Bharatiya Sakshya Adhiniyam) Evidence Vault**: Compute cryptographic SHA-256 hashes on evidence stream ingestion and maintain an append-only audit trail.

### 3.2 Gotham Tier (Graph Analysis, HD GIS & Sensor Analytics)
- **Multi-Hop Graph Explorer**: Interactive node-link graph (using Cytoscape.js / React Flow / D3) supporting node expansion, path finding, and syndicate sub-graph filtering.
- **HD Geospatial Hub**: MapLibre GL / Leaflet map rendering using real cartographic tiles (OSM / Bhuvan ISRO basemaps) with AP district overlays (Visakhapatnam, Vijayawada, Guntur, Tirupati, Kurnool), hotspot heatmaps, and cell tower triangulation.
- **Timeline & Watchlists**: Chronological event scrubber and automated rule-matching alerts.

### 3.3 AIP Tier (Governed AI Copilot)
- **Ontology-Bound Query Translator**: Translate natural language analyst queries to structured ontology filters with explicit query display.
- **Human-in-the-Loop Entity Resolution**: Suggest duplicate entity merges with confidence scores; strictly enforce manual analyst confirmation prior to executing record merges.
- **Case File RAG**: Case-dossier summarization restricted strictly by officer access scope.

### 3.4 Apollo Tier (Platform Ops, Scale Architecture & AP Police RBAC)
- **Scale Plan (6TB-7TB Nodes)**: PostgreSQL + PostGIS spatial indexing, cursor-based pagination, Redis caching for hot profiles, background worker queues (BullMQ/Celery), and document storage strategy in `/docs/architecture/scale-plan.md`.
- **AP Police Hierarchical RBAC**:
  - `Constable / Head Constable`: Station-level read-only access.
  - `Sub-Inspector / Circle Inspector`: Station-level full investigation read/write.
  - `DSP / SP`: District-level oversight and analytical reporting.
  - `DGP / Nodal Officer / Admin`: State-wide governance, system configuration, audit review.
- **Mandatory Access Audit Reason**: Require officers to enter a short "Reason for Access" prompt before accessing Person 360 or executing sensitive exports, logged into the cryptographic audit trail.

---

## 4. ACCEPTANCE CHECKLIST
- [x] CI pipeline is green (MinIO + PostgreSQL healthchecks pass, 27/27 automated tests pass)
- [ ] Hardcoded secrets audited and isolated into environment variable configurations
- [ ] Persistent "SYNTHETIC / TRAINING DATA" banner rendered on all data screens
- [ ] Server-side RBAC enforced for all AP Police rank tiers
- [ ] Human-in-the-loop approval required for all AI resolution/merge operations
- [ ] Mandatory audit logging with "Reason for Access" on sensitive views
- [ ] MapLibre/Leaflet rendering active with real tile basemaps (OSM / Bhuvan)
- [ ] Scale-shaped architecture documented in `/docs/architecture/scale-plan.md`
