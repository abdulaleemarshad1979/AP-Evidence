# Phase 4 — Secure Multi-Source Ingestion, Interoperability & Geo-Temporal Processing
**System:** Andhra Pradesh Intelligence System (APIS)  
**Classification:** SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE  
**Date:** August 24, 2026  
**Status:** IMPLEMENTED & TESTED  

---

## 1. Executive Summary

Phase 4 establishes an immutable, multi-source, geo-temporal data ingestion engine for synthetic intelligence inputs. The system separates raw evidence from derived content, enforces data quality evaluations across 6 dimensions, normalizes spatial coordinates into PostGIS geometries, and manages job state with retry and quarantine capabilities.

---

## 2. Ingestion Architecture & Pipeline

```text
Source
 → Authentication / Authorization Check
 → Synthetic Upload or Stream Payload
 → Schema Validation & Malicious Scan Hook
 → SHA-256 Hashing
 → Immutable Raw Storage (MinIO Evidence Vault)
 → Metadata Extraction & Schema Normalization
 → Geo-Temporal UTC & PostGIS Normalization (ST_SetSRID Point)
 → Data Quality Evaluation (6 Dimensions)
 → Idempotent Duplicate Detection (Payload Hash Matching)
 → Provenance Lineage Recording
 → Database Persistence & Transactional Outbox
 → Review Queue or Dead-Letter Quarantine
```

---

## 3. Supported Ingestion Types & Adapters

* **CSV / JSON / NDJSON / GeoJSON:** Structured tabular or spatial synthetic records.
* **Uploaded Media (Images, Audio, Video, PDF):** Binary uploaded test objects with SHA-256 hash preservation.
* **Synthetic Event Streams:** Real-time simulated telemetry feeds.
* **Mock Metadata (CCTV, Drone, GPS):** Synthetic LPR and triangulation observations.

---

## 4. Explainable Data Quality Engine

Every ingested record is evaluated across 6 explainable dimensions:
1. **Completeness:** Percentage of required attributes present.
2. **Validity:** Coordinate boundary compliance (-90 to 90 lat, -180 to 180 lng) and valid ISO-8601 timestamps.
3. **Consistency:** Schema field type alignment.
4. **Timeliness:** Latency check between event timestamp and ingestion time.
5. **Uniqueness:** Idempotent duplicate check via SHA-256 hash matching.
6. **Source Reliability:** Source registry trust score weighting.

---

## 5. Versioned API Endpoints (`/api/v1/`)

* `GET /api/v1/sources` — List registered data sources.
* `POST /api/v1/sources` — Register new synthetic data source.
* `GET /api/v1/ingestion/jobs` — Track ingestion job state.
* `POST /api/v1/ingestion/uploads` — Upload synthetic file object with SHA-256 preservation.
* `POST /api/v1/ingestion/synthetic-stream` — Post synthetic event stream observations.
* `GET /api/v1/evidence` — Retrieve evidence vault items.
* `GET /api/v1/evidence/:id/lineage` — Retrieve complete provenance graph & custody ledger.
* `GET /api/v1/data-quality` — Retrieve dimension-level data quality reports.
* `GET /api/v1/quarantine` — View quarantined records with failure reasons.
* `GET /api/v1/reconciliation/candidates` — View candidate disambiguation pairs.
* `POST /api/v1/reconciliation/:id/decision` — Submit human approval/rejection decision.
* `GET /api/v1/geotemporal/search` — PostGIS spatial proximity and temporal scrubber search.

---

## 6. Security & Safety Verification

* Raw evidence objects are stored immutably and never overwritten by analytical operations.
* All coordinates are validated to prevent out-of-bounds geographic errors.
* No connection is established to live police or surveillance infrastructure.
* RLS policies and audit ledger logging are active across all Phase 4 routes.
