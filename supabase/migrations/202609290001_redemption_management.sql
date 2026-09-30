begin;

alter table public.reward_redemptions
  add column cancelled_at timestamptz,
  add column handled_by_user_id uuid,
  add column refund_transaction_id uuid unique references public.loyalty_transactions(id) on delete restrict;

create function public.api_staff_resolve_redemption(
  p_staff_user_id uuid, p_redemption_id uuid, p_status text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_redemption public.reward_redemptions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_refund_id uuid;
begin
  if not exists (
    select 1 from public.app_user_roles
    where auth_user_id = p_staff_user_id and role in ('ADMIN','SELLER')
  ) then
    raise exception 'STAFF_REQUIRED' using errcode = 'P0001';
  end if;
  if p_status not in ('FULFILLED','CANCELLED') or p_status is null then
    raise exception 'INVALID_REDEMPTION_STATUS' using errcode = '22023';
  end if;

  select * into v_redemption from public.reward_redemptions
    where id = p_redemption_id for update;
  if not found then
    raise exception 'REDEMPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_redemption.status::text = p_status then
    return jsonb_build_object('id',v_redemption.id,'status',p_status,
      'replayed',true,'pointsReturned',0);
  end if;
  if v_redemption.status <> 'PENDING' then
    raise exception 'REDEMPTION_ALREADY_RESOLVED' using errcode = 'P0001';
  end if;

  if p_status = 'FULFILLED' then
    update public.reward_redemptions
      set status = 'FULFILLED', fulfilled_at = now(), handled_by_user_id = p_staff_user_id
      where id = p_redemption_id;
    return jsonb_build_object('id',p_redemption_id,'status',p_status,
      'replayed',false,'pointsReturned',0);
  end if;

  if not exists (
    select 1 from public.loyalty_transactions
    where id = v_redemption.loyalty_transaction_id
      and customer_id = v_redemption.customer_id
      and entry_type = 'REDEMPTION_SPEND'
      and points_delta = -v_redemption.points_cost_snapshot
  ) then
    raise exception 'REDEMPTION_SPEND_MISSING' using errcode = 'P0001';
  end if;
  select * into v_account from public.loyalty_accounts
    where customer_id = v_redemption.customer_id for update;
  if not found or v_account.redemption_count < 1 then
    raise exception 'LOYALTY_ACCOUNT_MISSING' using errcode = 'P0002';
  end if;
  update public.loyalty_accounts
    set available_points = available_points + v_redemption.points_cost_snapshot,
        redemption_count = redemption_count - 1,
        version = version + 1
    where customer_id = v_redemption.customer_id;
  insert into public.loyalty_transactions(
    customer_id,entry_type,points_delta,balance_after,source_system,source_id,
    description,metadata
  ) values (
    v_redemption.customer_id,'REVERSAL',v_redemption.points_cost_snapshot,
    v_account.available_points + v_redemption.points_cost_snapshot,
    'SUPABASE','REDEMPTION_CANCEL:' || v_redemption.id::text,
    'Devolución por canje cancelado',
    jsonb_build_object('redemptionId',v_redemption.id,'staffUserId',p_staff_user_id)
  ) returning id into v_refund_id;
  update public.reward_redemptions
    set status = 'CANCELLED', cancelled_at = now(), handled_by_user_id = p_staff_user_id,
        refund_transaction_id = v_refund_id
    where id = p_redemption_id;
  return jsonb_build_object('id',p_redemption_id,'status',p_status,
    'replayed',false,'pointsReturned',v_redemption.points_cost_snapshot);
end;
$$;

revoke execute on function public.api_staff_resolve_redemption(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.api_staff_resolve_redemption(uuid,uuid,text)
  to service_role;

commit;
