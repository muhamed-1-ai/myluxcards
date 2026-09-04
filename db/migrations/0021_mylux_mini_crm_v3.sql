-- Migration 0021: MyLux Mini CRM Upgrade

-- 1. Upgrade card_leads with priority, activity timestamps, and follow-up details
ALTER TABLE card_leads
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS follow_up_note TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_completed_at TIMESTAMPTZ;

-- Add check constraint for priority values
ALTER TABLE card_leads DROP CONSTRAINT IF EXISTS card_leads_priority_check;
ALTER TABLE card_leads ADD CONSTRAINT card_leads_priority_check CHECK (
  priority IN ('HIGH', 'MEDIUM', 'LOW')
);

-- 2. Create lead_activities table for chronological CRM timeline events
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES card_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add performance indexes for CRM querying, sorting, and filtering
CREATE INDEX IF NOT EXISTS card_leads_owner_priority_idx ON card_leads(owner_user_id, priority);
CREATE INDEX IF NOT EXISTS card_leads_owner_activity_idx ON card_leads(owner_user_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS lead_activities_lead_idx ON lead_activities(lead_id, created_at DESC);
