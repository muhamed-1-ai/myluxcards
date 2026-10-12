-- Migration 0032: Track pipeline stage from which a lead became lost
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lost_at_stage TEXT;

CREATE INDEX IF NOT EXISTS leads_lost_at_stage_idx ON leads(owner_user_id, lost_at_stage) WHERE status = 'LOST';

-- Backfill existing lost leads from lead_activities history where available
UPDATE leads l
SET lost_at_stage = sub.from_value
FROM (
  SELECT DISTINCT ON (lead_id) lead_id, from_value
  FROM lead_activities
  WHERE (type = 'LEAD_LOST' OR to_value = 'LOST') AND from_value IS NOT NULL
  ORDER BY lead_id, occurred_at DESC
) sub
WHERE l.id = sub.lead_id AND l.status = 'LOST' AND l.lost_at_stage IS NULL;
