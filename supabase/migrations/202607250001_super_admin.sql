-- MyLuxCards administration and commerce foundation.
-- Apply with `supabase db push` against a linked project; never reset production.
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('CUSTOMER','ADMIN','SUPER_ADMIN'); exception when duplicate_object then null; end $$;
do $$ begin create type public.account_status as enum ('ACTIVE','DISABLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.product_type as enum ('NFC_CARD','QR_LOST_FOUND','ACCESSORY','OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('PENDING','SUCCEEDED','FAILED','PARTIALLY_REFUNDED','REFUNDED'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text,
  role public.app_role not null default 'CUSTOMER',
  status public.account_status not null default 'ACTIVE',
  disabled boolean not null default false,
  must_change_password boolean not null default false,
  internal_notes text,
  role_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_lower_idx on public.profiles(lower(email));
create index if not exists profiles_role_created_idx on public.profiles(role, created_at desc);

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  -- Only trusted service-role operations may change authorization or account state.
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
     and coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    new.role := old.role;
    new.status := old.status;
    new.disabled := old.disabled;
    new.must_change_password := old.must_change_password;
    new.role_version := old.role_version;
    new.internal_notes := old.internal_notes;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
before update on public.profiles
for each row execute procedure public.protect_profile_security_fields();

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,name,role)
  values(new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'name',''), 'CUSTOMER')
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_auth_user();
insert into public.profiles(id,email,name)
select id,lower(email),coalesce(raw_user_meta_data->>'name','') from auth.users on conflict(id) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, description text not null default '',
  product_type public.product_type not null default 'OTHER',
  sku text unique, price_minor integer not null check(price_minor >= 0),
  sale_price_minor integer check(sale_price_minor is null or sale_price_minor >= 0),
  currency text not null default 'INR' check(char_length(currency)=3),
  stock integer not null default 0 check(stock >= 0), low_stock_threshold integer not null default 5,
  images jsonb not null default '[]', variants jsonb not null default '[]',
  active boolean not null default true, featured boolean not null default false,
  archived_at timestamptz, seo_title text, seo_description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists products_type_active_idx on public.products(product_type,active);
create index if not exists products_stock_idx on public.products(stock);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null, customer_email text not null, customer_phone text,
  status public.order_status not null default 'PENDING',
  payment_status public.payment_status not null default 'PENDING',
  currency text not null default 'INR', subtotal_minor integer not null check(subtotal_minor >= 0),
  discount_minor integer not null default 0 check(discount_minor >= 0),
  tax_minor integer not null default 0 check(tax_minor >= 0),
  shipping_minor integer not null default 0 check(shipping_minor >= 0),
  total_minor integer not null check(total_minor >= 0),
  shipping_address jsonb not null default '{}', billing_address jsonb not null default '{}',
  courier text, tracking_number text, internal_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status,payment_status);
create index if not exists orders_customer_idx on public.orders(customer_id,created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  product_name text not null, product_type public.product_type not null, sku text,
  variant jsonb not null default '{}', quantity integer not null check(quantity > 0),
  unit_price_minor integer not null check(unit_price_minor >= 0),
  total_minor integer generated always as (quantity * unit_price_minor) stored
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null, provider_transaction_id text not null,
  amount_minor integer not null check(amount_minor >= 0), currency text not null,
  status public.payment_status not null default 'PENDING', failure_reason text,
  refunded_minor integer not null default 0 check(refunded_minor >= 0 and refunded_minor <= amount_minor),
  provider_created_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider, provider_transaction_id)
);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payments_status_created_idx on public.payments(status,created_at desc);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null, actor_role public.app_role not null,
  action text not null, entity_type text not null, entity_id text,
  before_summary jsonb, after_summary jsonb, ip_address text, user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists audit_entity_idx on public.admin_audit_logs(entity_type,entity_id);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(), event_key text not null unique,
  type text not null, title text not null, message text not null, order_id uuid references public.orders(id) on delete cascade,
  email_recipient text, emailed_at timestamptz, email_error text, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_created_idx on public.admin_notifications(created_at desc);

create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(), email text not null, role public.app_role not null default 'ADMIN',
  token_hash text not null unique, invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now(), check(role='ADMIN')
);
create index if not exists invites_email_idx on public.admin_invites(lower(email),created_at desc);

create table if not exists public.website_settings (
  id boolean primary key default true check(id), business_name text not null default 'MyLuxCards',
  support_email text, support_phone text, order_notification_email text,
  currency text not null default 'INR', low_stock_threshold integer not null default 5,
  shipping jsonb not null default '{}', tax jsonb not null default '{}', invoice jsonb not null default '{}',
  social_links jsonb not null default '{}', maintenance_message text, terms_url text, privacy_url text,
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
insert into public.website_settings(id) values(true) on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_invites enable row level security;
alter table public.website_settings enable row level security;

drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select using(auth.uid()=id);
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update using(auth.uid()=id)
with check(auth.uid()=id and role=(select role from public.profiles where id=auth.uid()) and disabled=(select disabled from public.profiles where id=auth.uid()));
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using(active and archived_at is null);
drop policy if exists orders_own_read on public.orders;
create policy orders_own_read on public.orders for select using(customer_id=auth.uid());
drop policy if exists order_items_own_read on public.order_items;
create policy order_items_own_read on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));

-- Service-role access used by protected server routes bypasses RLS. No public admin write policy is granted.
