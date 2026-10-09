-- A restored ledger must retain its original sync device, including reversal ownership.
begin;
alter table public.app_devices add column restored_to_official boolean not null default false;
create function public.api_restore_device_identity(
  p_auth_user_id uuid,p_client_operation_id uuid,p_server_sequence bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_devices uuid[]; v_device public.app_devices%rowtype;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if exists(select 1 from public.sync_operations s join public.app_devices d on d.id=s.device_id
    where s.client_operation_id=p_client_operation_id and d.auth_user_id<>p_auth_user_id) then
    raise exception 'DEVICE_OWNER_CONFLICT' using errcode='42501'; end if;
  select array_agg(distinct d.device_public_id) into v_devices
    from public.sync_operations s join public.app_devices d on d.id=s.device_id
    where s.client_operation_id=p_client_operation_id and d.auth_user_id=p_auth_user_id
      and (p_server_sequence is null or s.server_sequence=p_server_sequence);
  if coalesce(cardinality(v_devices),0)=0 then
    if p_server_sequence is not null then raise exception 'RESTORE_PROOF_NOT_FOUND' using errcode='P0001'; end if;
    return jsonb_build_object('deviceId',null);
  end if;
  if cardinality(v_devices)<>1 then raise exception 'RESTORE_DEVICE_CONFLICT' using errcode='P0001'; end if;
  select * into v_device from public.app_devices where device_public_id=v_devices[1];
  if v_device.status<>'ACTIVE' then raise exception 'DEVICE_REVOKED' using errcode='42501'; end if;
  update public.app_devices set restored_to_official=true where id=v_device.id;
  return jsonb_build_object('deviceId',v_device.device_public_id);
end; $$;
revoke execute on function public.api_restore_device_identity(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.api_restore_device_identity(uuid,uuid,bigint) to service_role;

alter function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) rename to api_push_sync_before_device_ownership;
revoke execute on function public.api_push_sync_before_device_ownership(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
create function public.api_push_sync_operations(
  p_auth_user_id uuid,p_device_public_id uuid,p_device_name text,p_app_version text,p_operations jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(26092601);
  if exists(select 1 from public.app_devices where device_public_id=p_device_public_id and auth_user_id<>p_auth_user_id) then
    raise exception 'DEVICE_OWNER_CONFLICT' using errcode='42501'; end if;
  if exists(select 1 from public.app_devices where device_public_id=p_device_public_id and restored_to_official)
    and p_app_version not like '%-official' then
    raise exception 'DEVICE_MOVED_TO_OFFICIAL' using errcode='P0001'; end if;
  return public.api_push_sync_before_device_ownership(p_auth_user_id,p_device_public_id,p_device_name,p_app_version,p_operations);
end; $$;
revoke execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) to service_role;
commit;
