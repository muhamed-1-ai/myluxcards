-- Migration 0030: Dynamic Leads Custom Field Engine

-- 1. Create table for account-level custom field definitions
CREATE TABLE IF NOT EXISTS lead_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  input_type TEXT NOT NULL, -- TEXT, TEXTAREA, NUMBER, SELECT, RADIO, CHECKBOX, DATE, FILE, DATETIME
  is_required BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, ARCHIVED
  sort_order INTEGER NOT NULL DEFAULT 1,
  options JSONB DEFAULT '[]'::jsonb, -- [{ id: string, label: string, value: string }]
  config JSONB DEFAULT '{}'::jsonb, -- Extra rules like maxFileSize, allowedTypes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for quick account-level retrieval and filtering
CREATE INDEX IF NOT EXISTS idx_lead_field_defs_owner ON lead_field_definitions(owner_user_id, sort_order ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_lead_field_defs_owner_status ON lead_field_definitions(owner_user_id, status);

-- 2. Create table for storing per-lead custom field values
CREATE TABLE IF NOT EXISTS lead_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES lead_field_definitions(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL, -- Immutable field name snapshot for fallbacks
  value JSONB NOT NULL, -- Stored as JSONB to preserve number 0, boolean false, arrays, objects, strings
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_lead_field_def UNIQUE(lead_id, field_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_field_vals_lead ON lead_field_values(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_field_vals_owner ON lead_field_values(owner_user_id);
