-- 0056_remove_admin_mfa.sql
-- Forward migration to safely remove the administrator MFA table and stored credentials.
-- Preserves migration 0054 history.
-- Does not modify users, passwords, roles, cards, orders or any other application data.

DROP INDEX IF EXISTS admin_mfa_user_idx;
DROP TABLE IF EXISTS admin_mfa;

