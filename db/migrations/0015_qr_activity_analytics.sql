-- Migration 0015: Privacy-Safe QR Scan History & Activity Analytics

-- 1. Alter card_events table to support structured asset & location columns
alter table card_events
  add column if not exists asset_type text check (asset_type in ('profile', 'vehicle', 'lost_found_item')),
  add column if not exists vehicle_id uuid references card_vehicles(id) on delete set null,
  add column if not exists lost_item_id uuid references card_lost_items(id) on delete set null,
  add column if not exists context text,
  add column if not exists location_latitude numeric(10, 7),
  add column if not exists location_longitude numeric(10, 7),
  add column if not exists location_label text,
  add column if not exists metadata jsonb default '{}'::jsonb;

-- 2. Drop old event_type check constraint if present and re-add extended constraint
alter table card_events drop constraint if exists card_events_event_type_check;

alter table card_events add constraint card_events_event_type_check check (
  event_type in (
    'PROFILE_OPENED',
    'VEHICLE_MODE_OPENED',
    'VEHICLE_SELECTED',
    'LOST_FOUND_MODE_OPENED',
    'LOST_FOUND_ITEM_SELECTED',
    'PHONE_NUMBER_TAPPED',
    'LOCATION_SHARED',
    'VIEW',
    'CONTACT_SAVE',
    'LINK_CLICK',
    'SHARE',
    'LEAD'
  )
);

-- 3. Add performance indexes for customer activity queries
create index if not exists card_events_card_created_idx on card_events(card_id, created_at desc);
create index if not exists card_events_vehicle_idx on card_events(vehicle_id) where vehicle_id is not null;
create index if not exists card_events_lost_item_idx on card_events(lost_item_id) where lost_item_id is not null;
create index if not exists card_events_event_type_idx on card_events(event_type);
