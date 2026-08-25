# Phase 12 Architectural Spec — AIP Integration Layer & Function Calling

## 1. Overview
The AIP (Artificial Intelligence Platform) layer integrates LLM intelligence into the platform via strict function calling over the Ontology Core. AI agent responses must be grounded in verified Ontology Object Sets, Link traversals, and Monocle lineage with mandatory evidence citations.

## 2. Tool Registry
- `query_objects`: Query Object Sets by type name and property filters.
- `traverse_links`: Traverse graph link types between Ontology Objects.
- `trace_lineage`: Inspect Monocle data provenance graphs.
- `execute_governed_action`: Trigger governed mutations with audit trail verification.

## 3. Mandatory Evidence Citation
All AIP reasoning outputs produce structured citation tags (`Ontology:Person:SUB-00001`, `MonocleLineage:SUB-00001`, `AuditTrail:FLAG_SUBJECT:SUB-00001`) preventing hallucination and enforcing data provenance.

## 4. Endpoints
- `GET /api/aip/tools`: Inspect available tool functions.
- `POST /api/aip/query`: Natural language prompt execution.
