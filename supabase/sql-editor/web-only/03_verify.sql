-- Read-only; no credentials or customer personal data.
select 'inventory_rpc' as check_name,
  has_function_privilege('service_role','public.api_set_shared_inventory(uuid,jsonb,bigint)','EXECUTE') as allowed;
select 'private_archive' as check_name,
  not has_schema_privilege('anon','donas_mobile_archive','USAGE') and
  not has_schema_privilege('authenticated','donas_mobile_archive','USAGE') and
  not has_schema_privilege('service_role','donas_mobile_archive','USAGE') as protected;
select sku,name,counted,reserved_quantity,available_quantity from public.inventory_by_flavor order by sku;
select count(*) as invalid_completed from public.orders where status='COMPLETED' and payment_status<>'CONFIRMED';
select count(*) as negative_balances from public.loyalty_accounts where available_points<0;
select count(*) as active_archived_devices from donas_mobile_archive.push_devices where active;
