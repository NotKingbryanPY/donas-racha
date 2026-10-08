begin;
-- Existing catalog only; no stock rewriting and no seed data.
-- Studio preflight showed the original variant timestamp trigger missing.
-- Run last among the known update triggers, so generic now() cannot overwrite
-- the monotonic catalog version. Existing rows are not rewritten.
create function public.catalog_updated_at() returns trigger
language plpgsql set search_path='' as $$
begin
  new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  return new;
end; $$;
revoke execute on function public.catalog_updated_at() from public,anon,authenticated;
create trigger zz_product_variants_catalog_version before update on public.product_variants
for each row execute function public.catalog_updated_at();
create table public.catalog_change_receipts (
  operation_id uuid primary key,
  auth_user_id uuid not null references auth.users(id),
  request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.catalog_change_receipts enable row level security;
revoke all on public.catalog_change_receipts from public,anon,authenticated;
create function public.api_update_flavor(p_auth_user_id uuid,p_operation_id uuid,p_request_hash text,
  p_variant_id uuid,p_expected_updated_at timestamptz,p_name text,p_available boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old public.catalog_change_receipts; v_variant public.product_variants; v_result jsonb;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_available is null or
    p_expected_updated_at is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,18));
  select * into v_old from public.catalog_change_receipts where operation_id=p_operation_id;
  if found then
    if v_old.auth_user_id<>p_auth_user_id or v_old.request_hash<>p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
    return v_old.result||jsonb_build_object('replayed',true);
  end if;
  perform pg_advisory_xact_lock(26092601);
  select * into v_variant from public.product_variants where id=p_variant_id for update;
  if not found then raise exception 'FLAVOR_NOT_FOUND' using errcode='P0001'; end if;
  if v_variant.updated_at<>p_expected_updated_at then raise exception 'CATALOG_CONFLICT' using errcode='P0001'; end if;
  update public.product_variants set name=btrim(p_name),available=p_available where id=p_variant_id returning * into v_variant;
  v_result:=jsonb_build_object('id',v_variant.id,'name',v_variant.name,'available',v_variant.available,
    'updatedAt',v_variant.updated_at,'replayed',false);
  insert into public.catalog_change_receipts values(p_operation_id,p_auth_user_id,p_request_hash,v_result,clock_timestamp());
  return v_result;
end; $$;
revoke execute on function public.api_update_flavor(uuid,uuid,text,uuid,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.api_update_flavor(uuid,uuid,text,uuid,timestamptz,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
