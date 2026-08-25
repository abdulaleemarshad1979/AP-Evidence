-- Migration 009: Phase 15 Apollo Release Orchestration Engine

CREATE TABLE IF NOT EXISTS apollo_environments (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  environment_type VARCHAR(32) NOT NULL DEFAULT 'PROD',
  config_json TEXT NOT NULL,
  target_version VARCHAR(32) NOT NULL DEFAULT '2.0.0',
  current_version VARCHAR(32) NOT NULL DEFAULT '2.0.0',
  health_status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY',
  last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS apollo_release_plans (
  id VARCHAR(64) PRIMARY KEY,
  environment_id VARCHAR(64) NOT NULL,
  from_version VARCHAR(32) NOT NULL,
  to_version VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  approval_required BOOLEAN DEFAULT TRUE,
  approved_by VARCHAR(128),
  steps_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
