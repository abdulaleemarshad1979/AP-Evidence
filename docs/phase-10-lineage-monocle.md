# Phase 10 Architectural Spec — Monocle Data Lineage & Provenance

## 1. Overview
Monocle provides data lineage and provenance tracking across the platform, answering "Where did this data come from?" for any Object type, observation, or analytical report.

## 2. Architecture & Data Model
- **Lineage Nodes** (`lineage_nodes`): Provenance entities representing raw datasets, pipeline transforms, evidence items, action audits, and ontology objects.
- **Lineage Edges** (`lineage_edges`): Directed edges describing transforms (`INGESTED_FROM`, `DERIVED_BY_ACTION`, `EXTRACTED_FROM`, `MAPPED_TO_OBJECT`) with confidence scores.

## 3. Tracing Engine
Located in `src/backend/ontology/lineage.js`:
- Dynamic backward traversal from any target reference (`SUB-00001`, `EVI-VAULT-001`, `CASE-AP-2026-0001`).
- Connects observation events, evidence metadata, document extractions, and action audit records into a directed acyclic lineage graph.

## 4. API Endpoints
- `GET /api/lineage/:targetRef`: Traces end-to-end data provenance for target entity or dataset.

## 5. Security & Audit
- Protected by `authenticateMiddleware`.
- Maintains cryptographic correlation with `audit_events` and `evidence_custody_ledger`.
