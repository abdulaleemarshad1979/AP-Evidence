# Phase 9 Architectural Spec — The Load-Bearing Ontology Core

## 1. Overview
The Ontology Core provides the single unified load-bearing data access layer for the entire platform. All core system modules (`graph.js`, `subject360.js`, `geospatial.js`) read and traverse data exclusively through Object types, Link types, and Action types defined in the Ontology Engine (`src/backend/ontology/engine.js`), rather than querying raw SQL database tables directly.

## 2. Architecture & Data Model
- **Object Types** (`ontology_object_types`): Governed schemas representing entities/events (`Person`, `Vehicle`, `Observation`, `Evidence`, `Case`, `NetworkIndicator`, `PCAPDump`, plus dynamic user-defined types) backed by underlying storage tables (`entities`, `observations`, `evidence_metadata`, `cases`).
- **Properties** (`ontology_properties`): Typed attributes attached to Object types with searchability metadata.
- **Link Types** (`ontology_link_types`): Typed bidirectional relations (`OBSERVED_AT`, `ASSOCIATED_WITH`, `EVIDENCE_OF`, `REGISTERED_TO`).
- **Functions** (`ontology_functions`): Registered server-side logic implementing action side-effects and derived values.
- **Action Types** (`ontology_action_types`): Governed mutation contracts (`MERGE_ENTITIES`, `ADD_OBSERVATION`, `CREATE_CASE`, `FLAG_SUBJECT`, `INGEST_EVIDENCE`) executing validated logic with mandatory audit logging and outbox projection events.

## 3. Load-Bearing Ontology Query & Action Engine
Located in `src/backend/ontology/engine.js`:
- `getAllObjects(filter, user)`: Aggregates active objects across ALL registered object types (supports dynamic object creation like `TestWidget` with zero module code changes).
- `getObjectById(id, user)`: Retrieves primary key matched object across registered ontology object sets.
- `getObjectsByType(apiName, filter, user)`: Dynamic Object Set query builder.
- `getLinkedObjects(sourceType, sourceId, linkTypeApiName, user)`: Graph link traversal across Ontology objects.
- `getAssertions(caseId, filter, user)`: Returns relationship assertions via Ontology Core.
- `getObservations(filter, user)`: Returns spatio-temporal observations via Ontology Core.
- `getGeospatialObservations({ targetCaseId, minLon, minLat, maxLon, maxLat }, user)`: Bounding box spatial queries via Ontology Core.
- `getColocatedObservations({ targetId, radiusMeters, targetCaseId }, user)`: Proximity co-location queries via Ontology Core.
- `getTrajectory({ entityId, targetCaseId }, user)`: Spatio-temporal route waypoints via Ontology Core.
- `searchObjects(query, targetTypes, user)`: Attribute-level search over searchable properties.
- `aggregateObjects(apiName, groupByProp, metric, user)`: Aggregations over Object Set properties.
- `executeAction(actionTypeApiName, input, user)`: Atomic execution of governed Action types.

## 4. Generated SDK
`GET /api/ontology/sdk` generates a typed client schema contract allowing frontend components and external services to interact cleanly through a single governed interface.

## 5. Architectural Verification & Hardening
- **Zero Raw Queries Rule**: Application modules (`graph.js`, `subject360.js`, `geospatial.js`) contain **0** direct raw SQL queries:
  ```bash
  grep -n "db\.query\|db\.queryOne" src/backend/modules/graph.js src/backend/modules/subject360.js src/backend/modules/geospatial.js
  # Must return ZERO matches
  ```
- **Dynamic Object Extensibility**: Dynamic object types registered via `POST /api/ontology/object-types` are immediately readable by graph and 360 modules without code modifications.
- **Security**: ABAC default-deny on all route endpoints and cryptographic SHA-256 audit ledger (`audit_events`).

