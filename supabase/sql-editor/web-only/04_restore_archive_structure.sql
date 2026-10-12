-- Optional structural recovery only, NOT mobile reactivation. Credentials stay revoked.
-- Review with a database operator; deployed mobile endpoints still return 410.
begin;
set local lock_timeout='5s';
do $restore$
declare t record; f record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='donas_mobile_archive' and c.relkind='r' loop
    if to_regclass('public.'||t.relname) is not null then raise exception 'RESTORE_CONFLICT: %',t.relname; end if;
    execute format('alter table donas_mobile_archive.%I set schema public',t.relname);
  end loop;
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='donas_mobile_archive' loop
    execute format('alter function %s set schema public',f.oid::regprocedure);
  end loop;
end $restore$;
notify pgrst,'reload schema';
commit;
select 'STRUCTURE_RESTORED_ACCESS_STILL_REVOKED' as status;
