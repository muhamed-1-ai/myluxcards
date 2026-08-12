create table admin_audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references users(id) on delete set null,
  actor_role app_role not null, action text not null, entity_type text not null, entity_id text,
  before_summary jsonb, after_summary jsonb, ip_address text, user_agent text,
  created_at timestamptz not null default now()
);
create index audit_created_idx on admin_audit_logs(created_at desc);
create index audit_actor_idx on admin_audit_logs(actor_id,created_at desc);
create index audit_entity_idx on admin_audit_logs(entity_type,entity_id);
create index audit_action_idx on admin_audit_logs(action,created_at desc);

create table admin_notifications (
  id uuid primary key default gen_random_uuid(), event_key text not null unique, type text not null,
  title text not null, message text not null, order_id uuid references orders(id) on delete set null,
  email_recipient text, emailed_at timestamptz, email_error text, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_created_idx on admin_notifications(created_at desc);
create index notifications_unread_idx on admin_notifications(created_at desc) where read_at is null;

create table admin_invites (
  id uuid primary key default gen_random_uuid(), email text not null, normalized_email text not null,
  role app_role not null default 'ADMIN' check(role='ADMIN'), token_hash text not null unique,
  invited_by uuid not null references users(id) on delete restrict, expires_at timestamptz not null,
  accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(),
  check(normalized_email=lower(btrim(email))), check(expires_at > created_at)
);
create index invites_email_idx on admin_invites(normalized_email,created_at desc);
create unique index invites_active_email_uidx on admin_invites(normalized_email) where accepted_at is null and revoked_at is null;

create table website_settings (
  id boolean primary key default true check(id), business_name text not null default 'MyLuxCards',
  support_email text, support_phone text, order_notification_email text, currency text not null default 'INR' check(char_length(currency)=3),
  low_stock_threshold integer not null default 5 check(low_stock_threshold >= 0), shipping jsonb not null default '{}',
  tax jsonb not null default '{}', invoice jsonb not null default '{}', social_links jsonb not null default '{}',
  maintenance_message text, terms_url text, privacy_url text, updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(), reference text not null unique, customer_name text not null,
  customer_email text not null, topic text not null, contact_time text, message text not null,
  status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED')),
  assigned_to uuid references users(id) on delete set null, last_reply_at timestamptz, fingerprint text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_status_created_idx on support_tickets(status,created_at desc);
create index support_fingerprint_idx on support_tickets(fingerprint,created_at desc);
create index support_email_idx on support_tickets(lower(customer_email),created_at desc);

create table support_ticket_replies (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references support_tickets(id) on delete restrict,
  author_id uuid references users(id) on delete set null, author_role app_role not null,
  message text not null, emailed_at timestamptz, created_at timestamptz not null default now()
);
create index support_replies_ticket_idx on support_ticket_replies(ticket_id,created_at);
create index support_replies_author_idx on support_ticket_replies(author_id,created_at desc);
