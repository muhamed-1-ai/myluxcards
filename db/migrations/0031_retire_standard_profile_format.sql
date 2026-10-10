-- Migration 0031: Retire legacy standard profile format and convert existing profiles to modern template
-- Preserves all user data, content, and contacts.
-- Backs up legacy presentation settings in profile._legacy_presentation_backup for auditability and rollback.
-- Idempotent: Only updates profiles where profileFormat is NOT 'modern' or is NULL/missing.

UPDATE digital_cards
SET profile = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          profile,
          '{_legacy_presentation_backup}',
          jsonb_build_object(
            'profileFormat', COALESCE(profile->>'profileFormat', 'standard'),
            'profileBackground', profile->>'profileBackground',
            'profileAccent', profile->>'profileAccent',
            'profileText', profile->>'profileText',
            'migratedAt', now()
          ),
          true
        ),
        '{profileFormat}',
        '"modern"',
        true
      ),
      '{profileBackground}',
      to_jsonb(
        CASE
          WHEN profile->>'profileBackground' IS NULL OR profile->>'profileBackground' = '' OR profile->>'profileBackground' IN ('#FFAE00', '#D4AF37', '#C5A059', '#FFFFFF', '#ffffff') THEN '#050B14'
          ELSE profile->>'profileBackground'
        END
      ),
      true
    ),
    '{profileAccent}',
    to_jsonb(
      CASE
        WHEN profile->>'profileAccent' IS NULL OR profile->>'profileAccent' = '' OR profile->>'profileAccent' IN ('#FFAE00', '#D4AF37', '#C5A059') THEN '#0066FF'
        ELSE profile->>'profileAccent'
      END
    ),
    true
  ),
  '{profileText}',
  to_jsonb(COALESCE(NULLIF(profile->>'profileText', ''), '#ffffff')),
  true
)
WHERE (profile->>'profileFormat' IS NULL OR LOWER(profile->>'profileFormat') <> 'modern');
