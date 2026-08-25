# Phase 9 — Unstructured Document & Multi-Format Ingestion Engine
**System:** Andhra Pradesh Intelligence System (APIS)  
**Classification:** SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE  
**Date:** August 25, 2026  
**Status:** COMPLETED & VERIFIED  

---

## 1. Executive Summary

Phase 9 closes the unstructured data gap in the platform by introducing a comprehensive multi-format ingestion engine. It enables parsing text-layer and scanned image PDFs (via an OCR pipeline wrapper), DOCX, FIR case-sheets, arbitrary CSV files with customizable column mapping, and PCAP network dumps. Extracted facts (named entities, spatio-temporal observations, and assertions) are stored as `PENDING_REVIEW` candidate extractions with exact page numbers, text offsets, and source document citations, ensuring human-in-the-loop triage before graph persistence.

---

## 2. Key Architecture & Endpoints

| Endpoint | Method | Action / Purpose | Guardrails & Audit |
| :--- | :--- | :--- | :--- |
| `/api/v1/connectors/documents/ingest` | `POST` | Ingests PDF/DOCX/Image/Text case-sheets, runs NLP NER & relationship extractions | Cryptographic SHA-256 hash, evidence vault storage, ABAC `IMPORT_DATA` check |
| `/api/v1/connectors/documents/:jobId/extractions` | `GET` | Retrieves candidate extraction facts for a document job | ABAC `VIEW_CASE` check |
| `/api/v1/connectors/documents/extractions/:id/review` | `POST` | Approves or rejects a candidate extraction; approved facts commit to entities/observations | ABAC `MANAGE_RESOLUTIONS`, audit log hash chain |
| `/api/import/csv-mapped` | `POST` | Ingests arbitrary CSV files using user-defined column mapping | ABAC `INGEST`, idempotency check |
| `/api/import/pcap` | `POST` | Ingests network PCAP flow dumps and extracts network indicators | ABAC `INGEST`, evidence ledger record |

---

## 3. Operational Safety & Synthetic Notice

This system operates on synthetic demonstration data only (`SUB-00001`, `CASE-AP-2026-0001`, synthetic FIR case-sheets). All automated extractions require human approval prior to operational use.
