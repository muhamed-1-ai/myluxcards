-- Migration 0041: Add is_setup and requested_by_admin_id columns to auth_action_tokens for admin password setup tracking
ALTER TABLE auth_action_tokens
  ADD COLUMN IF NOT EXISTS is_setup BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requested_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auth_tokens_admin ON auth_action_tokens(requested_by_admin_id);
