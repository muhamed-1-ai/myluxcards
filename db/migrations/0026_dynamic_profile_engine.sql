-- Migration 0026: Dynamic Profile Engine Feature Visibility & Ordering Configuration

-- Idempotently update default feature_permissions JSONB in users table if required
ALTER TABLE users 
ALTER COLUMN feature_permissions 
SET DEFAULT '{
  "dashboard": true,
  "profile": true,
  "nfc_card": true,
  "qr_profile": true,
  "crm": true,
  "leads": true,
  "lost_found": true,
  "vehicle": true,
  "orders": true,
  "analytics": true,
  "products": true,
  "notifications": true
}'::jsonb;

-- Populate missing profile feature configurations inside digital_cards profile JSON safely
UPDATE digital_cards
SET profile = jsonb_strip_nulls(
  jsonb_build_object(
    'profileFeatures', jsonb_build_object(
      'BASIC_PROFILE', jsonb_build_object('enabled', true, 'sortOrder', 0),
      'CONTACT', jsonb_build_object('enabled', true, 'sortOrder', 1),
      'SOCIAL_LINKS', jsonb_build_object('enabled', COALESCE(profile->'social' IS NOT NULL AND profile->'social' != '{}'::jsonb, true), 'sortOrder', 2),
      'WEBSITE', jsonb_build_object('enabled', COALESCE(NULLIF(profile->>'website', '') IS NOT NULL, true), 'sortOrder', 3),
      'EMERGENCY_CONTACT', jsonb_build_object('enabled', COALESCE(NULLIF(profile->>'emergencyContact', '') IS NOT NULL OR NULLIF(profile->>'defaultEmergencyPhone', '') IS NOT NULL, true), 'sortOrder', 4),
      'VEHICLE', jsonb_build_object('enabled', COALESCE(EXISTS(SELECT 1 FROM card_vehicles v WHERE v.card_id = digital_cards.id), true), 'sortOrder', 5),
      'LOST_AND_FOUND', jsonb_build_object('enabled', COALESCE(EXISTS(SELECT 1 FROM card_lost_items i WHERE i.card_id = digital_cards.id), true), 'sortOrder', 6)
    ),
    'featureOrder', jsonb_build_array('BASIC_PROFILE', 'CONTACT', 'SOCIAL_LINKS', 'WEBSITE', 'EMERGENCY_CONTACT', 'VEHICLE', 'LOST_AND_FOUND')
  ) || profile::jsonb
)::json
WHERE profile IS NOT NULL AND NOT (profile::jsonb ? 'profileFeatures');
