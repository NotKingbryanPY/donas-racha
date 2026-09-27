begin;

create table public.customer_onboarding (
  customer_id uuid not null references public.customers(id) on delete cascade,
  tutorial_version smallint not null,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','IN_PROGRESS','POSTPONED','COMPLETED')),
  last_step smallint not null default 0 check (last_step between 0 and 7),
  started_at timestamptz,
  postponed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (customer_id, tutorial_version),
  constraint customer_onboarding_version check (tutorial_version > 0)
);

create function public.preserve_completed_onboarding() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'COMPLETED' and new.status <> 'COMPLETED' then
    return old;
  end if;
  return new;
end;
$$;
create trigger preserve_completed_onboarding before update on public.customer_onboarding
  for each row execute function public.preserve_completed_onboarding();

alter table public.customer_onboarding enable row level security;
revoke all on public.customer_onboarding from public, anon, authenticated;
grant select, insert, update on public.customer_onboarding to service_role;

notify pgrst, 'reload schema';
commit;
