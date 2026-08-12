create table products (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  description text not null default '', product_type text not null default 'OTHER' check(product_type in ('NFC_CARD','QR_LOST_FOUND','ACCESSORY','OTHER')),
  sku text unique, price_minor integer not null check(price_minor >= 0), sale_price_minor integer check(sale_price_minor >= 0),
  currency text not null default 'INR' check(char_length(currency)=3), stock integer not null default 0 check(stock >= 0),
  low_stock_threshold integer not null default 5 check(low_stock_threshold >= 0), images jsonb not null default '[]' check(jsonb_typeof(images)='array'),
  variants jsonb not null default '[]' check(jsonb_typeof(variants)='array'), active boolean not null default true,
  featured boolean not null default false, archived_at timestamptz, seo_title text, seo_description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index products_type_active_idx on products(product_type,active);
create index products_active_featured_idx on products(active,featured);
create index products_stock_idx on products(stock);

create table orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  customer_id uuid references users(id) on delete set null,
  customer_name text not null, customer_email text not null, customer_phone text,
  status text not null default 'PENDING' check(status in ('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED')),
  payment_status text not null default 'PENDING' check(payment_status in ('PENDING','SUCCEEDED','FAILED','PARTIALLY_REFUNDED','REFUNDED')),
  currency text not null default 'INR' check(char_length(currency)=3),
  subtotal_minor integer not null check(subtotal_minor >= 0), discount_minor integer not null default 0 check(discount_minor >= 0),
  tax_minor integer not null default 0 check(tax_minor >= 0), shipping_minor integer not null default 0 check(shipping_minor >= 0),
  total_minor integer not null check(total_minor >= 0),
  shipping_address jsonb not null default '{}' check(jsonb_typeof(shipping_address)='object'),
  billing_address jsonb not null default '{}' check(jsonb_typeof(billing_address)='object'),
  courier text, tracking_number text, internal_notes text,
  affiliate_id uuid, affiliate_campaign_id uuid, affiliate_source text, affiliate_coupon_code text,
  affiliate_code_snapshot text, affiliate_attribution_method text, affiliate_attributed_at timestamptz,
  affiliate_commission_eligible boolean not null default false, affiliate_lead_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(discount_minor <= subtotal_minor),
  check(total_minor = subtotal_minor - discount_minor + tax_minor + shipping_minor)
);
create index orders_created_idx on orders(created_at desc);
create index orders_status_idx on orders(status,payment_status);
create index orders_customer_idx on orders(customer_id,created_at desc);
create index orders_payment_created_idx on orders(payment_status,created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete restrict, product_name text not null,
  product_type text not null check(product_type in ('NFC_CARD','QR_LOST_FOUND','ACCESSORY','OTHER')),
  sku text, variant jsonb not null default '{}' check(jsonb_typeof(variant)='object'),
  quantity integer not null check(quantity > 0), unit_price_minor integer not null check(unit_price_minor >= 0),
  total_minor integer generated always as (quantity * unit_price_minor) stored
);
create index order_items_order_idx on order_items(order_id);
create index order_items_product_idx on order_items(product_id);
