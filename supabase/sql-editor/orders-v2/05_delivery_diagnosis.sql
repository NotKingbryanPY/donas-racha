-- Read-only: recent order/job metadata; no customer details, tokens or secrets.
select o.public_code, o.created_at, o.status,
  (select count(*) from public.push_devices pd
    where pd.active and pd.auth_mode='SUPABASE_STAFF_V2' and pd.revoked_at is null
      and exists(select 1 from public.app_user_roles r
        where r.auth_user_id=pd.auth_user_id and r.role in ('ADMIN','SELLER'))
  ) as authorized_devices,
  d.app_version, d.auth_mode, d.active as device_active,
  j.attempts, j.available_at, j.delivered_at as accepted_by_fcm_at, j.last_error
from public.orders o
left join public.order_push_jobs j on j.order_id=o.id
left join public.push_devices d on d.device_public_id=j.device_public_id
order by o.created_at desc, j.available_at desc
limit 12;
