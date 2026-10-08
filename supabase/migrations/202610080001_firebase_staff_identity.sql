begin;
-- Firebase proves identity; existing Supabase roles and device revocation remain authoritative.
create table public.staff_firebase_bindings (
  firebase_uid text not null check (length(firebase_uid) between 1 and 128),
  device_public_id uuid not null references public.app_devices(device_public_id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  role public.app_role not null check (role in ('ADMIN','SELLER')),
  credential_hash text check (credential_hash is null or credential_hash ~ '^[0-9a-f]{64}$'),
  revoked boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (firebase_uid, device_public_id)
);
alter table public.staff_firebase_bindings enable row level security;
revoke all on table public.staff_firebase_bindings from public,anon,authenticated;
grant all on table public.staff_firebase_bindings to service_role;

create function public.api_bind_firebase_device(p_auth_user_id uuid,p_device_public_id uuid,
  p_firebase_uid text,p_role public.app_role,p_credential_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_existing public.staff_firebase_bindings%rowtype;
  v_expires timestamptz := clock_timestamp()+interval '90 days'; v_credential public.staff_device_credentials%rowtype;
begin
  if p_auth_user_id is null or p_device_public_id is null or p_role is null or
    p_firebase_uid is null or length(p_firebase_uid) not between 1 and 128 or p_role not in ('ADMIN','SELLER') then
    raise exception 'INVALID_IDENTITY' using errcode='22023'; end if;
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and
    (role='ADMIN' or (role='SELLER' and p_role='SELLER'))) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_device_public_id::text,481001));
  select auth_user_id into v_owner from public.app_devices where device_public_id=p_device_public_id for update;
  if found and v_owner<>p_auth_user_id then raise exception 'DEVICE_OWNERSHIP_REQUIRED' using errcode='42501'; end if;
  if p_credential_hash is not null then
    select * into v_credential from public.staff_device_credentials where device_public_id=p_device_public_id
      and auth_user_id=p_auth_user_id and token_hash=p_credential_hash and not revoked and expires_at>clock_timestamp();
    if not found or (v_credential.role='SELLER' and p_role='ADMIN') then
      raise exception 'DEVICE_REVOKED' using errcode='42501'; end if;
    v_expires := least(v_expires,v_credential.expires_at);
  end if;
  if exists(select 1 from public.app_devices where device_public_id=p_device_public_id and status<>'ACTIVE') then
    raise exception 'DEVICE_REVOKED' using errcode='42501'; end if;
  insert into public.app_devices(auth_user_id,device_public_id,name,app_version)
    values(p_auth_user_id,p_device_public_id,'Donas Control Firebase','1.4.1') on conflict(device_public_id) do nothing;
  select * into v_existing from public.staff_firebase_bindings where firebase_uid=p_firebase_uid
    and device_public_id=p_device_public_id for update;
  if found and (v_existing.auth_user_id<>p_auth_user_id or
    (v_existing.credential_hash is not null and p_credential_hash is null)) then
    raise exception 'IDENTITY_BINDING_CONFLICT' using errcode='42501'; end if;
  -- One current account per device. Switching an authorized account invalidates its previous binding.
  update public.staff_firebase_bindings set revoked=true where device_public_id=p_device_public_id and firebase_uid<>p_firebase_uid;
  insert into public.staff_firebase_bindings(firebase_uid,device_public_id,auth_user_id,role,credential_hash,expires_at)
    values(p_firebase_uid,p_device_public_id,p_auth_user_id,p_role,p_credential_hash,v_expires)
    on conflict(firebase_uid,device_public_id) do update set revoked=false,expires_at=excluded.expires_at,
      role=excluded.role,credential_hash=excluded.credential_hash;
  return jsonb_build_object('linked',true,'deviceId',p_device_public_id,'expiresAt',v_expires);
end; $$;
revoke execute on function public.api_bind_firebase_device(uuid,uuid,text,public.app_role,text) from public,anon,authenticated;
grant execute on function public.api_bind_firebase_device(uuid,uuid,text,public.app_role,text) to service_role;

-- Resolve all authorization checks in one database snapshot/network request.
create function public.api_resolve_firebase_device(p_firebase_uid text,p_device_public_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',b.auth_user_id,'deviceId',b.device_public_id,'role',
    case when b.role='ADMIN' and exists(select 1 from public.app_user_roles r
      where r.auth_user_id=b.auth_user_id and r.role='ADMIN') then 'ADMIN' else 'SELLER' end)
  from public.staff_firebase_bindings b join public.app_devices d
    on d.device_public_id=b.device_public_id and d.auth_user_id=b.auth_user_id
  where b.firebase_uid=p_firebase_uid and b.device_public_id=p_device_public_id
    and not b.revoked and b.expires_at>now() and d.status='ACTIVE'
    and exists(select 1 from public.app_user_roles r where r.auth_user_id=b.auth_user_id and r.role in ('ADMIN','SELLER'))
    and (b.credential_hash is null or exists(select 1 from public.staff_device_credentials c
      where c.device_public_id=b.device_public_id and c.auth_user_id=b.auth_user_id
        and c.token_hash=b.credential_hash and not c.revoked and c.expires_at>now()));
$$;
revoke execute on function public.api_resolve_firebase_device(text,uuid) from public,anon,authenticated;
grant execute on function public.api_resolve_firebase_device(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
