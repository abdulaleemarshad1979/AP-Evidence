-- Migration 007: Phase 13 Investigator Workspace (Quiver Canvases & Dossier Reports)

CREATE TABLE IF NOT EXISTS quiver_canvases (
  id VARCHAR(64) PRIMARY KEY,
  case_id VARCHAR(64) NOT NULL,
  title VARCHAR(256) NOT NULL,
  description TEXT,
  canvas_data TEXT NOT NULL,
  mode VARCHAR(32) DEFAULT 'CANVAS',
  owner_id VARCHAR(64) NOT NULL,
  owner_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dossiers (
  id VARCHAR(64) PRIMARY KEY,
  case_id VARCHAR(64) NOT NULL,
  title VARCHAR(256) NOT NULL,
  summary TEXT,
  sections_json TEXT NOT NULL,
  linked_object_refs TEXT NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  author_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
