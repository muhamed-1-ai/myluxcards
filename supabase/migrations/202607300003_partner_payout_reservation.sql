-- Kept separate because PostgreSQL requires a commit before a newly-added enum
-- value can be used by stored procedures.
create or replace function public.request_affiliate_payout(p_affiliate uuid, p_method text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_settings affiliate_settings;
  v_currency text;
  v_total bigint;
  v_payout uuid;
begin
  select * into v_settings from affiliate_settings where id=true for share;
  if not (p_method = any(v_settings.allowed_payout_methods)) then
    raise exception 'Payout method is not enabled.';
  end if;
  perform id from affiliate_commissions
    where affiliate_id=p_affiliate and status='APPROVED'
    for update;
  select currency, sum(commission_minor) into v_currency,v_total
  from affiliate_commissions
  where affiliate_id=p_affiliate and status='APPROVED'
  group by currency limit 1;
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
  update affiliate_commissions set status='RESERVED_FOR_PAYOUT',updated_at=now()
    where affiliate_id=p_affiliate and status='APPROVED';
  return v_payout;
end $$;
revoke all on function public.request_affiliate_payout(uuid,text) from public,anon,authenticated;
grant execute on function public.request_affiliate_payout(uuid,text) to service_role;
