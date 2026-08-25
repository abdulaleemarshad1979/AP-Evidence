-- Migration 003: Phase 9 Unstructured Document & Multi-Format Ingestion Engine

CREATE TABLE IF NOT EXISTS document_jobs (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL,
    file_name VARCHAR(256) NOT NULL,
    media_type VARCHAR(64) NOT NULL,
    file_size VARCHAR(64) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    evidence_id VARCHAR(64) NOT NULL,
    status VARCHAR(64) DEFAULT 'PROCESSING',
    extracted_text TEXT,
    page_count INT DEFAULT 1,
    ocr_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_extractions (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    evidence_id VARCHAR(64) NOT NULL,
    extraction_type VARCHAR(64) NOT NULL, -- ENTITY, OBSERVATION, ASSERTION
    entity_type VARCHAR(64),              -- PERSON, VEHICLE, PHONE, LOCATION, IP_ADDRESS
    extracted_value VARCHAR(256) NOT NULL,
    canonical_name VARCHAR(256),
    relation_type VARCHAR(64),
    object_value VARCHAR(256),
    confidence_score DOUBLE PRECISION DEFAULT 0.85,
    location_name VARCHAR(256),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    page_number INT DEFAULT 1,
    text_offset VARCHAR(64),
    snippet TEXT NOT NULL,
    status VARCHAR(64) DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, APPROVED, REJECTED
    reviewed_by VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
