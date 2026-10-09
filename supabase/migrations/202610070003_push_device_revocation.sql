begin;
-- Validate expiry/revocation before claiming FCM jobs; existing authenticated devices still work.
alter function public.api_claim_order_push(text[]) rename to api_claim_order_push_before_staff_devices;
revoke execute on function public.api_claim_order_push_before_staff_devices(text[]) from public,anon,authenticated,service_role;
create function public.api_claim_order_push(p_platforms text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  update public.push_devices d set active=false
  where d.active and (exists(select 1 from public.staff_device_credentials c where c.device_public_id=d.device_public_id
    and (c.revoked or c.expires_at<=clock_timestamp())) or
    exists(select 1 from public.app_devices a where a.device_public_id=d.device_public_id and a.status='REVOKED'));
  return public.api_claim_order_push_before_staff_devices(p_platforms);
end; $$;
revoke execute on function public.api_claim_order_push(text[]) from public,anon,authenticated;
grant execute on function public.api_claim_order_push(text[]) to service_role;
commit;
