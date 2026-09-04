-- Migration 0020: Real-time Notification Center & WhatsApp CRM Enhancements

-- 1. Create Notifications Table
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_is_read on notifications(user_id, is_read);
create index if not exists idx_notifications_user_created_at on notifications(user_id, created_at desc);

-- 2. Create Notification Preferences Table
create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  new_whatsapp_messages boolean not null default true,
  new_leads boolean not null default true,
  follow_up_reminders boolean not null default true,
  broadcast_results boolean not null default true,
  connection_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create Quick Messages Table
create table if not exists quick_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  content text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quick_messages_user_sort on quick_messages(user_id, sort_order asc);

-- 4. Add Lead fields if not existing
alter table card_leads add column if not exists has_new_reply boolean not null default false;
alter table card_leads add column if not exists last_inbound_whatsapp_at timestamptz;
alter table card_leads add column if not exists whatsapp_opt_in_source text;

-- 5. Add WhatsApp Connection fields if not existing
alter table whatsapp_connections add column if not exists connection_type text default 'EMBEDDED';
alter table whatsapp_connections add column if not exists token_expires_at timestamptz;
alter table whatsapp_connections add column if not exists meta_app_id text;
