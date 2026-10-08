-- Roll back the Firebase identity bridge without deleting history or touching stock.
-- Execute only when switching Android back to provisioned device/Supabase access.
-- Existing Firebase sessions lose administrative API access immediately.
begin;
update public.staff_firebase_bindings set revoked=true;
revoke execute on function public.api_bind_firebase_device(uuid,uuid,text,public.app_role,text) from service_role;
commit;
-- Re-enable only after reviewing active device authorizations:
-- grant execute on function public.api_bind_firebase_device(uuid,uuid,text,public.app_role,text) to service_role;
-- Do not mass-unrevoke bindings; each device must link again with current proof.
