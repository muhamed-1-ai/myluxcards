create table auth_action_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check(purpose in ('EMAIL_VERIFY','PASSWORD_RESET')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count integer not null default 0 check(attempt_count >= 0),
  created_at timestamptz not null default now(),
  check(expires_at > created_at)
);
create index auth_tokens_user_purpose_idx on auth_action_tokens(user_id,purpose,created_at desc);
create index auth_tokens_active_expiry_idx on auth_action_tokens(expires_at) where consumed_at is null;

create table auth_rate_limits (
  action text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check(request_count > 0),
  blocked_until timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(action,subject_hash,window_started_at),
  check(expires_at > window_started_at)
);
create index auth_rate_limits_expiry_idx on auth_rate_limits(expires_at);
create index auth_rate_limits_blocked_idx on auth_rate_limits(blocked_until) where blocked_until is not null;
