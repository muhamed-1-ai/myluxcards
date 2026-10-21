create table if not exists auth_action_tokens (
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

create index if not exists auth_tokens_user_purpose_idx on auth_action_tokens(user_id, purpose, created_at desc);
create index if not exists auth_tokens_active_expiry_idx on auth_action_tokens(expires_at) where consumed_at is null;
