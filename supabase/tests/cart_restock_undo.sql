-- CART-07 INV-12 SCN-CART-4: local database only; all fixtures roll back.
begin;
do $$
declare
  purchaser uuid := gen_random_uuid();
  partner uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  stock uuid := gen_random_uuid();
  untouched_stock uuid := gen_random_uuid();
  historical_cart uuid := gen_random_uuid();
  status_stock uuid := gen_random_uuid();
  first_cart uuid := gen_random_uuid();
  second_cart uuid := gen_random_uuid();
  third_cart uuid := gen_random_uuid();
  fourth_cart uuid := gen_random_uuid();
  unit uuid;
  category uuid;
  location uuid;
  payload jsonb;
  result jsonb;
  token uuid;
  cart_before jsonb;
  stock_before jsonb;
  cart_after jsonb;
  stock_after jsonb;
  attempt integer;
begin
  insert into auth.users(id) values (purchaser), (partner), (outsider);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values (purchaser, 'google', purchaser::text, '구매자', now(), now(), 'test'),
      (partner, 'google', partner::text, '구성원', now(), now(), 'test'),
      (outsider, 'google', outsider::text, '다른가정', now(), now(), 'test');
  insert into public.families(id, name) values (household, '복원검증'), (other_household, '다른가정');
  insert into public.memberships(user_id, family_id, role)
    values (purchaser, household, 'admin'), (partner, household, 'member'),
      (outsider, other_household, 'admin');
  select id into unit from public.units where family_id = household limit 1;
  select id into category from public.inventory_categories where family_id = household limit 1;
  select id into location from public.locations where family_id = household and enabled limit 1;
  insert into public.inventory_items(id, family_id, name, mode, quantity, status, unit_id, expires_on)
    values (stock, household, '기존 재고', 'quantity', 3, 'low', unit, '2026-12-01'),
      (status_stock, household, '상태 재고', 'status', 0, 'none', null, null);
  insert into public.cart_items(id, family_id, name, quantity, unit_id,
    category_id, inventory_item_id, added_by, checked_by, is_checked)
    values (first_cart, household, '기존 재고', 2, unit, category, stock, purchaser, partner, true),
      (second_cart, household, '새 재고', 2, unit, category, null, purchaser, purchaser, true),
      (third_cart, household, '새재고', 2, unit, category, null, purchaser, partner, true),
      (fourth_cart, household, '상태 재고', 2, unit, category, status_stock, purchaser, partner, true);
  insert into public.inventory_items(id, family_id, name, mode, quantity, status, unit_id)
    values (untouched_stock, household, '반영과 무관한 재고', 'quantity', 9, 'enough', unit);
  insert into public.cart_items(id, family_id, name, quantity, unit_id, purchased_at)
    values (historical_cart, household, '지난 구매', 1, unit, now() - interval '1 day');
  select jsonb_agg(to_jsonb(c) order by c.id) into cart_before
    from public.cart_items c where c.family_id = household;
  select jsonb_agg(to_jsonb(i) order by i.id) into stock_before
    from public.inventory_items i where i.family_id = household;
  payload := jsonb_build_object('action', 'restock', 'entries', (
    select jsonb_agg(jsonb_build_object('id', id, 'quantity', 2, 'unit_id', unit,
      'category_id', category, 'location_id', location, 'expires_on', '2027-01-01') order by id)
      from public.cart_items where family_id = household and purchased_at is null
  ));
  perform set_config('request.jwt.claim.sub', purchaser::text, true);
  set local role authenticated;
  result := public.write_cart(payload);
  token := (result->>'undoToken')::uuid;
  if token is null then raise exception 'missing undo token'; end if;
  reset role;
  if exists (
    select 1 from private.cart_restock_undo u,
      jsonb_populate_recordset(null::public.cart_items, u.cart_before) c
      where u.family_id = household and c.id = historical_cart
  ) or exists (
    select 1 from private.cart_restock_undo u,
      jsonb_populate_recordset(null::public.inventory_items, u.inventory_before) i
      where u.family_id = household and i.id = untouched_stock
  ) then raise exception 'snapshot includes unrelated history or inventory'; end if;
  set local role authenticated;

  -- Private snapshots are inaccessible even to the purchaser.
  begin
    perform 1 from private.cart_restock_undo;
    raise exception 'snapshot exposed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.write_cart(payload);
    raise exception 'private write exposed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', outsider::text, true);
  begin
    perform public.undo_cart_restock(token);
    raise exception 'another family restored';
  exception when raise_exception then
    if sqlerrm <> 'restock_undo_unavailable' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', partner::text, true);
  begin
    perform public.undo_cart_restock(token);
    raise exception 'another actor restored';
  exception when raise_exception then
    if sqlerrm <> 'restock_undo_unavailable' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', purchaser::text, true);
  perform public.undo_cart_restock(token);
  begin
    perform public.undo_cart_restock(token);
    raise exception 'token reused';
  exception when raise_exception then
    if sqlerrm <> 'restock_undo_unavailable' then raise; end if;
  end;
  reset role;
  if cart_before is distinct from (select jsonb_agg(to_jsonb(c) order by c.id)
    from public.cart_items c where c.family_id = household)
    or stock_before is distinct from (select jsonb_agg(to_jsonb(i) order by i.id)
    from public.inventory_items i where i.family_id = household)
    then raise exception 'checkout not fully restored'; end if;

  -- Each kind of intervening write invalidates undo, including a change back.
  for attempt in 1..4 loop
    set local role authenticated;
    result := public.write_cart(payload);
    token := (result->>'undoToken')::uuid;
    reset role;
    if attempt = 1 then
      update public.inventory_items set quantity = quantity + 1 where id = stock;
      update public.inventory_items set quantity = quantity - 1 where id = stock;
    elsif attempt = 2 then
      update public.cart_items set is_checked = false, checked_by = null where id = first_cart;
    elsif attempt = 3 then
      update public.inventory_categories set sort_order = sort_order + 1 where id = category;
    else
      update private.cart_restock_undo set expires_at = clock_timestamp() - interval '1 second'
        where family_id = household;
    end if;
    select jsonb_agg(to_jsonb(c) order by c.id) into cart_after
      from public.cart_items c where c.family_id = household;
    select jsonb_agg(to_jsonb(i) order by i.id) into stock_after
      from public.inventory_items i where i.family_id = household;
    set local role authenticated;
    begin
      perform public.undo_cart_restock(token);
      raise exception 'conflicting undo accepted';
    exception when raise_exception then
      if sqlerrm <> 'restock_undo_unavailable' then raise; end if;
    end;
    reset role;
    if cart_after is distinct from (select jsonb_agg(to_jsonb(c) order by c.id)
      from public.cart_items c where c.family_id = household)
      or stock_after is distinct from (select jsonb_agg(to_jsonb(i) order by i.id)
      from public.inventory_items i where i.family_id = household)
      then raise exception 'conflicting state overwritten'; end if;
    update public.cart_items set purchased_at = null, is_checked = true, checked_by = partner
      where family_id = household and id <> historical_cart;
  end loop;
  -- CART-13: invalid ids cannot leave a partially deleted selection.
  set local role authenticated;
  begin
    perform public.write_cart(jsonb_build_object('action', 'delete-selected',
      'ids', jsonb_build_array(first_cart, 'invalid-uuid')));
    raise exception 'invalid selection accepted';
  exception when invalid_text_representation then null;
  end;
  reset role;
  if not exists (select 1 from public.cart_items where id = first_cart)
    then raise exception 'partial deletion'; end if;
  update public.cart_items set is_checked = false, checked_by = null where id = second_cart;
  set local role authenticated;
  perform public.write_cart(jsonb_build_object('action', 'delete-selected',
    'ids', jsonb_build_array(first_cart, second_cart, historical_cart, gen_random_uuid())));
  reset role;
  if exists (select 1 from public.cart_items where id in (first_cart, second_cart))
    or not exists (select 1 from public.cart_items where id = historical_cart)
    or not exists (select 1 from public.cart_items where id = third_cart)
    then raise exception 'incorrect selected deletion'; end if;
  perform set_config('request.jwt.claim.sub', outsider::text, true);
  set local role authenticated;
  perform public.write_cart(jsonb_build_object('action', 'delete-selected', 'ids', jsonb_build_array(third_cart)));
  reset role;
  if not exists (select 1 from public.cart_items where id = third_cart)
    then raise exception 'cross family deletion'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  begin
    perform public.undo_cart_restock(token);
    raise exception 'anonymous undo accepted';
  exception when raise_exception then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
  reset role;
end;
$$;
rollback;
