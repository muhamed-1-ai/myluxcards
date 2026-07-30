-- Persistent digital cards, activation, consent-based lead exchange, and privacy-conscious analytics.
create table if not exists public.digital_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  profile jsonb not null default '{}',
  design jsonb not null default '{}',
  active boolean not null default false,
  activation_code_hash text,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists digital_cards_owner_idx on public.digital_cards(owner_id, updated_at desc);

create table if not exists public.card_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.digital_cards(id) on delete cascade,
  event_type text not null check(event_type in ('VIEW','CONTACT_SAVE','LINK_CLICK','SHARE','LEAD')),
  channel text check(channel in ('NFC','QR','LINK','PREVIEW')),
  link_type text,
  visitor_hash text,
  created_at timestamptz not null default now()
);
create index if not exists card_events_card_created_idx on public.card_events(card_id,created_at desc);
create index if not exists card_events_card_type_idx on public.card_events(card_id,event_type);

create table if not exists public.card_leads (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.digital_cards(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  message text,
  consent_at timestamptz not null,
  status text not null default 'NEW' check(status in ('NEW','CONTACTED','ARCHIVED')),
  created_at timestamptz not null default now()
);
create index if not exists card_leads_card_created_idx on public.card_leads(card_id,created_at desc);

alter table public.digital_cards enable row level security;
alter table public.card_events enable row level security;
alter table public.card_leads enable row level security;

drop policy if exists digital_cards_owner_read on public.digital_cards;
create policy digital_cards_owner_read on public.digital_cards for select using(owner_id=auth.uid());
drop policy if exists digital_cards_owner_insert on public.digital_cards;
create policy digital_cards_owner_insert on public.digital_cards for insert with check(owner_id=auth.uid());
drop policy if exists digital_cards_owner_update on public.digital_cards;
create policy digital_cards_owner_update on public.digital_cards for update using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists digital_cards_owner_delete on public.digital_cards;
create policy digital_cards_owner_delete on public.digital_cards for delete using(owner_id=auth.uid());
drop policy if exists card_events_owner_read on public.card_events;
create policy card_events_owner_read on public.card_events for select using(
  exists(select 1 from public.digital_cards c where c.id=card_id and c.owner_id=auth.uid())
);
drop policy if exists card_leads_owner_read on public.card_leads;
create policy card_leads_owner_read on public.card_leads for select using(
  exists(select 1 from public.digital_cards c where c.id=card_id and c.owner_id=auth.uid())
);

-- Public writes are intentionally not granted. Protected server routes validate and write with service role.
