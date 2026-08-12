create table affiliate_tiers (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  min_completed_orders integer not null default 0 check(min_completed_orders >= 0),
  min_approved_revenue_minor bigint not null default 0 check(min_approved_revenue_minor >= 0),
  commission_type text not null default 'PERCENT_BPS' check(commission_type in ('PERCENT_BPS','FIXED_ORDER_MINOR','FIXED_PRODUCT_MINOR','PRODUCT_PERCENT_BPS')),
  commission_value integer not null default 0 check(commission_value >= 0), benefits text not null default '',
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index affiliate_tiers_active_idx on affiliate_tiers(active,min_completed_orders);

create table affiliate_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references users(id) on delete restrict,
  status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','SUSPENDED','DISABLED')),
  affiliate_code text unique, coupon_code text unique, tier_id uuid references affiliate_tiers(id) on delete restrict,
  commission_type text check(commission_type in ('PERCENT_BPS','FIXED_ORDER_MINOR','FIXED_PRODUCT_MINOR','PRODUCT_PERCENT_BPS')),
  commission_value integer check(commission_value >= 0),
  partner_type text not null default 'CREATOR' check(partner_type in ('CUSTOMER_REFERRER','CREATOR','BUSINESS_PARTNER','CAMPUS_AMBASSADOR')),
  display_name text, temporary_commission_type text check(temporary_commission_type in ('PERCENT_BPS','FIXED_ORDER_MINOR','FIXED_PRODUCT_MINOR','PRODUCT_PERCENT_BPS')),
  temporary_commission_value integer check(temporary_commission_value >= 0), temporary_commission_expires_at timestamptz,
  approved_at timestamptz, approved_by uuid references users(id) on delete set null, suspended_at timestamptz,
  rejection_reason text, internal_notes text, payout_method text, payout_details_ciphertext text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(status <> 'APPROVED' or (affiliate_code is not null and approved_at is not null))
);
create unique index affiliate_code_upper_idx on affiliate_profiles(upper(affiliate_code)) where affiliate_code is not null;
create unique index affiliate_coupon_upper_idx on affiliate_profiles(upper(coupon_code)) where coupon_code is not null;
create index affiliate_profiles_status_idx on affiliate_profiles(status,created_at desc);
create index affiliate_profiles_partner_idx on affiliate_profiles(partner_type,status);

