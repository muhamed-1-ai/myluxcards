create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['users','accounts','profiles','products','orders','payments','payment_webhook_events','website_settings','support_tickets','digital_cards','cards','affiliate_tiers','affiliate_profiles','affiliate_applications','affiliate_settings','affiliate_campaigns','affiliate_materials','affiliate_commissions','affiliate_payouts','affiliate_business_leads','affiliate_rewards','affiliate_store_credits']
  loop execute format('create trigger %I before update on %I for each row execute function set_updated_at()',t||'_set_updated_at',t); end loop;
end $$;

create function notify_low_stock() returns trigger language plpgsql set search_path=public as $$
begin
  if new.archived_at is null and new.active and new.stock <= new.low_stock_threshold
     and (tg_op='INSERT' or old.stock > old.low_stock_threshold or new.stock <> old.stock) then
    insert into admin_notifications(event_key,type,title,message)
    values('low-stock-'||new.id||'-'||new.stock,'LOW_STOCK','Low stock: '||new.name,new.stock||' unit(s) remaining; threshold is '||new.low_stock_threshold||'.')
    on conflict(event_key) do nothing;
  end if;
  return new;
end $$;
create trigger products_low_stock_insert after insert on products for each row execute function notify_low_stock();
create trigger products_low_stock_update after update of stock,low_stock_threshold,active,archived_at on products for each row execute function notify_low_stock();

create function request_affiliate_payout(p_affiliate uuid,p_method text) returns uuid language plpgsql set search_path=public as $$
declare v_settings affiliate_settings; v_currency text; v_total bigint; v_payout uuid;
begin
  select * into strict v_settings from affiliate_settings where id=true for share;
  if not (p_method=any(v_settings.allowed_payout_methods)) then raise exception 'Payout method is not enabled.'; end if;
  perform id from affiliate_commissions where affiliate_id=p_affiliate and status='APPROVED' for update;
  if (select count(distinct currency) from affiliate_commissions where affiliate_id=p_affiliate and status='APPROVED') > 1 then
    raise exception 'Approved commissions contain multiple currencies.';
  end if;
  select min(currency),sum(commission_minor) into v_currency,v_total from affiliate_commissions where affiliate_id=p_affiliate and status='APPROVED';
  if coalesce(v_total,0) < v_settings.minimum_payout_minor then raise exception 'Payout balance is below the configured minimum.'; end if;
  insert into affiliate_payouts(affiliate_id,amount_minor,currency,payout_method) values(p_affiliate,v_total,v_currency,p_method) returning id into v_payout;
  insert into affiliate_payout_items(payout_id,commission_id,amount_minor)
    select v_payout,id,commission_minor from affiliate_commissions where affiliate_id=p_affiliate and status='APPROVED';
  update affiliate_commissions set status='RESERVED_FOR_PAYOUT' where affiliate_id=p_affiliate and status='APPROVED';
  return v_payout;
end $$;
revoke all on function request_affiliate_payout(uuid,text) from public;

comment on table digital_cards is 'Card media URLs currently depend on Supabase Storage. Replace with S3-compatible object storage before removing Supabase Storage.';
