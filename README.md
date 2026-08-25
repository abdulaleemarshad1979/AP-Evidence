# Andhra Pradesh Spatio-Temporal Subject Intelligence Platform (AP-Evidence)

An enterprise-grade, evidence-centric spatio-temporal intelligence platform designed for multi-source data ingestion, automated entity resolution, knowledge graph linking, 360° subject timelines, and cryptographic forensic auditability.

---

## 📚 Documentation & Architecture Guides

- **[Operational Intelligence Architecture & Ingestion Guide](docs/INGESTION_GUIDE.md)**: Detailed ingestion pipelines for CCTV/LPR feeds, CDR call logs, 5-year criminal histories, FIRs, and PCAP telemetry.
- **[Phase 3 Security & Governance](docs/phase-3-security-closure.md)**: Keycloak OIDC authentication, 7-attribute ABAC, PostGIS security policies, and cryptographic hash chain verification.
- **[Phase 4 Secure Ingestion & Quality Engine](docs/phase-4-secure-ingestion.md)**: Data quality rules, source registry, and quarantine management.
- **[Phase 5 Analytics & Alert Lifecycles](docs/phase-5-analytics-alerting.md)**: Complex spatio-temporal rule execution, spatial anomaly detection, and alert triage.
- **[Phase 6 Governed AI Assistance](docs/phase-6-governed-ai.md)**: RAG search, citation back-links, and Human-in-the-Loop review queues.
- **[Phase 7 Enterprise Resilience](docs/phase-7-enterprise-resilience.md)**: Automated backups, zero data loss SLA, retention policies, and disaster recovery.
- **[Phase 8 Operational Pilot Readiness](docs/phase-8-pilot-readiness.md)**: System verification, synthetic pilot scenario testing, and launch checklist.

---

## ⚡ Quick Start

### 1. Requirements
- Node.js (v18+)
- PostgreSQL 16 / PostGIS (or embedded memory store mode)

### 2. Start Application
```bash
# Start backend server
./start.sh
# OR
npm start
```

### 3. Run Automated Compliance Suite
```bash
npm test
```

---

## 🔒 Security & Data Integrity

- **Attribute-Based Access Control (ABAC):** Evaluates `role + org + jurisdiction + case + purpose + classification + action` with a default-deny policy.
- **Forensic Hash Chain:** Every evidence item and audit log entry is bound with SHA-256 cryptographic hashing to maintain legal chain of custody.
- **Entity Resolution Engine:** Deterministic and probabilistic candidate matching supporting reversible merges and full snapshot rollbacks.