create table affiliate_applications (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  user_id uuid not null references users(id) on delete restrict, full_name text not null, email text not null, phone text,
  country text not null, region text, website_url text, instagram_username text, youtube_url text, other_social_url text,
  business_name text, promotion_method text not null, estimated_audience_size integer check(estimated_audience_size >= 0),
  reason text not null, terms_accepted_at timestamptz not null,
  partner_type text not null default 'CREATOR' check(partner_type in ('CUSTOMER_REFERRER','CREATOR','BUSINESS_PARTNER','CAMPUS_AMBASSADOR')),
  status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','SUSPENDED','DISABLED')),
  decision_reason text, decided_at timestamptz, decided_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index affiliate_active_application_uidx on affiliate_applications(user_id) where status in ('PENDING','APPROVED','SUSPENDED');
create index affiliate_applications_status_idx on affiliate_applications(status,created_at desc);
create index affiliate_applications_affiliate_idx on affiliate_applications(affiliate_id,created_at desc);

create table affiliate_settings (
  id boolean primary key default true check(id),
  default_commission_type text not null default 'PERCENT_BPS' check(default_commission_type in ('PERCENT_BPS','FIXED_ORDER_MINOR','FIXED_PRODUCT_MINOR','PRODUCT_PERCENT_BPS')),
  default_commission_value integer not null default 1000 check(default_commission_value >= 0),
  attribution_window_days integer not null default 30 check(attribution_window_days between 1 and 365),
  minimum_payout_minor bigint not null default 500000 check(minimum_payout_minor >= 0),
  holding_period_days integer not null default 7 check(holding_period_days between 0 and 365),
  shipping_commissionable boolean not null default false, tax_commissionable boolean not null default false,
  discounts_reduce_basis boolean not null default true, cancelled_commissionable boolean not null default false,
  refunded_reverse boolean not null default true, affiliate_coupons_enabled boolean not null default true,
  self_referrals_allowed boolean not null default false, automatic_tier_upgrades boolean not null default false,
  attribution_policy text not null default 'LAST_VALID_CLICK' check(attribution_policy in ('LAST_VALID_CLICK','FIRST_VALID_CLICK')),
  attribution_priority text not null default 'COUPON_THEN_COOKIE' check(attribution_priority in ('COUPON_THEN_COOKIE','COOKIE_THEN_COUPON')),
  payout_schedule text not null default 'ON_REQUEST', program_terms_url text not null default '/affiliate/terms', terms_content text not null default '',
  program_enabled boolean not null default true, public_applications_enabled boolean not null default true,
  allowed_partner_types text[] not null default array['CUSTOMER_REFERRER','CREATOR','BUSINESS_PARTNER','CAMPUS_AMBASSADOR'],
  partner_type_rates jsonb not null default '{"CUSTOMER_REFERRER":{"type":"PERCENT_BPS","value":500},"CREATOR":{"type":"PERCENT_BPS","value":1000},"BUSINESS_PARTNER":{"type":"PERCENT_BPS","value":1000},"CAMPUS_AMBASSADOR":{"type":"PERCENT_BPS","value":1000}}',
  customer_referral_discount_bps integer not null default 500 check(customer_referral_discount_bps between 0 and 10000),
  customer_referral_cash_enabled boolean not null default false, business_lead_protection_days integer not null default 90 check(business_lead_protection_days between 1 and 365),
  coupon_stacking_allowed boolean not null default false, tap_to_refer_enabled boolean not null default false,
  allowed_payout_methods text[] not null default array['BANK_TRANSFER','UPI','PAYPAL','OTHER'], support_email text,
  store_credit_expiry_days integer check(store_credit_expiry_days between 1 and 3650),
  updated_by uuid references users(id) on delete set null, updated_at timestamptz not null default now(),
  check(jsonb_typeof(partner_type_rates)='object')
);

create table affiliate_product_rates (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products(id) on delete restrict,
  affiliate_id uuid references affiliate_profiles(id) on delete restrict, tier_id uuid references affiliate_tiers(id) on delete restrict,
  commission_type text not null check(commission_type in ('PERCENT_BPS','FIXED_ORDER_MINOR','FIXED_PRODUCT_MINOR','PRODUCT_PERCENT_BPS')),
  commission_value integer not null check(commission_value >= 0), active boolean not null default true,
  created_at timestamptz not null default now(), check(num_nonnulls(affiliate_id,tier_id) <= 1)
);
create unique index affiliate_product_rate_scope_uidx on affiliate_product_rates(product_id,coalesce(affiliate_id,'00000000-0000-0000-0000-000000000000'),coalesce(tier_id,'00000000-0000-0000-0000-000000000000'));
create index affiliate_product_rates_active_idx on affiliate_product_rates(product_id,active);

create table affiliate_campaigns (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  name text not null, source text, destination_path text not null check(destination_path like '/%'), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(affiliate_id,name)
);
create index affiliate_campaigns_created_idx on affiliate_campaigns(affiliate_id,created_at desc);
create index affiliate_campaigns_active_idx on affiliate_campaigns(affiliate_id,active);

create table affiliate_visitors (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  visitor_hash text not null, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  unique(affiliate_id,visitor_hash)
);
create index affiliate_visitors_last_seen_idx on affiliate_visitors(last_seen_at);

create table affiliate_clicks (
  id bigint generated always as identity primary key, affiliate_id uuid not null references affiliate_profiles(id) on delete restrict,
  campaign_id uuid references affiliate_campaigns(id) on delete set null, visitor_hash text not null,
  is_unique boolean not null default false, destination_path text not null, campaign text, source text, referrer_host text,
  created_at timestamptz not null default now()
);
create index affiliate_clicks_affiliate_idx on affiliate_clicks(affiliate_id,created_at desc);
create index affiliate_clicks_campaign_idx on affiliate_clicks(campaign_id,created_at desc);
create index affiliate_clicks_visitor_idx on affiliate_clicks(visitor_hash,created_at desc);

create table affiliate_materials (
  id uuid primary key default gen_random_uuid(), title text not null, material_type text not null,
  description text, storage_url text, promotional_text text, active boolean not null default true,
  created_by uuid references users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index affiliate_materials_active_idx on affiliate_materials(active,created_at desc);

create table affiliate_email_events (
  event_key text primary key, affiliate_id uuid references affiliate_profiles(id) on delete set null,
  event_type text not null, recipient text not null, sent_at timestamptz, error text, created_at timestamptz not null default now()
);
create index affiliate_email_events_affiliate_idx on affiliate_email_events(affiliate_id,created_at desc);
create index affiliate_email_events_type_idx on affiliate_email_events(event_type,created_at desc);

create table affiliate_reward_definitions (
  id uuid primary key default gen_random_uuid(), name text not null unique, required_delivered_orders integer not null check(required_delivered_orders > 0),
  description text not null, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index affiliate_reward_defs_active_idx on affiliate_reward_definitions(active,required_delivered_orders);
