-- PostgreSQL Schema Migration: Foundation Correction Pass 1
-- System: AP Spatio-Temporal Subject Intelligence Platform

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(64) NOT NULL,
    organization VARCHAR(64) NOT NULL,
    jurisdiction VARCHAR(64) NOT NULL,
    purpose_clearance VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    code_name VARCHAR(128) NOT NULL,
    description TEXT,
    organization VARCHAR(64) NOT NULL,
    jurisdiction VARCHAR(64) NOT NULL,
    classification_level VARCHAR(128) DEFAULT 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    permitted_purposes TEXT NOT NULL,
    status VARCHAR(64) DEFAULT 'ACTIVE',
    target_entity_ids TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_assignments (
    case_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (case_id, user_id)
);

CREATE TABLE IF NOT EXISTS entities (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    aliases TEXT,
    identifier_fields TEXT,
    evidence_status VARCHAR(64) DEFAULT 'VERIFIED_RAW',
    assertion_class VARCHAR(64) DEFAULT 'CONFIRMED_FACT',
    confidence_method VARCHAR(64) DEFAULT 'DETERMINISTIC_EXACT_MATCH',
    human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED',
    review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM',
    is_fictional BOOLEAN DEFAULT TRUE,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS observations (
    id VARCHAR(64) PRIMARY KEY,
    entity_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64),
    observation_type VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    location_name VARCHAR(256),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    confidence_score DOUBLE PRECISION DEFAULT 0.90,
    evidence_status VARCHAR(64) DEFAULT 'VERIFIED_RAW',
    raw_data TEXT,
    evidence_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assertions (
    id VARCHAR(64) PRIMARY KEY,
    subject_entity_id VARCHAR(64) NOT NULL,
    object_entity_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64),
    relation_type VARCHAR(64) NOT NULL,
    confidence_score DOUBLE PRECISION DEFAULT 0.85,
    confidence_method VARCHAR(64) DEFAULT 'PROBABILISTIC_JARO_WINKLER',
    assertion_class VARCHAR(64) DEFAULT 'ALGORITHMIC_CANDIDATE',
    human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED',
    review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM',
    evidence_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_metadata (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    media_type VARCHAR(64) NOT NULL,
    file_size VARCHAR(64) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    is_original BOOLEAN DEFAULT TRUE,
    parent_evidence_id VARCHAR(64),
    classification VARCHAR(128) DEFAULT 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    custodian VARCHAR(128) NOT NULL,
    source_device VARCHAR(128) NOT NULL,
    case_id VARCHAR(64),
    evidence_status VARCHAR(64) DEFAULT 'VERIFIED_RAW',
    human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED',
    review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM',
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_custody_ledger (
    id VARCHAR(64) PRIMARY KEY,
    evidence_id VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    notes TEXT,
    hash_signature VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_batches (
    id VARCHAR(64) PRIMARY KEY,
    source_feed VARCHAR(128) NOT NULL,
    feed_type VARCHAR(64) NOT NULL,
    total_records INT DEFAULT 0,
    accepted_records INT DEFAULT 0,
    rejected_records INT DEFAULT 0,
    duplicate_records INT DEFAULT 0,
    quarantined_records INT DEFAULT 0,
    status VARCHAR(64) DEFAULT 'COMPLETED',
    payload_hash VARCHAR(64) NOT NULL,
    reconciliation_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingestion_rows (
    id VARCHAR(64) PRIMARY KEY,
    batch_id VARCHAR(64) NOT NULL,
    row_index INT NOT NULL,
    raw_payload TEXT NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resolution_candidates (
    id VARCHAR(64) PRIMARY KEY,
    entity_a VARCHAR(64) NOT NULL,
    entity_b VARCHAR(64) NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    match_score DOUBLE PRECISION NOT NULL,
    compared_fields TEXT NOT NULL,
    individual_scores TEXT NOT NULL,
    conflicts TEXT,
    human_review_status VARCHAR(64) DEFAULT 'PENDING_REVIEW',
    review_priority VARCHAR(64) DEFAULT 'P1_HIGH',
    reviewer VARCHAR(128),
    decision_reason TEXT,
    status VARCHAR(64) DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merge_history (
    id VARCHAR(64) PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL,
    primary_entity_id VARCHAR(64) NOT NULL,
    secondary_entity_id VARCHAR(64) NOT NULL,
    reviewer VARCHAR(128) NOT NULL,
    decision_reason TEXT NOT NULL,
    original_state_snapshot TEXT NOT NULL,
    action VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    module VARCHAR(64) NOT NULL,
    details TEXT NOT NULL,
    target_entity_id VARCHAR(64),
    case_id VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(64) PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(64) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);
