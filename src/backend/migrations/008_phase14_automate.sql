-- Migration 008: Phase 14 Automate Alerting Engine

CREATE TABLE IF NOT EXISTS automations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  description TEXT,
  condition_definition TEXT NOT NULL,
  proposed_action_type VARCHAR(128) NOT NULL,
  review_required BOOLEAN DEFAULT TRUE,
  enabled BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 1,
  created_by VARCHAR(128) NOT NULL DEFAULT 'System',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
