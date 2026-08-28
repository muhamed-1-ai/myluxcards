-- 0018_whatsapp_business_integration.sql
-- WhatsApp Business Platform (Cloud API) tables and Lead opt-in extensions

-- 1. Extend card_leads table with WhatsApp consent columns
ALTER TABLE card_leads 
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_card_leads_whatsapp_opt_in ON card_leads (owner_user_id, whatsapp_opt_in);

-- 2. WhatsApp Connections table (per MyLux card owner)
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'META',
  waba_id VARCHAR(100) NOT NULL,
  phone_number_id VARCHAR(100) NOT NULL,
  display_phone_number VARCHAR(50),
  verified_name VARCHAR(255),
  quality_rating VARCHAR(50) DEFAULT 'GREEN',
  connection_status VARCHAR(50) NOT NULL DEFAULT 'CONNECTED',
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_connections_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_phone ON whatsapp_connections (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_waba ON whatsapp_connections (waba_id);

-- 3. WhatsApp Templates table (synced from Meta WABA)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  waba_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  language VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_templates_user_name_lang UNIQUE (user_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user ON whatsapp_templates (user_id);

-- 4. WhatsApp Campaigns table (broadcast records)
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_language VARCHAR(20) NOT NULL DEFAULT 'en_US',
  template_params JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  eligible_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_user ON whatsapp_campaigns (user_id, created_at DESC);

-- 5. WhatsApp Campaign Recipients table (dispatch queue and delivery tracking)
CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES card_leads(id) ON DELETE CASCADE,
  phone_number VARCHAR(50) NOT NULL,
  wamid VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_code VARCHAR(50),
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_recipients_campaign ON whatsapp_campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recipients_wamid ON whatsapp_campaign_recipients (wamid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recipients_lead ON whatsapp_campaign_recipients (lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recipients_status ON whatsapp_campaign_recipients (campaign_id, status);

-- 6. WhatsApp Messages table (1-on-1 history and inbound replies)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES card_leads(id) ON DELETE SET NULL,
  wamid VARCHAR(255),
  direction VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'RECEIVED',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_lead ON whatsapp_messages (user_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid ON whatsapp_messages (wamid);
