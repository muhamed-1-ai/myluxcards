create table digital_cards (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete restrict,
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  profile jsonb not null default '{}' check(jsonb_typeof(profile)='object'),
  design jsonb not null default '{}' check(jsonb_typeof(design)='object'), active boolean not null default false,
  activated_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), check(expires_at is null or activated_at is null or expires_at > activated_at)
);
create index digital_cards_owner_idx on digital_cards(owner_id,updated_at desc);
create index digital_cards_active_slug_idx on digital_cards(slug) where active;

create table cards (
  id uuid primary key default gen_random_uuid(), owner_id uuid references users(id) on delete restrict,
  digital_card_id uuid unique references digital_cards(id) on delete set null,
  public_token_hash text not null unique check(char_length(public_token_hash)=64), inventory_reference text unique,
  status text not null default 'UNASSIGNED' check(status in ('UNASSIGNED','ASSIGNED','PROGRAMMED','TESTED','SHIPPED','ACTIVATED','ACTIVE','DISABLED','REPLACED','LOST')),
  replacement_card_id uuid references cards(id) on delete set null,
  assigned_at timestamptz, programmed_at timestamptz, tested_at timestamptz, shipped_at timestamptz, activated_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(replacement_card_id is null or replacement_card_id <> id),
  check(status='UNASSIGNED' or owner_id is not null)
);
create index cards_owner_idx on cards(owner_id,created_at desc);
create index cards_status_idx on cards(status,updated_at desc);
create index cards_replacement_idx on cards(replacement_card_id);

create table card_activations (
  id uuid primary key default gen_random_uuid(), card_id uuid not null references cards(id) on delete cascade,
  token_hash text not null unique check(char_length(token_hash)=64), issued_by uuid references users(id) on delete set null,
  claimed_by uuid references users(id) on delete set null, expires_at timestamptz not null,
  used_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(),
  check(expires_at > created_at), check(not (used_at is not null and revoked_at is not null)),
  check(used_at is null or claimed_by is not null)
);
create index card_activations_card_idx on card_activations(card_id,created_at desc);
create unique index card_activations_active_uidx on card_activations(card_id) where used_at is null and revoked_at is null;
create index card_activations_expiry_idx on card_activations(expires_at);

create table card_events (
  id bigint generated always as identity primary key, card_id uuid not null references digital_cards(id) on delete cascade,
  event_type text not null check(event_type in ('VIEW','CONTACT_SAVE','LINK_CLICK','SHARE','LEAD')),
  channel text check(channel in ('NFC','QR','LINK','PREVIEW')), link_type text, visitor_hash text,
  created_at timestamptz not null default now()
);
create index card_events_card_created_idx on card_events(card_id,created_at desc);
create index card_events_card_type_idx on card_events(card_id,event_type);
create index card_events_created_idx on card_events(created_at);

create table card_leads (
  id uuid primary key default gen_random_uuid(), card_id uuid not null references digital_cards(id) on delete cascade,
  name text not null, email text, phone text, company text, message text, consent_at timestamptz not null,
  status text not null default 'NEW' check(status in ('NEW','CONTACTED','ARCHIVED')),
  created_at timestamptz not null default now()
);
create index card_leads_card_created_idx on card_leads(card_id,created_at desc);
create index card_leads_status_idx on card_leads(card_id,status,created_at desc);
