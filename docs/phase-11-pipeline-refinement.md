# Phase 11 Architectural Spec — Pipeline Refinement & Telemetry Ontology Mapping

## 1. Overview
Phase 11 generalizes all telemetry connectors (CCTV, CDR, network PCAP packet captures, syslogs) to map incoming data streams into typed Ontology Objects (`NetworkIndicator`, `PCAPDump`, `Observation`) connected via formal Link Types (`COMMUNICATED_WITH`, `INGESTED_IN_PCAP`, `OBSERVED_AT`).

## 2. Ontology Telemetry Primitives
- **NetworkIndicator**: IP addresses, domain names, MAC addresses modeled as primary Ontology Objects.
- **PCAPDump**: Packet capture files represented as Evidentiary Objects in the Ontology Vault.
- **COMMUNICATED_WITH**: Link Type between network endpoints.
- **INGESTED_IN_PCAP**: Link Type connecting NetworkIndicators to backing PCAP captures.

## 3. Ingestion Integration
`telemetry_connector.js` ingests raw packet captures and network logs, creating `NetworkIndicator` entities and registering `OBSERVED_AT` observation objects using `ontologyEngine.executeAction`.
