-- Durable public media for card-owner selected logos, covers, and brochures.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('card-media','card-media',true,5242880,array['image/png','image/jpeg','image/webp','image/gif','application/pdf'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists card_media_public_read on storage.objects;
create policy card_media_public_read on storage.objects for select using(bucket_id='card-media');
-- Uploads and deletes are performed only by authenticated server routes using service role.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), reference text not null unique, customer_name text not null,
  customer_email text not null, topic text not null, contact_time text, message text not null,
  status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED')),
  assigned_to uuid references public.profiles(id) on delete set null, last_reply_at timestamptz,
  fingerprint text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists support_tickets_status_created_idx on public.support_tickets(status,created_at desc);
create index if not exists support_tickets_fingerprint_idx on public.support_tickets(fingerprint,created_at desc);
create table if not exists public.support_ticket_replies (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null, author_role text not null,
  message text not null, emailed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists support_ticket_replies_ticket_idx on public.support_ticket_replies(ticket_id,created_at);
alter table public.support_tickets enable row level security;
alter table public.support_ticket_replies enable row level security;
-- Support access is intentionally server-only through authenticated admin APIs.

create or replace function public.notify_low_stock() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.archived_at is null and new.active and new.stock <= new.low_stock_threshold and (tg_op='INSERT' or old.stock > old.low_stock_threshold or new.stock <> old.stock) then
    insert into public.admin_notifications(event_key,type,title,message)
    values('low-stock-'||new.id||'-'||new.stock,'LOW_STOCK','Low stock: '||new.name,new.stock||' unit(s) remaining; threshold is '||new.low_stock_threshold||'.')
    on conflict(event_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists products_low_stock_notification_insert on public.products;
create trigger products_low_stock_notification_insert after insert on public.products for each row execute function public.notify_low_stock();
drop trigger if exists products_low_stock_notification_update on public.products;
create trigger products_low_stock_notification_update after update of stock,low_stock_threshold,active,archived_at on public.products for each row execute function public.notify_low_stock();
