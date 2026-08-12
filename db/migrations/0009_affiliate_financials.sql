create table affiliate_commissions (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  order_id uuid not null references orders(id) on delete restrict, order_item_id uuid references order_items(id) on delete restrict,
  commissionable_minor bigint not null check(commissionable_minor >= 0),
  commission_type text not null check(commission_type in ('PERCENT_BPS','FIXED_ORDER_MINOR','FIXED_PRODUCT_MINOR','PRODUCT_PERCENT_BPS')),
  commission_value integer not null check(commission_value >= 0), commission_minor bigint not null check(commission_minor >= 0),
  currency text not null check(char_length(currency)=3),
  status text not null default 'PENDING' check(status in ('TRACKED','PENDING','APPROVED','REJECTED','REVERSED','PAYOUT_REQUESTED','RESERVED_FOR_PAYOUT','PAID')),
  referral_source text, campaign text, risk text not null default 'LOW' check(risk in ('LOW','MEDIUM','HIGH')),
  eligible_at timestamptz, approved_at timestamptz, payout_at timestamptz, rejection_reason text, reversal_reason text,
  calculation_snapshot jsonb not null default '{}' check(jsonb_typeof(calculation_snapshot)='object'),
  discount_minor bigint not null default 0 check(discount_minor >= 0), excluded_tax_minor bigint not null default 0 check(excluded_tax_minor >= 0),
  excluded_shipping_minor bigint not null default 0 check(excluded_shipping_minor >= 0), calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(order_id,order_item_id)
);
create unique index affiliate_one_order_commission_uidx on affiliate_commissions(order_id) where order_item_id is null;
create index affiliate_commissions_status_idx on affiliate_commissions(affiliate_id,status,created_at desc);
create index affiliate_commissions_eligible_idx on affiliate_commissions(status,eligible_at) where status='PENDING';
create index affiliate_commissions_order_idx on affiliate_commissions(order_id);

create table affiliate_payouts (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  amount_minor bigint not null check(amount_minor > 0), currency text not null check(char_length(currency)=3),
  status text not null default 'REQUESTED' check(status in ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','PAID','REJECTED','CANCELLED')),
  payout_method text not null, payout_details_snapshot_ciphertext text, transaction_reference text,
  rejection_reason text, internal_note text, requested_at timestamptz not null default now(), reviewed_at timestamptz,
  paid_at timestamptz, reviewed_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index affiliate_payouts_status_idx on affiliate_payouts(status,requested_at desc);
create index affiliate_payouts_affiliate_idx on affiliate_payouts(affiliate_id,requested_at desc);
create unique index affiliate_payouts_transaction_uidx on affiliate_payouts(transaction_reference) where transaction_reference is not null;

create table affiliate_payout_items (
  payout_id uuid not null references affiliate_payouts(id) on delete restrict,
  commission_id uuid not null unique references affiliate_commissions(id) on delete restrict,
  amount_minor bigint not null check(amount_minor > 0), primary key(payout_id,commission_id)
);

create table affiliate_commission_adjustments (
  id uuid primary key default gen_random_uuid(), commission_id uuid not null references affiliate_commissions(id) on delete restrict,
  source_event_id uuid references payment_webhook_events(id) on delete restrict,
  adjustment_type text not null check(adjustment_type in ('CREDIT','DEBIT','PARTIAL_REFUND','RECOVERY')),
  amount_minor bigint not null check(amount_minor > 0), reason text not null,
  created_by uuid references users(id) on delete restrict, created_at timestamptz not null default now()
);
create index affiliate_adjustments_commission_idx on affiliate_commission_adjustments(commission_id,created_at desc);
create index affiliate_adjustments_creator_idx on affiliate_commission_adjustments(created_by,created_at desc);
create unique index affiliate_adjustment_source_uidx on affiliate_commission_adjustments(commission_id,source_event_id) where source_event_id is not null;

create table affiliate_fraud_flags (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  order_id uuid references orders(id) on delete set null, click_id bigint references affiliate_clicks(id) on delete set null,
  risk text not null check(risk in ('LOW','MEDIUM','HIGH')), reason_code text not null,
  details jsonb not null default '{}' check(jsonb_typeof(details)='object'), resolved_at timestamptz,
  resolved_by uuid references users(id) on delete set null, decision_reason text, created_at timestamptz not null default now()
);
create index affiliate_fraud_unresolved_idx on affiliate_fraud_flags(risk,created_at desc) where resolved_at is null;
create index affiliate_fraud_affiliate_idx on affiliate_fraud_flags(affiliate_id,created_at desc);
create index affiliate_fraud_order_idx on affiliate_fraud_flags(order_id);

create table affiliate_business_leads (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  company_name text not null, normalized_company text not null, contact_person text not null, business_email text not null,
  email_hash text not null, phone text, phone_hash text, estimated_quantity integer not null check(estimated_quantity > 0),
  product_id uuid references products(id) on delete set null, expected_purchase_date date, notes text,
  consent_confirmed_at timestamptz not null, lead_source text,
  status text not null default 'REGISTERED' check(status in ('REGISTERED','UNDER_REVIEW','QUALIFIED','CONTACTED','QUOTATION_SENT','NEGOTIATION','WON','LOST','EXPIRED','REJECTED')),
  protection_expires_at timestamptz, reviewed_by uuid references users(id) on delete set null, decision_reason text,
  linked_order_id uuid unique references orders(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index affiliate_leads_affiliate_idx on affiliate_business_leads(affiliate_id,status,created_at desc);
create index affiliate_leads_duplicate_idx on affiliate_business_leads(normalized_company,email_hash,phone_hash);

create table affiliate_rewards (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  reward_definition_id uuid not null references affiliate_reward_definitions(id) on delete restrict,
  status text not null default 'ELIGIBLE' check(status in ('ELIGIBLE','APPROVED','REJECTED','FULFILLED')),
  decision_reason text, reviewed_by uuid references users(id) on delete set null, fulfilled_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(affiliate_id,reward_definition_id)
);
create index affiliate_rewards_status_idx on affiliate_rewards(affiliate_id,status,created_at desc);

create table affiliate_store_credits (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  order_id uuid references orders(id) on delete restrict, amount_minor bigint not null check(amount_minor > 0),
  currency text not null check(char_length(currency)=3),
  status text not null check(status in ('PENDING','AVAILABLE','USED','EXPIRED','REVERSED')),
  expires_at timestamptz, used_order_id uuid references orders(id) on delete restrict, reversal_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(affiliate_id,order_id)
);
create index affiliate_store_credits_balance_idx on affiliate_store_credits(affiliate_id,status,created_at desc);
create index affiliate_store_credits_expiry_idx on affiliate_store_credits(expires_at) where status='AVAILABLE';

alter table orders add constraint orders_affiliate_id_fkey foreign key(affiliate_id) references affiliate_profiles(id) on delete set null;
alter table orders add constraint orders_affiliate_campaign_id_fkey foreign key(affiliate_campaign_id) references affiliate_campaigns(id) on delete set null;
alter table orders add constraint orders_affiliate_lead_id_fkey foreign key(affiliate_lead_id) references affiliate_business_leads(id) on delete set null;
create index orders_affiliate_idx on orders(affiliate_id,created_at desc);
