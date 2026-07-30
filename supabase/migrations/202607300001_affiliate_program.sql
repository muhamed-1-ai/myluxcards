-- MyLuxCards affiliate program. Apply after 202607250001_super_admin.sql.
-- Monetary values use integer minor units, matching the existing commerce schema.
create extension if not exists pgcrypto;

do $$ begin create type public.affiliate_status as enum ('PENDING','APPROVED','REJECTED','SUSPENDED','DISABLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.affiliate_commission_status as enum ('TRACKED','PENDING','APPROVED','REJECTED','REVERSED','PAYOUT_REQUESTED','PAID'); exception when duplicate_object then null; end $$;
do $$ begin create type public.affiliate_payout_status as enum ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','PAID','REJECTED','CANCELLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.affiliate_risk as enum ('LOW','MEDIUM','HIGH'); exception when duplicate_object then null; end $$;
do $$ begin create type public.affiliate_rate_type as enum ('PERCENT_BPS','FIXED_ORDER_MINOR','FIXED_PRODUCT_MINOR','PRODUCT_PERCENT_BPS'); exception when duplicate_object then null; end $$;

create table if not exists public.affiliate_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_completed_orders integer not null default 0 check(min_completed_orders >= 0),
  min_approved_revenue_minor bigint not null default 0 check(min_approved_revenue_minor >= 0),
  commission_type public.affiliate_rate_type not null default 'PERCENT_BPS',
  commission_value integer not null default 0 check(commission_value >= 0),
  benefits text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.affiliate_tiers(name,min_completed_orders,min_approved_revenue_minor,commission_type,commission_value,benefits)
values
  ('STARTER',0,0,'PERCENT_BPS',1000,'Standard affiliate access'),
  ('SILVER',10,5000000,'PERCENT_BPS',1200,'Higher commission eligibility'),
  ('GOLD',30,15000000,'PERCENT_BPS',1500,'Priority campaign support'),
  ('PLATINUM',100,50000000,'PERCENT_BPS',1800,'Strategic partner benefits')
on conflict(name) do nothing;

create table if not exists public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.affiliate_status not null default 'PENDING',
  affiliate_code text unique,
  coupon_code text unique,
  tier_id uuid references public.affiliate_tiers(id) on delete set null,
  commission_type public.affiliate_rate_type,
  commission_value integer check(commission_value is null or commission_value >= 0),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  internal_notes text,
  payout_method text,
  payout_details_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((status <> 'APPROVED') or (affiliate_code is not null and approved_at is not null))
);
create unique index if not exists affiliate_code_upper_idx on public.affiliate_profiles(upper(affiliate_code)) where affiliate_code is not null;
create unique index if not exists affiliate_coupon_upper_idx on public.affiliate_profiles(upper(coupon_code)) where coupon_code is not null;
create index if not exists affiliate_profiles_status_idx on public.affiliate_profiles(status,created_at desc);

create table if not exists public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  country text not null,
  region text,
  website_url text,
  instagram_username text,
  youtube_url text,
  business_name text,
  promotion_method text not null,
  estimated_audience_size integer check(estimated_audience_size is null or estimated_audience_size >= 0),
  reason text not null,
  terms_accepted_at timestamptz not null,
  status public.affiliate_status not null default 'PENDING',
  decision_reason text,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists affiliate_one_active_application_idx on public.affiliate_applications(user_id)
  where status in ('PENDING','APPROVED','SUSPENDED');
create index if not exists affiliate_applications_status_idx on public.affiliate_applications(status,created_at desc);

