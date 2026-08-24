# ANTIGRAVITY MASTER BUILD PROMPT: AP SPATIO-TEMPORAL INTELLIGENCE PLATFORM

## System Overview & Architecture Context
You are constructing the complete, end-to-end connected software skeleton for the **AP Spatio-Temporal Subject Intelligence Platform** — a high-performance, evidence-centric intelligence integration and analysis system modeled after Palantir Gotham, Foundry, and AIP.

The platform bridges real-time multi-source data feeds (CCTV, LPR, Telecom CDR, Financial, Cyber, Geolocation) into an immutable Spatio-Temporal Event Graph, featuring automated Entity Resolution, Subject 360 Profiling, Interactive Knowledge Graph Visualizations, Geospatial Trajectory scrubber, Digital Evidence Locker, Analyst Human-in-the-Loop Review Queue, and Cryptographically Verifiable Audit Logs.

---

## Operational Modules & Connected Skeleton Pipeline
The system enforces a connected operational workflow:
`Login` → `Case Management` → `Data Import` → `Entity Resolution` → `Subject 360` → `Knowledge Graph` → `Map/Timeline Scrubber` → `Evidence Vault` → `Human Review Queue` → `Audit Ledger`

### Module Specifications:
1. **Authentication & Access Control (`Login`)**:
   - Role-Based Access Control (RBAC): Analyst, Case Manager, Auditor, System Admin.
   - Classification level enforcement (Unclassified, Secret, Top Secret / SCI).
   - Mock JWT authentication & session state manager.

2. **Case Management (`Case Workspace`)**:
   - Case creation, classification tagging, threat scoring, target subject association.
   - Access control rules per case.

3. **Multi-Source Data Ingestion (`Data Import`)**:
   - Synthetic & live ingestion pipeline supporting Telecom (CDR), CCTV/Facial, License Plate (LPR), Financial Transactions, Cyber Telemetry, and Travel Logs.
   - Ingestion status dashboard with validation and entity extraction metrics.

4. **Entity Resolution Engine (`Entity Resolution`)**:
   - Multi-attribute deduplication and disambiguation engine.
   - Probabilistic and deterministic matching (Levenshtein distance, Jaro-Winkler, phone/VIN/national ID exact matching, spatial-temporal co-location clustering).
   - Automated creation of high-confidence links and candidate merge proposals.

5. **Subject 360 Operational Profile (`Subject 360`)**:
   - Unified single-view dashboard for target subjects.
   - Aggregated aliases, known identifiers, movement patterns, co-travelers, financial velocity, risk index, and linked evidence items.

6. **Interactive Knowledge Graph (`Graph Analysis`)**:
   - Interactive link-analysis network canvas powered by force-directed graph engine.
   - Filtering by entity type (Person, Phone, Vehicle, Location, Account, Organization), relation type, confidence score, and time window.
   - Dynamic node expansion and pathfinding between targets.

7. **Geospatial Trajectory & Temporal Scrubber (`Map & Timeline`)**:
   - Spatio-temporal map visualization with custom Leaflet markers, trajectory vectors, co-location heatmaps, and geofence alerts.
   - Interactive timeline scrubber with Play/Pause/Speed controls to animate subject historical movements step-by-step.

8. **Digital Evidence Vault & Chain of Custody (`Evidence Locker`)**:
   - Secure evidence repository with automated SHA-256 cryptographic hashing upon ingestion.
   - Immutable chain of custody tracking (who accessed, downloaded, tagged, or transferred evidence).

9. **Human Review & Analyst Feedback Loop (`Human Review Queue`)**:
   - Analyst workbench to review machine-suggested entity merges, split incorrect associations, flag false positives, and adjust resolution parameters.

10. **Immutable Compliance Audit Ledger (`Audit System`)**:
    - Tamper-evident append-only audit logger capturing all user interactions, entity views, queries, merges, and evidence exports.
    - Searchable audit interface with hash chain verification.

---

## Directory Structure Strategy
```
/
├── ANTIGRAVITY_MASTER_BUILD_PROMPT.md
├── AP_Intelligence_Platform_Production_Blueprint.md
├── BUILD_STATUS.md
├── package.json
├── server.js
└── src/
    ├── backend/
    │   ├── database.js
    │   ├── synthetic_data.js
    │   └── modules/
    │       ├── auth.js
    │       ├── cases.js
    │       ├── import.js
    │       ├── resolution.js
    │       ├── subject360.js
    │       ├── graph.js
    │       ├── geospatial.js
    │       ├── evidence.js
    │       ├── review.js
    │       └── audit.js
    └── frontend/
        ├── index.html
        ├── css/
        │   └── style.css
        └── js/
            ├── app.js
            ├── api.js
            └── components/
                ├── login.js
                ├── cases.js
                ├── import.js
                ├── resolution.js
                ├── subject360.js
                ├── graph.js
                ├── map.js
                ├── evidence.js
                ├── review.js
                └── audit.js
```

---

## Synthetic Data Engine Requirements
Initial execution operates entirely on realistic, interconnected synthetic data representing complex criminal networks, co-located suspects, mobile cell tower hops, vehicle sightings, financial wire transfers, and CCTV detections across major global nodes.

---

## Verification & Execution Criteria
1. Backend server starts cleanly with `npm start` or `node server.js`.
2. Frontend renders an immaculate, state-of-the-art dark mode UI.
3. Every single module must be operational and linked through API routes and client UI transitions.
4. `BUILD_STATUS.md` generated with full execution details, endpoint mapping, synthetic data stats, and improvement notes.
