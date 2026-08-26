-- Migration 0013: Multi-Vehicle & Multi-Item Lost & Found Collections

create table if not exists card_vehicles (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references digital_cards(id) on delete cascade,
  display_name text not null,
  make text not null default '',
  model text not null default '',
  color text not null default '',
  license_plate text not null default '',
  contact_phone text not null default '',
  use_default_contact boolean not null default true,
  emergency_name text not null default '',
  emergency_relationship text not null default '',
  emergency_phone text not null default '',
  use_default_emergency boolean not null default true,
  owner_note text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists card_vehicles_card_id_idx on card_vehicles(card_id);

create table if not exists card_lost_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references digital_cards(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  description text not null default '',
  color text not null default '',
  contact_phone text not null default '',
  use_default_contact boolean not null default true,
  reward_enabled boolean not null default false,
  reward_text text not null default '',
  return_instructions text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists card_lost_items_card_id_idx on card_lost_items(card_id);
