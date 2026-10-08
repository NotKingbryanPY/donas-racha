-- Optional catalog publication only. API/Room clients continue to use a visible-page fallback.
-- Never publish private orders to an unauthenticated browser subscription.
begin;
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='product_variants') then
      alter publication supabase_realtime add table public.product_variants;
    end if;
  else raise notice 'No supabase_realtime publication; configure Supabase Realtime before enabling optional subscription.';
  end if;
end; $$;
commit;
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='product_variants';
