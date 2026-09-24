begin;

do $$ begin
  if exists (
    select 1 from public.sync_operations
    where operation_type in ('SESSION_START','SESSION_CLOSE','REVERSAL','TRANSFER')
  ) then
    raise exception 'NEW_EVENT_TYPES_EXIST';
  end if;
end $$;

alter table public.sync_operations drop constraint sync_operations_type_check;
alter table public.sync_operations
  add constraint sync_operations_type_check check (operation_type in (
    'SEED','OPENING_BALANCE','SALE','PURCHASE','EXPENSE','LOAN',
    'LOAN_PAYMENT','PARTNER_PAYMENT','ADJUSTMENT','SESSION'
  ));

commit;
