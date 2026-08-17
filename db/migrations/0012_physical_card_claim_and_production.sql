-- Permanent physical-card identity, production QR artifacts, inventory batches,
-- and auditable lifecycle operations. Migrations 0001-0011 remain immutable.
create table card_batches (
  id uuid primary key default gen_random_uuid(), reference text not null unique check(reference ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  product_id uuid references products(id) on delete restrict, quantity integer not null check(quantity between 1 and 5000),
  status text not null default 'GENERATING' check(status in ('GENERATING','READY','FAILED','ARCHIVED')),
  created_by uuid references users(id) on delete set null, created_at timestamptz not null default now(), completed_at timestamptz
);

alter table cards drop constraint if exists cards_status_check;
alter table cards drop constraint if exists cards_check;
alter table cards add constraint cards_status_check check(status in ('UNASSIGNED','ASSIGNED','PROGRAMMED','TESTED','SHIPPED','ACTIVATED','ACTIVE','DISABLED','REPLACED','LOST','RETIRED'));
alter table cards add constraint cards_owner_lifecycle_check check(status in ('UNASSIGNED','PROGRAMMED','TESTED','DISABLED','REPLACED','LOST','RETIRED') or owner_id is not null);
alter table cards add column card_mode text not null default 'STOCK' check(card_mode in ('STOCK','PERSONALIZED'));
alter table cards add column batch_id uuid references card_batches(id) on delete set null;
alter table cards add column product_id uuid references products(id) on delete restrict;
alter table cards add column order_id uuid references orders(id) on delete set null;
alter table cards add column order_item_id uuid references order_items(id) on delete set null;
alter table cards add column qr_svg text;
alter table cards add column qr_png bytea;
alter table cards add column qr_sha256 text check(qr_sha256 is null or char_length(qr_sha256)=64);
alter table cards add column claimed_at timestamptz;
alter table cards drop constraint if exists cards_digital_card_id_key;
create unique index cards_current_digital_card_uidx on cards(digital_card_id) where digital_card_id is not null and status not in ('REPLACED','RETIRED');
create index cards_batch_idx on cards(batch_id,created_at);
create index cards_order_idx on cards(order_id,order_item_id);
create index cards_inventory_status_idx on cards(status,card_mode,created_at desc);

create table card_lifecycle_events (
  id bigint generated always as identity primary key, card_id uuid not null references cards(id) on delete cascade,
  event_type text not null check(event_type in ('GENERATED','QR_GENERATED','EXPORTED','PROGRAMMED','TESTED','ASSIGNED','CLAIMED','ACTIVATED','DISABLED','REPLACED','RETIRED','VIEW')),
  actor_id uuid references users(id) on delete set null, channel text check(channel in ('NFC','QR','LINK','ADMIN')),
  metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'), created_at timestamptz not null default now()
);
create index card_lifecycle_events_card_idx on card_lifecycle_events(card_id,created_at desc);
create index card_lifecycle_events_created_idx on card_lifecycle_events(created_at desc);
