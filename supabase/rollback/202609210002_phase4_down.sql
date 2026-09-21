begin;

drop function if exists public.api_record_order_payment(uuid, uuid, public.payment_status, uuid, text);
drop function if exists public.api_transition_order(uuid, public.order_status, uuid, text);
drop function if exists public.api_create_order(uuid, uuid, text, uuid, public.payment_method, text, text, text, jsonb);
drop function if exists public.consume_api_rate_limit(text, text, integer, integer);
drop table if exists public.api_rate_limits;
alter table public.orders drop constraint if exists orders_request_hash_format;
alter table public.orders drop column if exists request_hash;

commit;
