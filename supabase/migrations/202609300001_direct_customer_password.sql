begin;

drop function if exists public.api_set_customer_password_by_verified_phone(uuid,uuid,text,text);

create function public.api_claim_customer_password(
  p_customer_id uuid, p_salt text, p_hash text
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if p_salt !~ '^[0-9a-f]{32}$' or p_hash !~ '^[0-9a-f]{128}$' then
    raise exception 'INVALID_PASSWORD_REQUEST' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.customers where id=p_customer_id and status='ACTIVE'
  ) then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';
  end if;
  insert into public.customer_web_access(customer_id,password_salt,password_hash,credential_version)
    values(p_customer_id,p_salt,p_hash,2)
    on conflict(customer_id) do update
      set password_salt=excluded.password_salt,
          password_hash=excluded.password_hash,
          credential_version=customer_web_access.credential_version+1,
          updated_at=now()
      where customer_web_access.password_hash is null
    returning credential_version into v_version;
  if v_version is null then
    raise exception 'PASSWORD_ALREADY_SET' using errcode='P0001';
  end if;
  return v_version;
end;
$$;
revoke execute on function public.api_claim_customer_password(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.api_claim_customer_password(uuid,text,text)
  to service_role;

create function public.api_change_customer_password(
  p_customer_id uuid, p_old_hash text, p_old_version integer,
  p_salt text, p_hash text
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if p_old_hash !~ '^[0-9a-f]{128}$' or p_old_version < 1 or
     p_salt !~ '^[0-9a-f]{32}$' or p_hash !~ '^[0-9a-f]{128}$' then
    raise exception 'INVALID_PASSWORD_REQUEST' using errcode='22023';
  end if;
  update public.customer_web_access
    set password_salt=p_salt, password_hash=p_hash,
        credential_version=credential_version+1, updated_at=now()
    where customer_id=p_customer_id and password_hash=p_old_hash
      and credential_version=p_old_version
    returning credential_version into v_version;
  if v_version is null then
    raise exception 'PASSWORD_CHANGED' using errcode='P0001';
  end if;
  return v_version;
end;
$$;
revoke execute on function public.api_change_customer_password(uuid,text,integer,text,text)
  from public,anon,authenticated;
grant execute on function public.api_change_customer_password(uuid,text,integer,text,text)
  to service_role;

commit;
