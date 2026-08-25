-- Migration 004: Phase 10 Ontology Manager, Code Workbook, and Workshop Builder

CREATE TABLE IF NOT EXISTS ontology_object_types (
    id VARCHAR(64) PRIMARY KEY,
    type_name VARCHAR(128) NOT NULL UNIQUE,
    display_label VARCHAR(128) NOT NULL,
    description TEXT,
    icon_name VARCHAR(64) DEFAULT 'fa-cube',
    properties_json TEXT NOT NULL,
    version INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ontology_link_types (
    id VARCHAR(64) PRIMARY KEY,
    link_name VARCHAR(128) NOT NULL UNIQUE,
    display_label VARCHAR(128) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    description TEXT,
    is_directional BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workbook_boards (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    case_id VARCHAR(64) NOT NULL,
    query_config TEXT NOT NULL,
    owner_id VARCHAR(64) NOT NULL,
    owner_name VARCHAR(128) NOT NULL,
    is_shared BOOLEAN DEFAULT TRUE,
    execution_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workshop_dashboards (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    case_id VARCHAR(64) NOT NULL,
    layout_config TEXT NOT NULL, -- JSON array of widget definitions
    owner_id VARCHAR(64) NOT NULL,
    owner_name VARCHAR(128) NOT NULL,
    allowed_roles VARCHAR(256) DEFAULT 'Lead Investigator,Field Analyst',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
