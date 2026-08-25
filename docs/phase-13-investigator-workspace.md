# Phase 13 — Investigator Workspace: Object Explorer, Quiver Canvas, and Living Dossier Reports

## Architectural Overview
Phase 13 establishes the analyst-facing workspace layer operating over the `OntologyEngine`. It provides three unified tools for investigative lead discovery, analytical canvas modeling, and dynamic reporting:

1. **Object Explorer** (`src/frontend/js/components/object_explorer.js`)
   - Low-configuration table, spatial map, and chart aggregate views for any registered Ontology Object Type (built-in or user-defined via Ontology Manager).
   - Supports bulk execution of governed actions (`FLAG_SUBJECT`, `ADD_OBSERVATION`, etc.) and JSON/CSV object set exports.
   - Talks directly to generic `OntologyEngine` retrieval methods (`getObjectsByType`, `searchObjects`, `aggregateObjects`).

2. **Quiver Analysis Canvas** (`src/frontend/js/components/quiver.js` + `/api/quiver/canvases`)
   - Drag-and-drop analytical card layout supporting free-form canvas mode and Cytoscape/graph-mode analysis.
   - Saved and re-openable per case with full transactional state persistence in `quiver_canvases`.

3. **Dossier Living Reports** (`src/frontend/js/components/dossier.js` + `/api/dossier/reports`)
   - Report editor where objects and visualizations are referenced by primary key link rather than static copy.
   - Dynamic live object resolution on load/render (`/api/dossier/reports/:id`), ensuring property updates in the underlying database reflect automatically across all linked dossiers.
   - Replaces static export packages with general-purpose living Markdown/JSON reports.

## Data Schema & Persistence
- Table `quiver_canvases`: `id`, `case_id`, `title`, `description`, `canvas_data`, `mode`, `owner_id`, `owner_name`, `created_at`, `updated_at`.
- Table `dossiers`: `id`, `case_id`, `title`, `summary`, `sections_json`, `linked_object_refs`, `author_id`, `author_name`, `status`, `created_at`, `updated_at`.

## Verification & Compliance
- Compliance Test Group 23 verifies:
  1. Object Explorer search results match direct `ontologyEngine.getObjectsByType` queries.
  2. Quiver analysis canvas saves and round-trips correctly.
  3. Living Dossier dynamically updates referenced object property values when source records change in the Ontology.
