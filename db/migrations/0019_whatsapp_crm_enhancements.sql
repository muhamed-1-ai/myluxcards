-- 0019_whatsapp_crm_enhancements.sql
-- Upgrades to support Meta Embedded Signup, connection health, inbound reply indicators, and performance indexes

ALTER TABLE whatsapp_connections
  ADD COLUMN IF NOT EXISTS meta_app_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS connection_type VARCHAR(50) DEFAULT 'EMBEDDED',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE card_leads
  ADD COLUMN IF NOT EXISTS has_new_reply BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_inbound_whatsapp_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_card_leads_has_new_reply ON card_leads (owner_user_id, has_new_reply);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid ON whatsapp_messages (wamid);
