-- Migration 0016: QR & NFC Source Attribution & Session Deduplication

-- 1. Add visit_id column to card_events
alter table card_events
  add column if not exists visit_id text;

-- 2. Drop card_events_channel_check if present and re-add extended constraint
alter table card_events drop constraint if exists card_events_channel_check;

alter table card_events add constraint card_events_channel_check check (
  channel in ('NFC', 'QR', 'LINK', 'PREVIEW', 'SHARE', 'DIRECT', 'UNKNOWN')
);

-- 3. Add performance indexes for visit deduplication & source queries
create index if not exists card_events_visit_idx on card_events(card_id, visit_id);
create index if not exists card_events_channel_idx on card_events(channel);
