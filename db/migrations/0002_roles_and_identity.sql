create type app_role as enum ('CUSTOMER','ADMIN','SUPER_ADMIN');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  normalized_email text not null,
  name text not null,
  password_hash text,
  email_verified_at timestamptz,
  image text,
  role app_role not null default 'CUSTOMER',
  status text not null default 'ACTIVE' check(status in ('ACTIVE','DISABLED')),
  disabled boolean not null default false,
  must_change_password boolean not null default false,
  session_version integer not null default 1 check(session_version > 0),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_normalized_email_format check(normalized_email = lower(btrim(email))),
  constraint users_normalized_email_key unique(normalized_email),
  constraint users_name_length check(char_length(name) between 2 and 100),
  constraint users_email_length check(char_length(normalized_email) between 3 and 320),
  constraint users_status_consistent check(disabled = (status = 'DISABLED'))
);
create index users_role_created_idx on users(role,created_at desc);
create index users_status_created_idx on users(status,created_at desc);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  provider_account_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_account_id),
  unique(user_id,provider)
);
create index accounts_user_idx on accounts(user_id);

create table profiles (
  id uuid primary key references users(id) on delete cascade,
  phone text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
