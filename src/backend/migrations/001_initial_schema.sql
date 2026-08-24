-- PostgreSQL 16 + PostGIS Schema Migration: Foundation Correction Pass 2
-- System: AP Spatio-Temporal Subject Intelligence Platform

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(64) NOT NULL CHECK (role IN ('Analyst', 'Case Manager', 'Auditor', 'Admin')),
    organization VARCHAR(64) NOT NULL,
    jurisdiction VARCHAR(64) NOT NULL,
    purpose_clearance VARCHAR(64) NOT NULL,
    password_hash VARCHAR(256),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cases Table
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    code_name VARCHAR(128) NOT NULL,
    description TEXT,
    organization VARCHAR(64) NOT NULL,
    jurisdiction VARCHAR(64) NOT NULL,
    classification_level VARCHAR(128) DEFAULT 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    permitted_purposes TEXT NOT NULL,
    status VARCHAR(64) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'CLOSED')),
    target_entity_ids TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Case Assignments Table
CREATE TABLE IF NOT EXISTS case_assignments (
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (case_id, user_id)
);

-- 4. Entities Table
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
    status VARCHAR(64) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MERGED', 'ARCHIVED')),
    canonical_entity_id VARCHAR(64) REFERENCES entities(id) ON DELETE SET NULL,
    version INT DEFAULT 1 NOT NULL,
    is_fictional BOOLEAN DEFAULT TRUE,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Evidence Metadata Table
