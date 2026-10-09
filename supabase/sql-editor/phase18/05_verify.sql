-- READ ONLY: no customer identities/tokens; all anomaly counts should be zero.
select count(*) as negative_balances from public.loyalty_accounts where available_points<0 or lifetime_points<available_points;
select count(*) as duplicate_operations from (select device_id,client_operation_id from public.sync_operations group by 1,2 having count(*)>1) x;
select count(*) as orphan_push_jobs from public.order_push_jobs j left join public.orders o on o.id=j.order_id where o.id is null;
select count(*) as duplicate_push_jobs from (select order_id,device_public_id from public.order_push_jobs group by 1,2 having count(*)>1) x;
select count(*) as active_revoked_push from public.push_devices d join public.staff_device_credentials c using(device_public_id) where d.active and c.revoked;
select count(*) as invalid_completed from public.orders where status='COMPLETED' and payment_status<>'CONFIRMED';
select count(*) as catalog_change_receipts_count from public.catalog_change_receipts;
select pv.sku,pv.name,pv.available as commercial_offer,pv.active,i.available_quantity,i.reserved_quantity,i.counted
from public.product_variants pv left join public.inventory_by_flavor i on i.variant_id=pv.id order by pv.sku;
select role,has_table_privilege(role,'public.staff_device_credentials','SELECT') as private_credentials_read,
 has_function_privilege(role,'public.api_update_flavor(uuid,uuid,text,uuid,timestamptz,text,boolean)','EXECUTE') as privileged_catalog_rpc
from unnest(array['anon','authenticated']) role;
select p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig from pg_proc p
join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('api_update_flavor','api_issue_staff_invitation','api_claim_staff_invitation','api_revoke_staff_device','api_claim_order_push');