create table if not exists public.affiliate_settings (
  id boolean primary key default true check(id),
  default_commission_type public.affiliate_rate_type not null default 'PERCENT_BPS',
  default_commission_value integer not null default 1000 check(default_commission_value >= 0),
  attribution_window_days integer not null default 30 check(attribution_window_days between 1 and 365),
  minimum_payout_minor bigint not null default 500000 check(minimum_payout_minor >= 0),
  holding_period_days integer not null default 14 check(holding_period_days between 0 and 365),
  shipping_commissionable boolean not null default false,
  tax_commissionable boolean not null default false,
  discounts_reduce_basis boolean not null default true,
  cancelled_commissionable boolean not null default false,
  refunded_reverse boolean not null default true,
  affiliate_coupons_enabled boolean not null default true,
  self_referrals_allowed boolean not null default false,
  automatic_tier_upgrades boolean not null default false,
  attribution_policy text not null default 'LAST_VALID_CLICK' check(attribution_policy in ('LAST_VALID_CLICK','FIRST_VALID_CLICK')),
  attribution_priority text not null default 'COUPON_THEN_COOKIE' check(attribution_priority in ('COUPON_THEN_COOKIE','COOKIE_THEN_COUPON')),
  payout_schedule text not null default 'ON_REQUEST',
  program_terms_url text not null default '/affiliate/terms',
  terms_content text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.affiliate_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.affiliate_product_rates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  affiliate_id uuid references public.affiliate_profiles(id) on delete cascade,
  tier_id uuid references public.affiliate_tiers(id) on delete cascade,
  commission_type public.affiliate_rate_type not null,
  commission_value integer not null check(commission_value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check(num_nonnulls(affiliate_id,tier_id) <= 1)
);
create unique index if not exists affiliate_product_rate_scope_idx on public.affiliate_product_rates(product_id,coalesce(affiliate_id,'00000000-0000-0000-0000-000000000000'),coalesce(tier_id,'00000000-0000-0000-0000-000000000000'));

create table if not exists public.affiliate_campaigns (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  name text not null,
  source text,
  destination_path text not null check(destination_path like '/%'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(affiliate_id,name)
);
create index if not exists affiliate_campaigns_affiliate_idx on public.affiliate_campaigns(affiliate_id,created_at desc);

create table if not exists public.affiliate_visitors (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  visitor_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(affiliate_id,visitor_hash)
);

create table if not exists public.affiliate_clicks (
  id bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  campaign_id uuid references public.affiliate_campaigns(id) on delete set null,
  visitor_hash text not null,
  is_unique boolean not null default false,
  destination_path text not null,
  campaign text,
  source text,
  referrer_host text,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_affiliate_created_idx on public.affiliate_clicks(affiliate_id,created_at desc);
create index if not exists affiliate_clicks_campaign_idx on public.affiliate_clicks(campaign_id,created_at desc);

alter table public.orders add column if not exists affiliate_id uuid references public.affiliate_profiles(id) on delete set null;
alter table public.orders add column if not exists affiliate_campaign_id uuid references public.affiliate_campaigns(id) on delete set null;
alter table public.orders add column if not exists affiliate_source text;
alter table public.orders add column if not exists affiliate_coupon_code text;
alter table public.orders add column if not exists affiliate_attributed_at timestamptz;
create index if not exists orders_affiliate_created_idx on public.orders(affiliate_id,created_at desc);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  commissionable_minor bigint not null check(commissionable_minor >= 0),
  commission_type public.affiliate_rate_type not null,
  commission_value integer not null check(commission_value >= 0),
  commission_minor bigint not null check(commission_minor >= 0),
  currency text not null check(char_length(currency)=3),
  status public.affiliate_commission_status not null default 'PENDING',
  referral_source text,
  campaign text,
  risk public.affiliate_risk not null default 'LOW',
  eligible_at timestamptz,
  approved_at timestamptz,
  payout_at timestamptz,
  rejection_reason text,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id,order_item_id)
);
create unique index if not exists affiliate_one_order_commission_idx on public.affiliate_commissions(order_id) where order_item_id is null;
create index if not exists affiliate_commissions_affiliate_status_idx on public.affiliate_commissions(affiliate_id,status,created_at desc);
create index if not exists affiliate_commissions_eligible_idx on public.affiliate_commissions(status,eligible_at) where status='PENDING';

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  amount_minor bigint not null check(amount_minor > 0),
  currency text not null check(char_length(currency)=3),
  status public.affiliate_payout_status not null default 'REQUESTED',
  payout_method text not null,
  payout_details_snapshot_ciphertext text,
  transaction_reference text,
  rejection_reason text,
  internal_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_payouts_status_idx on public.affiliate_payouts(status,requested_at desc);
create index if not exists affiliate_payouts_affiliate_idx on public.affiliate_payouts(affiliate_id,requested_at desc);

create table if not exists public.affiliate_payout_items (
  payout_id uuid not null references public.affiliate_payouts(id) on delete restrict,
  commission_id uuid not null unique references public.affiliate_commissions(id) on delete restrict,
  amount_minor bigint not null check(amount_minor > 0),
  primary key(payout_id,commission_id)
);

create table if not exists public.affiliate_fraud_flags (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  click_id bigint references public.affiliate_clicks(id) on delete set null,
  risk public.affiliate_risk not null,
  reason_code text not null,
  details jsonb not null default '{}',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  decision_reason text,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_fraud_unresolved_idx on public.affiliate_fraud_flags(risk,created_at desc) where resolved_at is null;

create table if not exists public.affiliate_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  material_type text not null,
  description text,
  storage_url text,
  promotional_text text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_email_events (
  event_key text primary key,
  affiliate_id uuid references public.affiliate_profiles(id) on delete cascade,
  event_type text not null,
  recipient text not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- Atomically reserve all currently approved commissions for one payout.
create or replace function public.request_affiliate_payout(p_affiliate uuid, p_method text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_settings affiliate_settings;
  v_currency text;
  v_total bigint;
  v_payout uuid;
begin
  select * into v_settings from affiliate_settings where id=true for share;
  perform id from affiliate_commissions
    where affiliate_id=p_affiliate and status='APPROVED'
    for update;
  select currency, sum(commission_minor) into v_currency,v_total
  from affiliate_commissions
  where affiliate_id=p_affiliate and status='APPROVED'
  group by currency
  limit 1;
  if (select count(distinct currency) from affiliate_commissions where affiliate_id=p_affiliate and status='APPROVED') > 1 then
    raise exception 'Approved commissions contain multiple currencies.';
  end if;
  if coalesce(v_total,0) < v_settings.minimum_payout_minor then
    raise exception 'Payout balance is below the configured minimum.';
  end if;
  insert into affiliate_payouts(affiliate_id,amount_minor,currency,payout_method)
  values(p_affiliate,v_total,v_currency,p_method) returning id into v_payout;
  insert into affiliate_payout_items(payout_id,commission_id,amount_minor)
    select v_payout,id,commission_minor from affiliate_commissions
    where affiliate_id=p_affiliate and status='APPROVED';
  update affiliate_commissions set status='PAYOUT_REQUESTED',updated_at=now()
    where affiliate_id=p_affiliate and status='APPROVED';
  return v_payout;
end $$;
revoke all on function public.request_affiliate_payout(uuid,text) from public,anon,authenticated;
grant execute on function public.request_affiliate_payout(uuid,text) to service_role;

alter table public.affiliate_tiers enable row level security;
alter table public.affiliate_profiles enable row level security;
alter table public.affiliate_applications enable row level security;
alter table public.affiliate_settings enable row level security;
alter table public.affiliate_product_rates enable row level security;
alter table public.affiliate_campaigns enable row level security;
alter table public.affiliate_visitors enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_payout_items enable row level security;
alter table public.affiliate_fraud_flags enable row level security;
alter table public.affiliate_materials enable row level security;
alter table public.affiliate_email_events enable row level security;

create policy affiliate_own_profile_read on public.affiliate_profiles for select using(user_id=auth.uid());
create policy affiliate_own_application_read on public.affiliate_applications for select using(user_id=auth.uid());
create policy affiliate_own_campaign_read on public.affiliate_campaigns for select using(exists(select 1 from affiliate_profiles p where p.id=affiliate_id and p.user_id=auth.uid()));
create policy affiliate_own_commission_read on public.affiliate_commissions for select using(exists(select 1 from affiliate_profiles p where p.id=affiliate_id and p.user_id=auth.uid()));
create policy affiliate_own_payout_read on public.affiliate_payouts for select using(exists(select 1 from affiliate_profiles p where p.id=affiliate_id and p.user_id=auth.uid()));
create policy affiliate_materials_approved_read on public.affiliate_materials for select using(active and exists(select 1 from affiliate_profiles p where p.user_id=auth.uid() and p.status='APPROVED'));
create policy affiliate_tiers_read on public.affiliate_tiers for select using(active);

-- All writes use protected server routes with the service role. No browser write policy is granted.
