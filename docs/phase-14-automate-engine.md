# Phase 14 — Automate: The Governance-First Alerting Engine

## Architectural Overview
Phase 14 replaces hardcoded alerting mechanisms with **Palantir Automate**, a continuous evaluation engine that transforms user-defined conditions into `PENDING_REVIEW` governed action proposals.

1. **Continuous Background Evaluator** (`src/backend/ontology/automate.js`)
   - Periodically evaluates active automations against live Ontology objects (`Observation`, `Person`, etc.) retrieved strictly through `ontologyEngine`.
   - Supports condition definitions including `SPEED_PLAUSIBILITY` (movement speed > max km/h threshold) and `CO_LOCATION` (spatio-temporal proximity < radius meters).
   - Generates action execution proposals in a `PENDING_REVIEW` state stored in the shared review queue (`ai_runs`), ensuring no automated rule can alter system state without human approval.

2. **Automate Rule Builder UI** (`src/frontend/js/components/automate.js` + `/api/automate`)
   - Visual dashboard for analysts to inspect, enable, disable, or create new continuous monitoring rules.
   - Provides trigger history and manual trigger evaluation buttons.

3. **Unified Cross-Case Control Room** (`src/frontend/js/components/control_room.js`)
   - Cross-case command center displaying active system telemetry, database health metrics, and a unified pending-review queue for both AIP and Automate proposals.

## Security & Governance Guardrails
- **Human-in-the-Loop Enforced**: Every Automate rule generates proposals with `review_required = true`. Actions are not directly executed by the background process.
- **Audit Logging**: All rule modifications, evaluation triggers, and proposal creations write tamper-evident audit ledger events.

## Test Verification
- Compliance Test Group 24 verifies:
  1. Registering an Automate rule (e.g. speed > 120 km/h or co-location within 500m).
  2. Ingesting matching observation data via `ontologyEngine.executeAction('ADD_OBSERVATION', ...)`.
  3. Triggering evaluation pass and asserting that a `PENDING_REVIEW` proposal is created (and NOT executed directly).
  4. Approving the proposal and asserting that the action executes and changes object state.
