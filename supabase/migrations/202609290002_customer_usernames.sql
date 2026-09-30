begin;

alter table public.customers add column username text;
create unique index customers_username_uq on public.customers (lower(username));

create function public.allocate_customer_username(p_name text, p_customer_id uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_words text;
  v_base text;
  v_candidate text;
  v_suffix integer := 0;
begin
  v_words := lower(translate(btrim(p_name),
    'áàäâéèëêíìïîóòöôúùüûñçÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ',
    'aaaaeeeeiiiioooouuuuncAAAAEEEEIIIIOOOOUUUUNC'));
  v_words := btrim(regexp_replace(v_words, '[^a-z0-9]+', ' ', 'g'));
  v_base := left(split_part(v_words, ' ', 1), 30);
  if v_base = '' then v_base := 'cliente'; end if;
  if split_part(v_words, ' ', 2) <> '' then
    v_base := v_base || '.' || left(split_part(v_words, ' ', 2), 30);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_base, 917));
  v_candidate := v_base;
  while exists (
    select 1 from public.customers
    where lower(username) = v_candidate and id is distinct from p_customer_id
  ) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || v_suffix::text;
  end loop;
  return v_candidate;
end;
$$;
revoke execute on function public.allocate_customer_username(text,uuid)
  from public,anon,authenticated;
grant execute on function public.allocate_customer_username(text,uuid) to service_role;

create function public.set_customer_username()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.username := public.allocate_customer_username(new.display_name,new.id);
  return new;
end;
$$;
revoke execute on function public.set_customer_username() from public,anon,authenticated;
create trigger customers_set_username before insert on public.customers
  for each row execute function public.set_customer_username();

do $$
declare v_customer record;
begin
  for v_customer in
    select id,display_name from public.customers order by registered_at,id
  loop
    update public.customers
      set username = public.allocate_customer_username(v_customer.display_name,v_customer.id)
      where id = v_customer.id;
  end loop;
end;
$$;

alter table public.customers
  alter column username set not null,
  add constraint customers_username_format
    check (username ~ '^[a-z0-9]{1,30}(\.[a-z0-9]{1,30})?[0-9]*$');

commit;
