# Phase 6 — Governed Synthetic AI Assistance & Human-in-the-Loop Control
**System:** Andhra Pradesh Intelligence System (APIS)  
**Classification:** SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE  
**Date:** August 24, 2026  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Executive Summary

Phase 6 introduces a governed, task-oriented synthetic AI assistant. All AI output must explicitly cite raw evidence IDs (`[EVI-xxx]`) and remain in a `PENDING_REVIEW` state until a human investigator explicitly reviews and approves or rejects the draft.

---

## 2. Ethical Guardrails & Governance Policies

1. **No Automated Operational Actions:** AI output cannot trigger automated warrants, arrests, or threat scores.
2. **Mandatory Evidence Citation:** Any sentence or claim without a direct citation link to an immutable evidence record in the vault is rejected at generation time.
3. **Human-in-the-Loop Approval:** Status lifecycle transition (`GENERATED` -> `PENDING_REVIEW` -> `APPROVED` / `REJECTED` / `SUPERSEDED`).
4. **Model Registry Accountability:** Every run records the underlying model ID, provider, version, intended use, prohibited use, and known limitations.

---

## 3. Supported Task Workflows

* `SUMMARIZE_TIMELINE` — Generates evidence-cited spatio-temporal chronologies.
* `DRAFT_LEAD_REPORT` — Synthesizes investigative lead summaries with citation tags.
* `EXPLAIN_PROXIMITY` — Provides spatial distance breakdowns and confidence bounds.
* `RECOMMEND_GAPS` — Highlights temporal or spatial sensor coverage gaps.

---

## 4. Phase 6 API Endpoints (`/api/v1/`)

* `GET /api/v1/ai/models` — List registered AI models in governance registry.
* `POST /api/v1/ai/models` — Register new model version.
* `POST /api/v1/ai/assist` — Run governed synthetic AI task.
* `GET /api/v1/ai/runs` — Query generated AI outputs.
* `PUT /api/v1/ai/runs/:id/review` — Submit Human-in-the-Loop review decision.
