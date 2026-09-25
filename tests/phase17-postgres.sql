-- Run only against a disposable PostgreSQL database after all migrations.
begin;
do $test$
declare
  v_customer public.customers%rowtype;
  v_replay public.customers%rowtype;
  v_result jsonb;
  v_key uuid := gen_random_uuid();
  v_product uuid;
  v_variant uuid;
  v_order uuid;
  v_actor uuid := gen_random_uuid();
begin
  v_customer := public.api_register_customer('CTESTCUTOVER123','Cliente prueba','+50760001111',v_key);
  v_replay := public.api_register_customer('CIGNORED123','Cliente prueba','+50760001111',v_key);
  if v_replay.id <> v_customer.id then raise exception 'registration replay created another customer'; end if;
  if (select count(*) from public.loyalty_accounts where customer_id=v_customer.id) <> 1 then
    raise exception 'registration missing loyalty account';
  end if;
  v_key := gen_random_uuid();
  v_result := public.api_credit_purchase(v_customer.id,v_key,'SELLER');
  if (v_result->>'pointsEarned')::integer <> 10 then raise exception 'first purchase points mismatch'; end if;
  v_result := public.api_credit_purchase(v_customer.id,v_key,'SELLER');
  if not (v_result->>'replayed')::boolean then raise exception 'purchase replay was not idempotent'; end if;
  v_result := public.api_credit_purchase(v_customer.id,gen_random_uuid(),'SELLER');
  if (v_result->>'credited')::boolean then raise exception 'same-day purchase earned twice'; end if;

  -- A paid delivery on a later business day awards points only at completion.
  update public.customers set registered_at=now()-interval '2 days',
    last_purchase_at=now()-interval '1 day' where id=v_customer.id;
  insert into auth.users(id) values(v_actor);
  insert into public.products(slug,name) values('cutover-test','Dona test') returning id into v_product;
  insert into public.product_variants(product_id,sku,name,unit_price_cents)
    values(v_product,'CUTOVERTEST','Chocolate',100) returning id into v_variant;
  select id into v_order from public.api_create_order_by_customer_id(
    v_customer.id,gen_random_uuid(),repeat('a',64),'Edificio de pruebas','CASH',null,
    jsonb_build_array(jsonb_build_object('product_variant_id',v_variant,'quantity',1)));
  if (select purchase_count from public.loyalty_accounts where customer_id=v_customer.id) <> 1 then
    raise exception 'order placement awarded points before payment';
  end if;
  perform public.api_record_order_payment(v_order,gen_random_uuid(),'CONFIRMED',v_actor,null);
  perform public.api_transition_order(v_order,'ACCEPTED',v_actor,null);
  perform public.api_transition_order(v_order,'OUT_FOR_DELIVERY',v_actor,null);
  perform public.api_transition_order(v_order,'COMPLETED',v_actor,null);
  if (select purchase_count from public.loyalty_accounts where customer_id=v_customer.id) <> 2 then
    raise exception 'paid completion did not award points';
  end if;
  perform public.api_transition_order(v_order,'COMPLETED',v_actor,null);
  if (select purchase_count from public.loyalty_accounts where customer_id=v_customer.id) <> 2 then
    raise exception 'completion replay awarded twice';
  end if;

  -- Redemption updates the ledger and balance atomically.
  update public.loyalty_accounts set available_points=100,lifetime_points=100,purchase_points=100
    where customer_id=v_customer.id;
  v_result := public.api_redeem_customer_reward(v_customer.id,'DESC_10',gen_random_uuid());
  if (v_result->>'pointsAvailable')::integer <> 40 then raise exception 'redemption balance mismatch'; end if;
  if (select count(*) from public.reward_redemptions where customer_id=v_customer.id) <> 1 then
    raise exception 'redemption missing';
  end if;
end $test$;
rollback;
