-- Migration 0047: Add optional App Download configuration to digital card profiles
-- Profile JSONB schema supports:
--   appDownload: {
--     appName: string (optional),
--     appStoreUrl: string (optional),
--     playStoreUrl: string (optional)
--   }

-- Backward compatible: digital_cards.profile is a JSONB column.
-- Existing profiles default appDownload to empty strings via cleanCardProfile / completeCardProfile.
COMMENT ON COLUMN digital_cards.profile IS 'JSONB profile structure containing personal details, social links, products, and optional appDownload store links.';