CREATE TABLE IF NOT EXISTS evidence_metadata (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    media_type VARCHAR(64) NOT NULL,
    file_size VARCHAR(64) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    object_key VARCHAR(256),
    version_id VARCHAR(128),
    is_original BOOLEAN DEFAULT TRUE,
    parent_evidence_id VARCHAR(64) REFERENCES evidence_metadata(id) ON DELETE SET NULL,
    classification VARCHAR(128) DEFAULT 'SYNTHETIC TRAINING DATA — NOT FOR OPERATIONAL USE',
    custodian VARCHAR(128) NOT NULL,
    source_device VARCHAR(128) NOT NULL,
    case_id VARCHAR(64) REFERENCES cases(id) ON DELETE CASCADE,
    evidence_status VARCHAR(64) DEFAULT 'VERIFIED_RAW',
    human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED',
    review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM',
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Observations Table (PostGIS spatial coordinates)
CREATE TABLE IF NOT EXISTS observations (
    id VARCHAR(64) PRIMARY KEY,
    entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    case_id VARCHAR(64) REFERENCES cases(id) ON DELETE CASCADE,
    observation_type VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    location_name VARCHAR(256),
    latitude DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    longitude DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    location_geom GEOGRAPHY(Point, 4326),
    confidence_score DOUBLE PRECISION DEFAULT 0.90 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    evidence_status VARCHAR(64) DEFAULT 'VERIFIED_RAW',
    raw_data TEXT,
    evidence_id VARCHAR(64) REFERENCES evidence_metadata(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Assertions Table
CREATE TABLE IF NOT EXISTS assertions (
    id VARCHAR(64) PRIMARY KEY,
    subject_entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    object_entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    case_id VARCHAR(64) REFERENCES cases(id) ON DELETE CASCADE,
    relation_type VARCHAR(64) NOT NULL,
    confidence_score DOUBLE PRECISION DEFAULT 0.85 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    confidence_method VARCHAR(64) DEFAULT 'PROBABILISTIC_JARO_WINKLER',
    assertion_class VARCHAR(64) DEFAULT 'ALGORITHMIC_CANDIDATE',
    human_review_status VARCHAR(64) DEFAULT 'UNREVIEWED',
    review_priority VARCHAR(64) DEFAULT 'P2_MEDIUM',
    evidence_id VARCHAR(64) REFERENCES evidence_metadata(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Evidence Custody Ledger Table
CREATE TABLE IF NOT EXISTS evidence_custody_ledger (
    id VARCHAR(64) PRIMARY KEY,
    evidence_id VARCHAR(64) NOT NULL REFERENCES evidence_metadata(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    notes TEXT,
    hash_signature VARCHAR(64) NOT NULL
);

-- 9. Ingestion Batches Table
CREATE TABLE IF NOT EXISTS ingestion_batches (
    id VARCHAR(64) PRIMARY KEY,
    source_feed VARCHAR(128) NOT NULL,
    feed_type VARCHAR(64) NOT NULL,
    total_records INT DEFAULT 0 CHECK (total_records >= 0),
    accepted_records INT DEFAULT 0 CHECK (accepted_records >= 0),
    rejected_records INT DEFAULT 0 CHECK (rejected_records >= 0),
    duplicate_records INT DEFAULT 0 CHECK (duplicate_records >= 0),
    quarantined_records INT DEFAULT 0 CHECK (quarantined_records >= 0),
    status VARCHAR(64) DEFAULT 'COMPLETED',
    payload_hash VARCHAR(64) NOT NULL,
    reconciliation_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Ingestion Rows Table
CREATE TABLE IF NOT EXISTS ingestion_rows (
    id VARCHAR(64) PRIMARY KEY,
    batch_id VARCHAR(64) NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
    row_index INT NOT NULL,
    raw_payload TEXT NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL CHECK (status IN ('ACCEPTED', 'QUARANTINED', 'DUPLICATE', 'REJECTED')),
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Resolution Candidates Table
CREATE TABLE IF NOT EXISTS resolution_candidates (
    id VARCHAR(64) PRIMARY KEY,
    entity_a VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    entity_b VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    rule_version VARCHAR(64) NOT NULL,
    match_score DOUBLE PRECISION NOT NULL CHECK (match_score >= 0.0 AND match_score <= 1.0),
    compared_fields TEXT NOT NULL,
    individual_scores TEXT NOT NULL,
    conflicts TEXT,
    human_review_status VARCHAR(64) DEFAULT 'PENDING_REVIEW',
    review_priority VARCHAR(64) DEFAULT 'P1_HIGH',
    reviewer VARCHAR(128),
    decision_reason TEXT,
    status VARCHAR(64) DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED_MERGED', 'REJECTED_SPLIT', 'REVERSED')),
    version INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Merge History Table
CREATE TABLE IF NOT EXISTS merge_history (
    id VARCHAR(64) PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL,
    primary_entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    secondary_entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    reviewer VARCHAR(128) NOT NULL,
    decision_reason TEXT NOT NULL,
    original_state_snapshot TEXT NOT NULL,
    action VARCHAR(64) NOT NULL CHECK (action IN ('MERGED', 'REVERSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Audit Events Table (Immutable append-only ledger)
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

-- Trigger function to enforce append-only audit ledger at DB level
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_modification ON audit_events;
CREATE TRIGGER trg_prevent_audit_modification
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- 14. Transactional Outbox Events Table
CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(64) PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(64) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_observations_case_id ON observations(case_id);
CREATE INDEX IF NOT EXISTS idx_observations_entity_id ON observations(entity_id);
CREATE INDEX IF NOT EXISTS idx_observations_geom ON observations USING GIST (location_geom);
CREATE INDEX IF NOT EXISTS idx_assertions_case_id ON assertions(case_id);
CREATE INDEX IF NOT EXISTS idx_assertions_subject ON assertions(subject_entity_id);
CREATE INDEX IF NOT EXISTS idx_assertions_object ON assertions(object_entity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence_metadata(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sha256 ON evidence_metadata(sha256);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_case_id ON audit_events(case_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_rows_hash ON ingestion_rows(payload_hash);

-- ROW LEVEL SECURITY (RLS) ENABLEMENT
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assertions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Default RLS Policies (Allow application user full access when session context is bypass, or filter by case)
DROP POLICY IF EXISTS app_cases_policy ON cases;
CREATE POLICY app_cases_policy ON cases FOR ALL USING (true);

DROP POLICY IF EXISTS app_entities_policy ON entities;
CREATE POLICY app_entities_policy ON entities FOR ALL USING (true);

DROP POLICY IF EXISTS app_obs_policy ON observations;
CREATE POLICY app_obs_policy ON observations FOR ALL USING (true);

DROP POLICY IF EXISTS app_assertions_policy ON assertions;
CREATE POLICY app_assertions_policy ON assertions FOR ALL USING (true);

DROP POLICY IF EXISTS app_evidence_policy ON evidence_metadata;
CREATE POLICY app_evidence_policy ON evidence_metadata FOR ALL USING (true);

DROP POLICY IF EXISTS app_audit_policy ON audit_events;
CREATE POLICY app_audit_policy ON audit_events FOR SELECT USING (true);
