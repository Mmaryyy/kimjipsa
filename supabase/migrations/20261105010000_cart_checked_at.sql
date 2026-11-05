-- d125: CART-03 home summary records the latest check, without guessing historical timestamps.
alter table public.cart_items add column checked_at timestamptz;
alter table public.cart_items add constraint cart_items_checked_at_consistent
  check (is_checked or checked_at is null);

create or replace function private.write_cart(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  actor uuid := auth.uid();
  action text := payload->>'action';
  target uuid := (payload->>'id')::uuid;
  item jsonb := payload->'item';
  current_cart public.cart_items;
  current_inventory public.inventory_items;
  entry jsonb;
  results jsonb := '[]';
  ids uuid[];
  counter integer := 0;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  if target is not null then
    select * into current_cart from public.cart_items
      where id = target and family_id = family and purchased_at is null for update;
    if not found then raise exception 'cart_not_found'; end if;
  end if;
  if action in ('add', 'save') then
    if item is null or item->>'name' is null or private.normalize_cart_name(item->>'name') = ''
      or (item->>'quantity') is null
      or (item->>'quantity')::numeric <= 0 or (item->>'quantity')::numeric in ('NaN'::numeric, 'Infinity'::numeric)
      or (action = 'save' and target is null)
      then raise exception 'invalid_cart'; end if;
    if (item->>'unit_id') is not null and not exists(
      select 1 from public.units where id = (item->>'unit_id')::uuid and family_id = family)
      then raise exception 'invalid_cart'; end if;
    if (item->>'category_id') is not null and not exists(
      select 1 from public.inventory_categories where id = (item->>'category_id')::uuid and family_id = family)
      then raise exception 'invalid_cart'; end if;
    if (item->>'inventory_item_id') is not null and not exists(
      select 1 from public.inventory_items where id = (item->>'inventory_item_id')::uuid and family_id = family)
      then raise exception 'invalid_cart'; end if;
    if action = 'add' then
      select * into current_cart from public.cart_items where family_id = family and purchased_at is null
        and private.normalize_cart_name(name) = private.normalize_cart_name(item->>'name')
        order by id limit 1;
      if found then
        if coalesce(payload->>'duplicate', 'ask') = 'ask' then
          return jsonb_build_object('duplicate', to_jsonb(current_cart));
        elsif payload->>'duplicate' = 'merge' then
          -- A quantity merge never silently converts incompatible units.
          if current_cart.unit_id is distinct
            from (item->>'unit_id')::uuid then raise exception 'cart_unit_mismatch'; end if;
          update public.cart_items set quantity = quantity + (item->>'quantity')::numeric where id = current_cart.id;
          return '{}';
        elsif payload->>'duplicate' <> 'separate' then raise exception 'invalid_cart'; end if;
      end if;
    end if;
    insert into public.cart_items(id, family_id, name, quantity, unit_id, category_id, memo, link_url, added_by,
      inventory_item_id)
      values(coalesce(target, gen_random_uuid()), family, btrim(item->>'name'), (item->>'quantity')::numeric,
        (item->>'unit_id')::uuid, (item->>'category_id')::uuid, coalesce(item->>'memo',''),
          coalesce(item->>'link_url',''),
        actor, (item->>'inventory_item_id')::uuid)
      on conflict(id) do update set name = excluded.name, quantity = excluded.quantity, unit_id = excluded.unit_id,
        category_id = excluded.category_id, memo = excluded.memo, link_url = excluded.link_url,
        inventory_item_id = excluded.inventory_item_id returning * into current_cart;
    return jsonb_build_object('item', to_jsonb(current_cart));
  elsif action = 'check' and target is not null then
    if jsonb_typeof(payload->'checked') <> 'boolean'
      or payload->'checked' is null then raise exception 'invalid_cart'; end if;
    update public.cart_items set is_checked = (payload->>'checked')::boolean,
      checked_by = case when (payload->>'checked')::boolean then actor else null end,
      checked_at = case when (payload->>'checked')::boolean then now() else null end where id = target
      and is_checked is distinct from (payload->>'checked')::boolean;
  elsif action = 'delete' and target is not null then
    delete from public.cart_items where id = target;
  elsif action in ('clear-checked', 'order') then
    if payload->'ids' is null or jsonb_typeof(payload->'ids') <> 'array'
      or jsonb_array_length(payload->'ids') not between 1 and 500
      then raise exception 'invalid_cart'; end if;
    select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'ids');
    if action = 'clear-checked' then
      delete from public.cart_items where family_id = family and id = any(ids) and is_checked and purchased_at is null;
    else
      if cardinality(ids) <> (select count(distinct unnest_id) from unnest(ids) unnest_id)
        or cardinality(ids) <> (select count(*) from public.inventory_categories where family_id = family)
        or exists(select 1 from unnest(ids) i where not exists(
          select 1 from public.inventory_categories c where c.id = i and c.family_id = family))
        then raise exception 'invalid_cart'; end if;
      update public.inventory_categories c set sort_order = position.ordinality - 1
        from unnest(ids) with ordinality position(id, ordinality) where c.id = position.id and c.family_id = family;
    end if;
  elsif action = 'restock' then
    if payload->'entries' is null or jsonb_typeof(payload->'entries') <> 'array'
      or jsonb_array_length(payload->'entries') not between 1 and 500
      then raise exception 'invalid_cart'; end if;
    if (select count(distinct value->>'id') from jsonb_array_elements(payload->'entries'))
      <> jsonb_array_length(payload->'entries') then raise exception 'invalid_cart'; end if;
    for entry in select value from jsonb_array_elements(payload->'entries') loop
      select * into current_cart from public.cart_items where id = (entry->>'id')::uuid
        and family_id = family and is_checked and purchased_at is null for update;
      if not found then raise exception 'cart_changed'; end if;
      select * into current_inventory from public.inventory_items where family_id = family and
        (id = current_cart.inventory_item_id or (current_cart.inventory_item_id is null and
          private.normalize_cart_name(name) = private.normalize_cart_name(current_cart.name)))
        order by id limit 1 for update;
      if (entry->>'quantity') is null or (entry->>'quantity')::numeric <= 0
        or (entry->>'quantity')::numeric in ('NaN'::numeric, 'Infinity'::numeric)
        then raise exception 'invalid_cart'; end if;
      if not exists(select 1 from public.units where id = (entry->>'unit_id')::uuid and family_id = family)
        or not exists(select 1 from public.inventory_categories where id = (entry->>'category_id')::uuid
          and family_id = family)
        or not exists(select 1 from public.locations where id = (entry->>'location_id')::uuid and family_id = family
          and (enabled or id = current_inventory.location_id)) then raise exception 'invalid_cart'; end if;
      if current_inventory.id is not null then
        if current_inventory.mode = 'quantity' and current_inventory.unit_id is distinct from (entry->>'unit_id')::uuid
          then raise exception 'cart_unit_mismatch'; end if;
        update public.inventory_items set
          quantity = case when mode = 'quantity' then quantity + (entry->>'quantity')::numeric else quantity end,
          status = 'enough', location_id = (entry->>'location_id')::uuid, expires_on = (entry->>'expires_on')::date
          where id = current_inventory.id returning * into current_inventory;
      else
        insert into public.inventory_items(family_id, name, mode, quantity, status, unit_id, category_id,
          location_id, expires_on)
          values(family, current_cart.name, 'quantity', (entry->>'quantity')::numeric, 'enough',
            (entry->>'unit_id')::uuid, (entry->>'category_id')::uuid, (entry->>'location_id')::uuid,
            (entry->>'expires_on')::date) returning * into current_inventory;
      end if;
      update public.cart_items set purchased_at = now(), inventory_item_id = current_inventory.id
        where id = current_cart.id;
      results := results || jsonb_build_array(jsonb_build_object('name', current_inventory.name,
        'quantity', current_inventory.quantity, 'status', current_inventory.status, 'unit_id',
          current_inventory.unit_id));
      counter := counter + 1;
    end loop;
    return jsonb_build_object('results', results);
  else raise exception 'invalid_cart'; end if;
  return '{}';
end;
$$;
revoke all on function private.write_cart(jsonb) from public, anon, authenticated;
