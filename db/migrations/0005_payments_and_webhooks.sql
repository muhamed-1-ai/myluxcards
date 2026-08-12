create table payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete restrict,
  provider text not null, provider_order_id text, provider_payment_id text, provider_refund_id text,
  idempotency_key text not null, amount_minor integer not null check(amount_minor >= 0),
  currency text not null check(char_length(currency)=3),
  status text not null default 'PENDING' check(status in ('PENDING','SUCCEEDED','FAILED','PARTIALLY_REFUNDED','REFUNDED')),
  failure_reason text, refunded_minor integer not null default 0 check(refunded_minor >= 0 and refunded_minor <= amount_minor),
  provider_created_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider,idempotency_key)
);
create unique index payments_provider_order_uidx on payments(provider,provider_order_id) where provider_order_id is not null;
create unique index payments_provider_payment_uidx on payments(provider,provider_payment_id) where provider_payment_id is not null;
create unique index payments_provider_refund_uidx on payments(provider,provider_refund_id) where provider_refund_id is not null;
create index payments_order_idx on payments(order_id);
create index payments_status_created_idx on payments(status,created_at desc);

create table payment_webhook_events (
  id uuid primary key default gen_random_uuid(), payment_id uuid references payments(id) on delete restrict,
  provider text not null, provider_event_id text not null, provider_order_id text, provider_payment_id text, provider_refund_id text,
  payload_hash text not null, signature_verified boolean not null default false,
  status text not null default 'RECEIVED' check(status in ('RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED')),
  attempt_count integer not null default 0 check(attempt_count >= 0), last_error text,
  received_at timestamptz not null default now(), processed_at timestamptz, updated_at timestamptz not null default now(),
  unique(provider,provider_event_id),
  check(status <> 'PROCESSED' or processed_at is not null)
);
create index webhook_payment_idx on payment_webhook_events(payment_id);
create index webhook_provider_payment_idx on payment_webhook_events(provider,provider_payment_id);
create index webhook_status_received_idx on payment_webhook_events(status,received_at);
