-- Migration 0049: Release deleted user login email and preserve historical original_email
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS original_email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_original_email ON users(original_email) WHERE original_email IS NOT NULL;

-- Idempotent repair for accounts previously deleted that still reserve their login email
UPDATE users
SET original_email = email,
    email = 'deleted+' || id || '@deleted.zappit.local',
    updated_at = NOW()
WHERE status = 'DELETED'
  AND email NOT LIKE 'deleted+%';
