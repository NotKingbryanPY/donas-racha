begin;

create function public.api_set_customer_password_by_verified_phone(
  p_customer_id uuid, p_phone_auth_user_id uuid, p_salt text, p_hash text
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_version integer;
begin
  if p_salt !~ '^[0-9a-f]{32}$' or p_hash !~ '^[0-9a-f]{128}$' then
    raise exception 'INVALID_PASSWORD_REQUEST' using errcode='22023';
  end if;
  select * into v_customer from public.customers
    where id=p_customer_id and status='ACTIVE' for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002'; end if;
  if v_customer.whatsapp_e164 is null or not exists (
    select 1 from auth.users
    where id=p_phone_auth_user_id
      and phone=v_customer.whatsapp_e164
      and phone_confirmed_at is not null
  ) then
    raise exception 'PHONE_NOT_VERIFIED' using errcode='P0001';
  end if;
  insert into public.customer_web_access(customer_id,password_salt,password_hash,credential_version)
    values(p_customer_id,p_salt,p_hash,2)
    on conflict(customer_id) do update
      set password_salt=excluded.password_salt,
          password_hash=excluded.password_hash,
          credential_version=customer_web_access.credential_version+1,
          updated_at=now()
    returning credential_version into v_version;
  return v_version;
end;
$$;

revoke execute on function public.api_set_customer_password_by_verified_phone(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.api_set_customer_password_by_verified_phone(uuid,uuid,text,text)
  to service_role;

commit;
