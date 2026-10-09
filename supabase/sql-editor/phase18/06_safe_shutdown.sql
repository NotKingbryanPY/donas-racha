-- Reversible shutdown, preserves tables/audit/data. Old privileged sessions still require staff roles.
-- First deploy clients/API without pilot provisioning/catalog editing; then run.
begin;
update public.staff_device_credentials set revoked=true;
update public.push_devices d set active=false where exists(select 1 from public.staff_device_credentials c where c.device_public_id=d.device_public_id);
revoke execute on function public.api_issue_staff_invitation(uuid,text,text),public.api_claim_staff_invitation(text,uuid,text),public.api_update_flavor(uuid,uuid,text,uuid,timestamptz,text,boolean) from service_role;
commit;
-- Restore service_role EXECUTE only after fixing clients and explicitly reprovision each device.
-- Do not restore names/availability automatically: later legitimate edits might exist.
-- Do not DROP tables with operational receipts or clear Room/Android application data.
