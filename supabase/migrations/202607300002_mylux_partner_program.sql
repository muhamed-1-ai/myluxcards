-- Extends the affiliate foundation into the MyLux Partner Program.
-- Apply after 202607300001_affiliate_program.sql. This migration is additive.
do $$ begin create type public.partner_type as enum ('CUSTOMER_REFERRER','CREATOR','BUSINESS_PARTNER','CAMPUS_AMBASSADOR'); exception when duplicate_object then null; end $$;
do $$ begin create type public.affiliate_lead_status as enum ('REGISTERED','UNDER_REVIEW','QUALIFIED','CONTACTED','QUOTATION_SENT','NEGOTIATION','WON','LOST','EXPIRED','REJECTED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.affiliate_reward_status as enum ('ELIGIBLE','APPROVED','REJECTED','FULFILLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.store_credit_status as enum ('PENDING','AVAILABLE','USED','EXPIRED','REVERSED'); exception when duplicate_object then null; end $$;
alter type public.affiliate_commission_status add value if not exists 'RESERVED_FOR_PAYOUT' before 'PAID';

alter table public.affiliate_profiles add column if not exists partner_type public.partner_type not null default 'CREATOR';
alter table public.affiliate_profiles add column if not exists display_name text;
alter table public.affiliate_profiles add column if not exists suspended_at timestamptz;
alter table public.affiliate_profiles add column if not exists temporary_commission_type public.affiliate_rate_type;
alter table public.affiliate_profiles add column if not exists temporary_commission_value integer check(temporary_commission_value is null or temporary_commission_value >= 0);
alter table public.affiliate_profiles add column if not exists temporary_commission_expires_at timestamptz;
create index if not exists affiliate_profiles_partner_type_idx on public.affiliate_profiles(partner_type,status);

alter table public.affiliate_applications add column if not exists partner_type public.partner_type not null default 'CREATOR';
alter table public.affiliate_applications add column if not exists other_social_url text;

alter table public.affiliate_settings add column if not exists program_enabled boolean not null default true;
alter table public.affiliate_settings add column if not exists public_applications_enabled boolean not null default true;
alter table public.affiliate_settings add column if not exists allowed_partner_types public.partner_type[] not null default array['CUSTOMER_REFERRER','CREATOR','BUSINESS_PARTNER','CAMPUS_AMBASSADOR']::public.partner_type[];
alter table public.affiliate_settings add column if not exists partner_type_rates jsonb not null default '{"CUSTOMER_REFERRER":{"type":"PERCENT_BPS","value":500},"CREATOR":{"type":"PERCENT_BPS","value":1000},"BUSINESS_PARTNER":{"type":"PERCENT_BPS","value":1000},"CAMPUS_AMBASSADOR":{"type":"PERCENT_BPS","value":1000}}';
alter table public.affiliate_settings add column if not exists customer_referral_discount_bps integer not null default 500 check(customer_referral_discount_bps between 0 and 10000);
alter table public.affiliate_settings add column if not exists customer_referral_cash_enabled boolean not null default false;
alter table public.affiliate_settings add column if not exists business_lead_protection_days integer not null default 90 check(business_lead_protection_days between 1 and 365);
alter table public.affiliate_settings add column if not exists coupon_stacking_allowed boolean not null default false;
alter table public.affiliate_settings add column if not exists tap_to_refer_enabled boolean not null default false;
alter table public.affiliate_settings add column if not exists allowed_payout_methods text[] not null default array['BANK_TRANSFER','UPI','PAYPAL','OTHER'];
alter table public.affiliate_settings add column if not exists support_email text;
alter table public.affiliate_settings add column if not exists store_credit_expiry_days integer check(store_credit_expiry_days is null or store_credit_expiry_days between 1 and 3650);
update public.affiliate_settings set holding_period_days=7 where id=true and holding_period_days=14;
update public.affiliate_tiers set min_completed_orders=10,commission_value=1200 where name='SILVER';
update public.affiliate_tiers set min_completed_orders=25,commission_value=1500 where name='GOLD';
update public.affiliate_tiers set min_completed_orders=50,commission_value=1800 where name='PLATINUM';

alter table public.orders add column if not exists affiliate_code_snapshot text;
alter table public.orders add column if not exists affiliate_attribution_method text;
alter table public.orders add column if not exists affiliate_commission_eligible boolean not null default false;
alter table public.orders add column if not exists affiliate_lead_id uuid;

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  campaign_id uuid references public.affiliate_campaigns(id) on delete set null,
  business_lead_id uuid,
  method text not null check(method in ('REFERRAL_COOKIE','AFFILIATE_COUPON','BUSINESS_LEAD','TAP_TO_REFER')),
  affiliate_code_snapshot text not null,
  campaign_snapshot text,
  source_snapshot text,
  expires_at timestamptz not null,
  converted_order_id uuid unique references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_attributions_affiliate_idx on public.affiliate_attributions(affiliate_id,created_at desc);

create table if not exists public.affiliate_coupons (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null unique references public.affiliate_profiles(id) on delete cascade,
  code text not null,
  discount_type public.affiliate_rate_type not null default 'PERCENT_BPS',
  discount_value integer not null default 0 check(discount_value >= 0),
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists affiliate_coupons_code_upper_idx on public.affiliate_coupons(upper(code));

alter table public.affiliate_commissions add column if not exists calculation_snapshot jsonb not null default '{}';
alter table public.affiliate_commissions add column if not exists discount_minor bigint not null default 0 check(discount_minor >= 0);
alter table public.affiliate_commissions add column if not exists excluded_tax_minor bigint not null default 0 check(excluded_tax_minor >= 0);
alter table public.affiliate_commissions add column if not exists excluded_shipping_minor bigint not null default 0 check(excluded_shipping_minor >= 0);
alter table public.affiliate_commissions add column if not exists calculated_at timestamptz not null default now();

create table if not exists public.affiliate_commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.affiliate_commissions(id) on delete restrict,
  adjustment_type text not null check(adjustment_type in ('CREDIT','DEBIT','PARTIAL_REFUND','RECOVERY')),
  amount_minor bigint not null check(amount_minor > 0),
  reason text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_adjustments_commission_idx on public.affiliate_commission_adjustments(commission_id,created_at desc);

create table if not exists public.affiliate_tier_history (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  previous_tier_id uuid references public.affiliate_tiers(id) on delete set null,
  new_tier_id uuid references public.affiliate_tiers(id) on delete set null,
  reason text not null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_business_leads (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  company_name text not null,
  normalized_company text not null,
  contact_person text not null,
  business_email text not null,
  email_hash text not null,
  phone text,
  phone_hash text,
  estimated_quantity integer not null check(estimated_quantity > 0),
  product_id uuid references public.products(id) on delete set null,
  expected_purchase_date date,
  notes text,
  consent_confirmed_at timestamptz not null,
  lead_source text,
  status public.affiliate_lead_status not null default 'REGISTERED',
  protection_expires_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  decision_reason text,
  linked_order_id uuid unique references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_leads_affiliate_idx on public.affiliate_business_leads(affiliate_id,status,created_at desc);
create index if not exists affiliate_leads_duplicate_idx on public.affiliate_business_leads(normalized_company,email_hash,phone_hash);
alter table public.orders drop constraint if exists orders_affiliate_lead_id_fkey;
alter table public.orders add constraint orders_affiliate_lead_id_fkey foreign key(affiliate_lead_id) references public.affiliate_business_leads(id) on delete set null;
alter table public.affiliate_attributions drop constraint if exists affiliate_attributions_business_lead_id_fkey;
alter table public.affiliate_attributions add constraint affiliate_attributions_business_lead_id_fkey foreign key(business_lead_id) references public.affiliate_business_leads(id) on delete set null;

create table if not exists public.affiliate_reward_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  required_delivered_orders integer not null check(required_delivered_orders > 0),
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.affiliate_reward_definitions(name,required_delivered_orders,description) values
  ('STANDARD_CARD_REWARD',3,'Free standard NFC card eligibility'),
  ('PREMIUM_CARD_REWARD',10,'Free premium NFC card eligibility'),
  ('DEMO_KIT_REWARD',25,'Premium demo kit or metal card eligibility'),
  ('PLATINUM_REVIEW',50,'Platinum tier review eligibility')
on conflict(name) do nothing;

create table if not exists public.affiliate_rewards (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  reward_definition_id uuid not null references public.affiliate_reward_definitions(id) on delete restrict,
  status public.affiliate_reward_status not null default 'ELIGIBLE',
  decision_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(affiliate_id,reward_definition_id)
);

create table if not exists public.affiliate_store_credits (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  amount_minor bigint not null check(amount_minor > 0),
  currency text not null check(char_length(currency)=3),
  status public.store_credit_status not null,
  expires_at timestamptz,
  used_order_id uuid references public.orders(id) on delete restrict,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(affiliate_id,order_id)
);
create index if not exists affiliate_store_credit_balance_idx on public.affiliate_store_credits(affiliate_id,status,created_at desc);

alter table public.affiliate_attributions enable row level security;
alter table public.affiliate_coupons enable row level security;
alter table public.affiliate_commission_adjustments enable row level security;
alter table public.affiliate_tier_history enable row level security;
alter table public.affiliate_business_leads enable row level security;
alter table public.affiliate_reward_definitions enable row level security;
alter table public.affiliate_rewards enable row level security;
alter table public.affiliate_store_credits enable row level security;

create policy affiliate_own_leads_read on public.affiliate_business_leads for select using(exists(select 1 from affiliate_profiles p where p.id=affiliate_id and p.user_id=auth.uid()));
create policy affiliate_own_rewards_read on public.affiliate_rewards for select using(exists(select 1 from affiliate_profiles p where p.id=affiliate_id and p.user_id=auth.uid()));
create policy affiliate_own_store_credits_read on public.affiliate_store_credits for select using(exists(select 1 from affiliate_profiles p where p.id=affiliate_id and p.user_id=auth.uid()));
create policy affiliate_reward_definitions_read on public.affiliate_reward_definitions for select using(active);

-- Writes continue through authenticated, ownership-checked server routes only.
