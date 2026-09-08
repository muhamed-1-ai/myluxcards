-- Create modular section tables for ZAPPIT Advanced Dynamic Profile Builder

-- 1. Services Showcase Table
CREATE TABLE IF NOT EXISTS card_profile_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'INR',
  image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_services_card_id_idx ON card_profile_services(card_id);

-- 2. Portfolio Projects Table
CREATE TABLE IF NOT EXISTS card_profile_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  project_url TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_portfolio_card_id_idx ON card_profile_portfolio(card_id);

-- 3. Photo Gallery Table
CREATE TABLE IF NOT EXISTS card_profile_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_gallery_card_id_idx ON card_profile_gallery(card_id);

-- 4. Videos Showcase Table
CREATE TABLE IF NOT EXISTS card_profile_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'YouTube',
  video_url TEXT NOT NULL,
  embed_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_videos_card_id_idx ON card_profile_videos(card_id);

-- 5. Payment Links Table
CREATE TABLE IF NOT EXISTS card_profile_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'UPI',
  pay_url TEXT NOT NULL,
  upi_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_payment_links_card_id_idx ON card_profile_payment_links(card_id);

-- 6. Documents Table
CREATE TABLE IF NOT EXISTS card_profile_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size TEXT NOT NULL DEFAULT '',
  file_type TEXT NOT NULL DEFAULT 'PDF',
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_documents_card_id_idx ON card_profile_documents(card_id);

-- 7. Achievements Table
CREATE TABLE IF NOT EXISTS card_profile_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  achievement_date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_achievements_card_id_idx ON card_profile_achievements(card_id);

-- 8. Certifications Table
CREATE TABLE IF NOT EXISTS card_profile_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL DEFAULT '',
  credential_url TEXT NOT NULL DEFAULT '',
  certificate_url TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS card_profile_certifications_card_id_idx ON card_profile_certifications(card_id);
