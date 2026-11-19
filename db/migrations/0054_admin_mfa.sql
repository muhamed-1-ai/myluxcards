-- 0054_admin_mfa.sql
-- Authenticator-based Multi-Factor Authentication (MFA) and Recovery Codes for Administrators

create table if not exists admin_mfa (
  user_id uuid primary key references users(id) on delete cascade,
  secret text not null,
  enrolled_at timestamptz not null default now(),
  last_used_at timestamptz,
  recovery_codes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_mfa_user_idx on admin_mfa(user_id);
