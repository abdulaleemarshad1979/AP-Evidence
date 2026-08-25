# Phase 9 Architectural Spec — The Ontology Core

## 1. Overview
The Ontology Core provides the single unified data model for the entire platform. Every application module reads and writes through Object types, Link types, and Action types defined in the Ontology, rather than querying raw SQL database tables directly.

## 2. Architecture & Data Model
- **Object Types** (`ontology_object_types`): Governed schemas representing entities/events (`Person`, `Vehicle`, `Observation`, `Evidence`, `Case`) backed by underlying PostgreSQL tables (`entities`, `observations`, `evidence_metadata`, `cases`).
- **Properties** (`ontology_properties`): Typed attributes attached to Object types with searchability metadata.
- **Link Types** (`ontology_link_types`): Typed bidirectional relations (`OBSERVED_AT`, `ASSOCIATED_WITH`, `EVIDENCE_OF`, `REGISTERED_TO`).
- **Functions** (`ontology_functions`): Registered server-side logic implementing action side-effects and derived values.
- **Action Types** (`ontology_action_types`): Governed mutation contracts (`MERGE_ENTITIES`, `ADD_OBSERVATION`, `CREATE_CASE`, `FLAG_SUBJECT`, `INGEST_EVIDENCE`) executing validated logic with mandatory audit logging and outbox projection events.

## 3. Ontology Query & Action Engine
Located in `src/backend/ontology/engine.js`:
- `getObjectsByType(apiName, filter, user)`: Dynamic Object Set query builder.
- `getLinkedObjects(sourceType, sourceId, linkTypeApiName, user)`: Graph link traversal across Ontology objects.
- `searchObjects(query, targetTypes, user)`: Attribute-level search over searchable properties.
- `aggregateObjects(apiName, groupByProp, metric, user)`: Aggregations over Object Set properties.
- `executeAction(actionTypeApiName, input, user)`: Atomic execution of governed Action types.

## 4. Generated SDK
`GET /api/ontology/sdk` generates a typed client schema contract allowing frontend components and external services to interact cleanly through a single governed interface.

## 5. Security & Verification
- ABAC default-deny on all route endpoints.
- Hash-chained audit ledger (`audit_events`) created on every Action execution.
