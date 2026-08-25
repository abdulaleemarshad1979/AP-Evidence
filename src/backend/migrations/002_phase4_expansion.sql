-- PostgreSQL 16 + PostGIS Schema Migration: Phase 4-8 Expansion
-- System: Andhra Pradesh Intelligence System (APIS)

-- 1. Source Registry Table
CREATE TABLE IF NOT EXISTS sources (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    description TEXT,
    owner VARCHAR(128) NOT NULL,
    classification VARCHAR(128) DEFAULT 'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY',
    data_format VARCHAR(64) NOT NULL,
    schema_version VARCHAR(32) DEFAULT '1.0.0',
    enabled BOOLEAN DEFAULT TRUE,
    trust_level VARCHAR(32) DEFAULT 'MEDIUM',
    retention_policy VARCHAR(64) DEFAULT '30_DAYS',
    last_successful_ingestion TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(32) DEFAULT 'HEALTHY',
    config_ref VARCHAR(256),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ingestion Jobs Table
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id VARCHAR(64) PRIMARY KEY,
    source_id VARCHAR(64) REFERENCES sources(id) ON DELETE CASCADE,
    job_type VARCHAR(64) NOT NULL,
    status VARCHAR(64) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'QUARANTINED', 'FAILED', 'CANCELLED')),
    idempotency_key VARCHAR(128) UNIQUE,
    total_records INT DEFAULT 0,
    processed_records INT DEFAULT 0,
    accepted_records INT DEFAULT 0,
    quarantined_records INT DEFAULT 0,
    duplicate_records INT DEFAULT 0,
    error_log TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Data Quality Results Table
CREATE TABLE IF NOT EXISTS data_quality_results (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    source_id VARCHAR(64) REFERENCES sources(id) ON DELETE CASCADE,
    completeness_score DOUBLE PRECISION DEFAULT 1.0,
    validity_score DOUBLE PRECISION DEFAULT 1.0,
    consistency_score DOUBLE PRECISION DEFAULT 1.0,
    timeliness_score DOUBLE PRECISION DEFAULT 1.0,
    uniqueness_score DOUBLE PRECISION DEFAULT 1.0,
    source_reliability_score DOUBLE PRECISION DEFAULT 1.0,
    overall_quality_grade VARCHAR(16) DEFAULT 'EXCELLENT',
    failed_rules TEXT,
    remediation_suggestions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Analytics Rules Table (Phase 5)
CREATE TABLE IF NOT EXISTS analytics_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    rule_version VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    authorized_scope VARCHAR(64) DEFAULT 'ORG-ALPHA',
    spatial_window_meters INT DEFAULT 500,
    time_window_minutes INT DEFAULT 60,
    conditions_json TEXT NOT NULL,
    severity VARCHAR(32) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    cooldown_minutes INT DEFAULT 15,
    owner VARCHAR(128) NOT NULL,
    approval_status VARCHAR(32) DEFAULT 'APPROVED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Alerts Lifecycle Table (Phase 5)
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) REFERENCES analytics_rules(id) ON DELETE SET NULL,
    title VARCHAR(256) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(32) DEFAULT 'NEW' CHECK (status IN ('NEW', 'TRIAGED', 'ASSIGNED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
    assigned_to VARCHAR(128),
    case_id VARCHAR(64) REFERENCES cases(id) ON DELETE CASCADE,
    subject_entity_id VARCHAR(64) REFERENCES entities(id) ON DELETE CASCADE,
    matched_conditions TEXT,
    evidence_ids TEXT,
    resolution_notes TEXT,
    sla_due_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. AI Model Registry Table (Phase 6)
CREATE TABLE IF NOT EXISTS model_registry (
    id VARCHAR(64) PRIMARY KEY,
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(32) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    intended_use TEXT NOT NULL,
    prohibited_use TEXT NOT NULL,
    approval_status VARCHAR(32) DEFAULT 'APPROVED',
    deployment_status VARCHAR(32) DEFAULT 'ACTIVE',
    known_limitations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. AI Runs & Evidence Citations Table (Phase 6)
CREATE TABLE IF NOT EXISTS ai_runs (
    id VARCHAR(64) PRIMARY KEY,
    prompt_task VARCHAR(128) NOT NULL,
    model_id VARCHAR(64) REFERENCES model_registry(id) ON DELETE SET NULL,
    case_id VARCHAR(64) REFERENCES cases(id) ON DELETE CASCADE,
    input_params TEXT,
    output_text TEXT NOT NULL,
    cited_evidence_ids TEXT,
    confidence_score DOUBLE PRECISION DEFAULT 0.90,
    review_status VARCHAR(32) DEFAULT 'PENDING_REVIEW' CHECK (review_status IN ('GENERATED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
    reviewed_by VARCHAR(128),
    reviewer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Data Retention & Legal Hold Policies Table (Phase 7)
CREATE TABLE IF NOT EXISTS retention_policies (
    id VARCHAR(64) PRIMARY KEY,
    data_category VARCHAR(64) NOT NULL,
    retention_days INT NOT NULL,
    legal_hold_active BOOLEAN DEFAULT FALSE,
    archival_location VARCHAR(256),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Phase 4-8 tables
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(source_type);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source ON ingestion_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_assigned ON alerts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ai_runs_case ON ai_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_runs(review_status);
