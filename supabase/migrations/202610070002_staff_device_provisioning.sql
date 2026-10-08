begin;
create table public.staff_device_invitations (
  token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  role text not null check(role in ('ADMIN','SELLER')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create table public.staff_device_credentials (
  device_public_id uuid primary key,
  auth_user_id uuid not null references auth.users(id),
  role text not null check(role in ('ADMIN','SELLER')),
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  revoked boolean not null default false,
  expires_at timestamptz not null default clock_timestamp()+interval '90 days',
  created_at timestamptz not null default clock_timestamp()
);
alter table public.staff_device_invitations enable row level security;
alter table public.staff_device_credentials enable row level security;
revoke all on public.staff_device_invitations,public.staff_device_credentials from public,anon,authenticated;
grant select on public.staff_device_credentials to service_role;
create function public.api_issue_staff_invitation(p_auth_user_id uuid,p_hash text,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  insert into public.staff_device_invitations(token_hash,created_by,role,expires_at)
    values(p_hash,p_auth_user_id,p_role,clock_timestamp()+interval '15 minutes');
  return jsonb_build_object('expiresInSeconds',900);
end; $$;
create function public.api_claim_staff_invitation(p_invitation_hash text,p_device_public_id uuid,p_credential_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_invite public.staff_device_invitations;
begin
  select * into v_invite from public.staff_device_invitations where token_hash=p_invitation_hash for update;
  if not found or v_invite.consumed_at is not null or v_invite.expires_at<=clock_timestamp() then
    raise exception 'INVALID_INVITATION' using errcode='42501'; end if;
  if not exists(select 1 from public.app_user_roles where auth_user_id=v_invite.created_by and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  -- A revoked credential can only be replaced with a new administrator-issued invitation.
  insert into public.staff_device_credentials(device_public_id,auth_user_id,role,token_hash)
    values(p_device_public_id,v_invite.created_by,v_invite.role,p_credential_hash)
    on conflict(device_public_id) do update set auth_user_id=excluded.auth_user_id,role=excluded.role,
      token_hash=excluded.token_hash,revoked=false,expires_at=clock_timestamp()+interval '90 days';
  update public.staff_device_invitations set consumed_at=clock_timestamp() where token_hash=p_invitation_hash;
  update public.app_devices set status='ACTIVE' where device_public_id=p_device_public_id and auth_user_id=v_invite.created_by;
  return jsonb_build_object('role',v_invite.role,'userId',v_invite.created_by);
end; $$;
create function public.api_revoke_staff_device(p_auth_user_id uuid,p_device_public_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.staff_device_credentials set revoked=true where device_public_id=p_device_public_id;
  update public.app_devices set status='REVOKED' where device_public_id=p_device_public_id;
  update public.push_devices set active=false where device_public_id=p_device_public_id;
  return jsonb_build_object('revoked',true);
end; $$;
revoke execute on function public.api_issue_staff_invitation(uuid,text,text),public.api_claim_staff_invitation(text,uuid,text),
  public.api_revoke_staff_device(uuid,uuid) from public,anon,authenticated;
grant execute on function public.api_issue_staff_invitation(uuid,text,text),public.api_claim_staff_invitation(text,uuid,text),
  public.api_revoke_staff_device(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
