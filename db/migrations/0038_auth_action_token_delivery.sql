-- Migration 0038: Add delivery tracking columns to auth_action_tokens for private diagnostics
ALTER TABLE auth_action_tokens
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS delivery_provider TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error TEXT,
  ADD COLUMN IF NOT EXISTS delivery_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_auth_tokens_delivery_status'
  ) THEN
    ALTER TABLE auth_action_tokens
      ADD CONSTRAINT chk_auth_tokens_delivery_status
      CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED', 'UNCONFIGURED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_tokens_delivery ON auth_action_tokens(delivery_status, created_at DESC);
