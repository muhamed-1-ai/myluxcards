-- Migration 0040: Follow-up Push Dispatches & Notification Preview Preferences

-- 1. Add show_previews toggle to notification_preferences if not exists
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS show_previews BOOLEAN NOT NULL DEFAULT true;

-- 2. Create durable follow_up_push_dispatches tracking table
CREATE TABLE IF NOT EXISTS follow_up_push_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES lead_follow_ups(id) ON DELETE CASCADE,
  reminder_version INTEGER NOT NULL DEFAULT 1,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'ACCEPTED', 'FAILED', 'GONE')),
  status_code INTEGER,
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_follow_up_push_dispatch UNIQUE (follow_up_id, reminder_version, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_fu_push_dispatches_user ON follow_up_push_dispatches(user_id);
CREATE INDEX IF NOT EXISTS idx_fu_push_dispatches_fu_ver ON follow_up_push_dispatches(follow_up_id, reminder_version);
