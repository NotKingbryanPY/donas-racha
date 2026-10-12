-- Run first, as postgres, in the existing project's SQL Editor. No seed/count changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $check$
begin
  if to_regclass('public.inventory_revision') is null or
     to_regclass('public.inventory_movements') is null or
     to_regclass('public.inventory_manual_counts') is null then
    raise exception 'INVENTORY_SCHEMA_MISSING: export the schema before continuing';
  end if;
  if not exists(select 1 from public.inventory_revision where id) then
    raise exception 'INVENTORY_REVISION_MISSING';
  end if;
end $check$;

-- Direct transaction; no dependency on the legacy Android/manual wrapper.
create or replace function public.api_set_shared_inventory(
  p_auth_user_id uuid,p_counts jsonb,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $save$
declare v_revision bigint; v_sequence bigint; v_time timestamptz; v_count record; v_variant uuid;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if jsonb_typeof(p_counts) is distinct from 'object' then
    raise exception 'FOUR_FLAVORS_REQUIRED' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_counts))<>4 then
    raise exception 'FOUR_FLAVORS_REQUIRED' using errcode='22023';
  end if;
  if p_expected_revision is null or p_expected_revision<0 then
    raise exception 'INVENTORY_REVISION_REQUIRED' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(26092601);
  select revision into strict v_revision from public.inventory_revision where id;
  if p_expected_revision<>v_revision then
    raise exception 'INVENTORY_CONFLICT' using errcode='P0001';
  end if;
  select coalesce(max(id),0) into v_sequence from public.inventory_movements;
  v_time:=clock_timestamp();
  for v_count in select key,value from jsonb_each_text(p_counts) loop
    if v_count.key not in ('DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS') or
       v_count.value is null or v_count.value !~ '^[0-9]{1,6}$' or v_count.value::integer>100000 then
      raise exception 'INVALID_QUANTITY' using errcode='22023';
    end if;
    select id into strict v_variant from public.product_variants where sku=v_count.key;
    insert into public.inventory_manual_counts(variant_id,quantity,counted_at,counted_by,movement_sequence)
      values(v_variant,v_count.value::integer,v_time,p_auth_user_id,v_sequence)
      on conflict(variant_id) do update set quantity=excluded.quantity,counted_at=excluded.counted_at,
        counted_by=excluded.counted_by,movement_sequence=excluded.movement_sequence;
  end loop;
  update public.inventory_control set enforce_orders=true,updated_at=v_time where id;
  update public.inventory_revision set revision=revision+1 where id returning revision into v_revision;
  return jsonb_build_object('saved',true,'countedAt',v_time,'revision',v_revision);
end $save$;

create or replace function public.api_inventory_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $read$
declare v_result jsonb;
begin
  perform pg_advisory_xact_lock(26092601);
  select jsonb_build_object('flavors',(select coalesce(jsonb_agg(to_jsonb(i) order by i.sku),'[]'::jsonb)
    from public.inventory_by_flavor i),'revision',r.revision,'serverTime',clock_timestamp(),'webOnly',true)
    into strict v_result from public.inventory_revision r where r.id;
  return v_result;
end $read$;
revoke execute on function public.api_set_shared_inventory(uuid,jsonb,bigint),public.api_inventory_snapshot()
  from public,anon,authenticated;
grant execute on function public.api_set_shared_inventory(uuid,jsonb,bigint),public.api_inventory_snapshot() to service_role;
notify pgrst,'reload schema';
commit;
select 'WEB_INVENTORY_READY' as status,
  has_function_privilege('service_role','public.api_set_shared_inventory(uuid,jsonb,bigint)','EXECUTE') as server_can_save,
  has_function_privilege('anon','public.api_set_shared_inventory(uuid,jsonb,bigint)','EXECUTE') as anon_can_save;
