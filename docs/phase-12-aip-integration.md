# Phase 12 Architectural Spec — AIP Integration Layer & Governed HITL Function Calling

## 1. Overview
The AIP (Artificial Intelligence Platform) layer integrates LLM intelligence into the platform via strict Anthropic function calling over the Ontology Core. AI agent responses must be grounded in verified Ontology Object Sets, Link traversals, and Monocle lineage with mandatory evidence citations.

## 2. Tool Registry
- `query_objects`: Query Object Sets by type name and property filters (Read-only, executes immediately).
- `traverse_links`: Traverse graph link types between Ontology Objects (Read-only, executes immediately).
- `trace_lineage`: Inspect Monocle data provenance graphs (Read-only, executes immediately).
- `execute_governed_action`: Propose a governed mutation (FLAG_SUBJECT, CREATE_CASE, MERGE_ENTITIES, ADD_OBSERVATION, INGEST_EVIDENCE).

## 3. Human-in-the-Loop (HITL) PENDING_REVIEW Gate
No AI agent can execute governed actions directly. Any prompt requesting a state-changing action triggers `execute_governed_action`, which creates a record in the `PENDING_REVIEW` queue (`ai_runs` table).
- State transition: `PROPOSED -> PENDING_REVIEW -> APPROVED` (action executed) or `REJECTED` (no mutation).
- Human review endpoint: `PUT /api/aip/runs/:id/review` executes the action under human authorization only when approved.

## 4. Mandatory Evidence Citation & Validation
All AIP reasoning outputs produce structured citation tags (`Ontology:Person:SUB-00001`, `MonocleLineage:SUB-00001`, `AuditTrail:FLAG_SUBJECT:SUB-00001`) preventing hallucination and enforcing data provenance. Every citation is validated against actual retrieved entity IDs before saving the proposed record.

## 5. Endpoints
- `GET /api/aip/tools`: Inspect available tool functions.
- `POST /api/aip/query`: Natural language prompt execution (returns proposed action if mutation requested).
- `GET /api/aip/runs`: List pending AIP run queue.
- `PUT /api/aip/runs/:id/review`: Review proposed run (status: `APPROVED` | `REJECTED`).

