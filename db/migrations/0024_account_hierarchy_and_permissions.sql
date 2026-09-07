-- Migration 0024: 3-Tier Account Hierarchy, Admin User Ownership, and Granular Feature Permissions

-- 1. Add created_by_admin_id column for ownership tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Add feature_permissions JSONB column for granular permissions
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS feature_permissions JSONB NOT NULL DEFAULT '{
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

-- 3. Add actor_role column to admin_audit_logs for audit logging
ALTER TABLE admin_audit_logs
ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);

-- 4. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_users_created_by_admin ON users(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
