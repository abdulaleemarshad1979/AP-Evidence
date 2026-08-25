-- Migration 005: Ontology Core Primitives (Object Types, Properties, Link Types, Action Types, Functions)

CREATE TABLE IF NOT EXISTS ontology_object_types (
    id VARCHAR(64) PRIMARY KEY,
    api_name VARCHAR(128),
    type_name VARCHAR(128),
    display_name VARCHAR(128),
    display_label VARCHAR(128),
    description TEXT,
    primary_key_property VARCHAR(64) DEFAULT 'id',
    backing_table_or_view VARCHAR(128) DEFAULT 'entities',
    icon_name VARCHAR(64) DEFAULT 'fa-cube',
    properties_json TEXT,
    version INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_by VARCHAR(128) NOT NULL DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ontology_object_types ADD COLUMN IF NOT EXISTS api_name VARCHAR(128);
ALTER TABLE ontology_object_types ADD COLUMN IF NOT EXISTS display_name VARCHAR(128);
ALTER TABLE ontology_object_types ADD COLUMN IF NOT EXISTS primary_key_property VARCHAR(64) DEFAULT 'id';
ALTER TABLE ontology_object_types ADD COLUMN IF NOT EXISTS backing_table_or_view VARCHAR(128) DEFAULT 'entities';

CREATE TABLE IF NOT EXISTS ontology_properties (
    id VARCHAR(64) PRIMARY KEY,
    object_type_id VARCHAR(64) NOT NULL,
    api_name VARCHAR(128) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    base_type VARCHAR(64) NOT NULL DEFAULT 'STRING',
    is_required BOOLEAN DEFAULT FALSE,
    is_searchable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ontology_link_types (
    id VARCHAR(64) PRIMARY KEY,
    api_name VARCHAR(128),
    link_name VARCHAR(128),
    display_name VARCHAR(128),
    display_label VARCHAR(128),
    object_type_a VARCHAR(128),
    object_type_b VARCHAR(128),
    source_type VARCHAR(64),
    target_type VARCHAR(64),
    side_a_name VARCHAR(128),
    side_b_name VARCHAR(128),
    cardinality VARCHAR(32) DEFAULT 'MANY_TO_MANY',
    description TEXT,
    is_directional BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_by VARCHAR(128) NOT NULL DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ontology_link_types ADD COLUMN IF NOT EXISTS api_name VARCHAR(128);
ALTER TABLE ontology_link_types ADD COLUMN IF NOT EXISTS display_name VARCHAR(128);
ALTER TABLE ontology_link_types ADD COLUMN IF NOT EXISTS object_type_a VARCHAR(128);
ALTER TABLE ontology_link_types ADD COLUMN IF NOT EXISTS object_type_b VARCHAR(128);
ALTER TABLE ontology_link_types ADD COLUMN IF NOT EXISTS side_a_name VARCHAR(128);
ALTER TABLE ontology_link_types ADD COLUMN IF NOT EXISTS side_b_name VARCHAR(128);
ALTER TABLE ontology_link_types ADD COLUMN IF NOT EXISTS cardinality VARCHAR(32) DEFAULT 'MANY_TO_MANY';

CREATE TABLE IF NOT EXISTS ontology_functions (
    id VARCHAR(64) PRIMARY KEY,
    api_name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    implementation_ref VARCHAR(256) NOT NULL,
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ontology_action_types (
    id VARCHAR(64) PRIMARY KEY,
    api_name VARCHAR(128) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    target_object_type VARCHAR(128) NOT NULL,
    input_schema TEXT NOT NULL,
    function_id VARCHAR(64),
    version INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_by VARCHAR(128) NOT NULL DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
