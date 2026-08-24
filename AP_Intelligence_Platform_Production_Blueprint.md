# AP SPATIO-TEMPORAL INTELLIGENCE PLATFORM: PRODUCTION BLUEPRINT

## 1. Executive Summary & Architectural Vision
The **AP Spatio-Temporal Intelligence Platform** is an enterprise-grade intelligence integration, entity resolution, and threat analysis system designed to ingest, fuse, and analyze multi-source unstructured and structured intelligence telemetry. Inspired by Palantir's Gotham and Foundry platforms, it replaces isolated data silos with a unified **Immutable Observation & Spatio-Temporal Event Graph**.

---

## 2. Universal Intelligence Data Taxonomy

### Core Universal Primitive:
```
INTELLIGENCE_OBJECT = ENTITY + RELATIONSHIP + EVENT + LOCATION + TIME + EVIDENCE + CONFIDENCE + PROVENANCE
```

### Entity Schema Specs:
- **Person (`PER`)**: Full Name, Aliases, DOB, Passport No, National ID, Risk Score, Primary Phone, Known Locations.
- **Vehicle (`VEH`)**: VIN, License Plate, Make, Model, Color, Registered Owner ID.
- **Phone / Telecom (`TEL`)**: MSISDN (Phone Number), IMSI, IMEI, Carrier, Primary Cell Tower.
- **Location (`LOC`)**: Name, Address, Latitude, Longitude, GeoHash, Facility Type (Safehouse, Airport, Residence, Drop Site).
- **Financial Account (`FIN`)**: Account Number, Bank Name, SWIFT, Account Holder ID, Transaction Velocity.
- **Digital Identifier (`CYB`)**: IP Address, MAC Address, Crypto Wallet Address, Email, Social Media Handle.

### Spatio-Temporal Event Specs:
- `EVENT_ID`: Unique UUID v4
- `EVENT_TYPE`: `CCTV_DETECTION`, `CDR_CALL_HOP`, `LPR_SIGHTING`, `BANK_TRANSACTION`, `CYBER_PING`, `BORDER_CROSSING`
- `TIMESTAMP`: ISO-8601 UTC with microsecond precision
- `GEOLOCATION`: Point (Lat, Lon, Altitude, Accuracy Radius in meters)
- `ASSOCIATED_ENTITIES`: Array of Entity UUIDs with role annotations (`SUBJECT`, `ASSOCIATE`, `TARGET_DEVICE`, `SOURCE_ACCOUNT`)
- `EVIDENCE_REF`: Cryptographic SHA-256 hash reference to raw payload in Evidence Vault

---

## 3. System Architecture & Component Mapping

```
 [ Multi-Source Ingestion Pipeline ] (CDR, CCTV, LPR, Bank, Cyber, GPS)
                 │
                 ▼
 [ Ingestion Engine & Schema Normalizer ]
                 │
                 ▼
 [ Entity Resolution & Disambiguation Engine ] ◄──► [ Analyst Human Review Queue ]
                 │
                 ▼
 [ Immutable Spatio-Temporal Event Graph ]
                 │
  ┌──────────────┼──────────────┬──────────────┐
  ▼              ▼              ▼              ▼
[Subject 360]  [Graph Engine] [Geospatial]  [Evidence Locker]
  │              │              │              │
  └──────────────┴──────────────┴──────────────┘
                 │
                 ▼
     [ Immutable Audit Ledger ]
```

---

## 4. Entity Resolution Engine Specification

### Match Score Algorithmic Formulation:
$$\text{MatchScore}(E_1, E_2) = w_1 \cdot S_{\text{JaroWinkler}}(N_1, N_2) + w_2 \cdot \delta_{\text{Exact}}(\text{ID}_1, \text{ID}_2) + w_3 \cdot S_{\text{Spatial}}(\vec{x}_1, \vec{x}_2) + w_4 \cdot S_{\text{Temporal}}(t_1, t_2)$$

Where:
- $w_1 = 0.35$ (Name Similarity)
- $w_2 = 0.30$ (Exact Identifier Match: Phone, Passport, VIN, MAC)
- $w_3 = 0.20$ (Spatial Co-location Proximity $\le 500\text{m}$)
- $w_4 = 0.15$ (Temporal Window Co-occurrence $\le 15\text{ mins}$)

### Automated Actions based on MatchScore:
- $\text{MatchScore} \ge 0.88$: **Automatic Merge** into canonical Subject 360 profile.
- $0.65 \le \text{MatchScore} < 0.88$: **Candidate Match Proposal** queued for Analyst Review.
- $\text{MatchScore} < 0.65$: **Distinct Entities** maintained; weak graph link logged with lower confidence.

---

## 5. Security, Provenance & Immutable Audit Ledger

### Cryptographic Security Controls:
1. **Evidence Integrity**: Every raw file / stream packet stored is hashed using `SHA-256`. The hash acts as the immutable primary key in the Evidence Locker.
2. **Chain of Custody**: Any access, export, or annotation appends a cryptographic entry `H_n = Hash(H_{n-1} + Timestamp + UserID + Action + Payload)`.
3. **Audit Ledger**: All searches, graph traversals, entity views, overrides, and merges are recorded with user clearance verification.

---

## 6. End-to-End Operational Workflow

1. **User Authentication**: Log into the secure intelligence portal (`/api/auth/login`).
2. **Case Selection**: Select or create an active operational investigation (`/api/cases`).
3. **Telemetry Ingestion**: Upload/stream structured intelligence data (`/api/import`).
4. **Entity Resolution Execution**: Automated entity disambiguation generates matched candidate clusters (`/api/resolution`).
5. **Subject 360 Investigation**: Explore target profiles, risk scores, timeline, and movement history (`/api/subject360`).
6. **Knowledge Graph Exploration**: Visual link analysis, node expansion, shortest path discovery (`/api/graph`).
7. **Geospatial & Temporal Playback**: Scrubber bar maps physical movements, cell tower hops, and LPR cameras over time (`/api/geospatial`).
8. **Evidence Verification**: Inspect SHA-256 evidence chain of custody (`/api/evidence`).
9. **Analyst Review Workbench**: Merge or unmerge candidate entities with audit rationale (`/api/review`).
10. **Audit Ledger Inspection**: Compliance officer audits user activity (`/api/audit`).
