begin;

-- Reversión completa de fase 4. Solo es segura si no existen pedidos de entrega.
drop function if exists public.api_record_order_payment(uuid, uuid, public.payment_status, uuid, text);
drop function if exists public.api_transition_order(uuid, public.order_status, uuid, text);
drop function if exists public.api_create_order(
  uuid, uuid, text, text, public.payment_method, text, text, text, jsonb
);
drop function if exists public.consume_api_rate_limit(text, text, integer, integer);
drop table if exists public.api_rate_limits;

alter table public.orders drop constraint if exists orders_delivery_location_length;
alter table public.orders drop column if exists delivery_location;
alter table public.orders alter column pickup_location_id set not null;

drop index if exists public.product_variants_available_idx;
alter table public.product_variants drop column if exists available;

alter table public.orders drop constraint if exists orders_request_hash_format;
alter table public.orders drop column if exists request_hash;

-- PostgreSQL no permite retirar de forma segura un valor individual de un enum.
-- OUT_FOR_DELIVERY queda sin uso tras esta reversión.

commit;
