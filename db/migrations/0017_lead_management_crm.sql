-- Migration 0017: Lead Management System (Mini CRM)

-- 1. Upgrade card_leads table structure
ALTER TABLE card_leads
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS submission_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Backfill owner_user_id for existing leads from digital_cards
UPDATE card_leads l
SET owner_user_id = c.owner_id
FROM digital_cards c
WHERE l.card_id = c.id AND l.owner_user_id IS NULL;

-- 3. Update status constraint to include all CRM pipeline statuses
ALTER TABLE card_leads DROP CONSTRAINT IF EXISTS card_leads_status_check;

ALTER TABLE card_leads ADD CONSTRAINT card_leads_status_check CHECK (
  status IN ('NEW', 'CONTACTED', 'INTERESTED', 'FOLLOW_UP', 'WON', 'LOST', 'ARCHIVED')
);

-- 4. Create timeline lead_notes table
CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES card_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Add performance indexes for dashboard searches and queries
CREATE INDEX IF NOT EXISTS card_leads_owner_idx ON card_leads(owner_user_id);
CREATE INDEX IF NOT EXISTS card_leads_owner_status_idx ON card_leads(owner_user_id, status);
CREATE INDEX IF NOT EXISTS card_leads_owner_created_idx ON card_leads(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_leads_owner_phone_norm_idx ON card_leads(owner_user_id, phone_normalized);
CREATE INDEX IF NOT EXISTS card_leads_follow_up_idx ON card_leads(owner_user_id, next_follow_up_at);
CREATE INDEX IF NOT EXISTS lead_notes_lead_idx ON lead_notes(lead_id, created_at DESC);
