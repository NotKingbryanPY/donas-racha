-- Recovery diagnostic for a failed or truncated 02_apply_missing_20261008.sql.
-- ROLLBACK only cancels an uncommitted transaction on this connection.
-- It never reverses previously committed changes. The remaining statements read metadata only.
rollback;
with expected(name) as (
  values ('inventory_movements'),('inventory_revision'),('push_devices'),('order_push_jobs'),
    ('catalog_change_receipts'),('staff_device_invitations'),('staff_device_credentials')
), objects as (
  select name,to_regclass('public.'||name) is not null as installed from expected
), flags as (
  select
    exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='inventory_manual_counts' and column_name='movement_sequence') as movement_sequence,
    exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='app_devices' and column_name='restored_to_official') as restored_to_official,
    coalesce(position('inventory_movements' in
      pg_get_viewdef(to_regclass('public.inventory_by_flavor')))>0,false) as shared_inventory_view
), summary as (
  select (select count(*) from objects where installed) as installed_tables,
    (select jsonb_object_agg(name,installed order by name) from objects) as tables,
    movement_sequence,restored_to_official,shared_inventory_view from flags
)
select case
  when installed_tables=0 and not movement_sequence and not restored_to_official and not shared_inventory_view
    then 'READY_TO_RETRY_FULL_02'
  when installed_tables=7 and movement_sequence and restored_to_official and shared_inventory_view
    then 'OBJECTS_PRESENT_DO_NOT_REPEAT_02_RUN_05'
  else 'STOP_PARTIAL_STATE_EXPORT_00'
end as status,installed_tables,tables,movement_sequence,restored_to_official,shared_inventory_view
from summary;
