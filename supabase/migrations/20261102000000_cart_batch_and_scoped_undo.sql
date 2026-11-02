-- CART-13: atomic selected deletion. CART-07 INV-12: bound undo snapshots to active checkout data.
create or replace function public.write_cart(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  actor uuid := auth.uid();
  cart_snapshot jsonb;
  inventory_snapshot jsonb;
  result jsonb;
  undo_token uuid;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  if payload->>'action' = 'restock' then
    select coalesce(jsonb_agg(to_jsonb(c)), '[]') into cart_snapshot
      from public.cart_items c where c.family_id = family and c.purchased_at is null;
    select coalesce(jsonb_agg(to_jsonb(i)), '[]') into inventory_snapshot
      from public.inventory_items i where i.family_id = family and exists (
        select 1 from public.cart_items c
          join jsonb_array_elements(payload->'entries') e on c.id = (e->>'id')::uuid
          where c.family_id = family and c.purchased_at is null
            and (i.id = c.inventory_item_id or (c.inventory_item_id is null
              and private.normalize_cart_name(i.name) = private.normalize_cart_name(c.name)))
      );
  end if;
  if payload->>'action' = 'delete-selected' then
    if payload->'ids' is null or jsonb_typeof(payload->'ids') <> 'array' then
      raise exception 'invalid_cart';
    end if;
    if jsonb_array_length(payload->'ids') not between 1 and 500 then
      raise exception 'invalid_cart';
    end if;
    delete from public.cart_items c where c.family_id = family and c.purchased_at is null
      and c.id in (select value::uuid from jsonb_array_elements_text(payload->'ids'));
    return '{}';
  end if;
  result := private.write_cart(payload);
  if payload->>'action' = 'restock' then
    insert into private.cart_restock_undo(family_id, actor_id, cart_before, inventory_before)
      values(family, actor, cart_snapshot, inventory_snapshot)
      returning token into undo_token;
    result := result || jsonb_build_object('undoToken', undo_token);
  end if;
  return result;
end;
$$;
revoke all on function public.write_cart(jsonb) from public, anon, authenticated;
grant execute on function public.write_cart(jsonb) to authenticated;

create or replace function public.undo_cart_restock(token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  snapshot private.cart_restock_undo;
  created_inventory_ids uuid[];
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  delete from private.cart_restock_undo u where u.family_id = family
    and u.actor_id = auth.uid() and u.token = undo_cart_restock.token
    and u.expires_at >= clock_timestamp()
    returning * into snapshot;
  if not found then raise exception 'restock_undo_unavailable'; end if;

  -- Capture new inventory links before restoring the original cart links.
  select array_agg(c.inventory_item_id) into created_inventory_ids
    from public.cart_items c
      join jsonb_populate_recordset(null::public.cart_items, snapshot.cart_before) b on b.id = c.id
    where c.family_id = family and c.purchased_at is not null and b.purchased_at is null
      and not exists (
        select 1 from jsonb_populate_recordset(null::public.inventory_items, snapshot.inventory_before) i
          where i.id = c.inventory_item_id
      );

  -- Only restore fields checkout can change; keep all original ids and purchase history.
  update public.cart_items c set purchased_at = b.purchased_at,
    inventory_item_id = b.inventory_item_id, is_checked = b.is_checked, checked_by = b.checked_by
    from jsonb_populate_recordset(null::public.cart_items, snapshot.cart_before) b
    where c.id = b.id and c.family_id = family
      and (c.purchased_at, c.inventory_item_id, c.is_checked, c.checked_by)
        is distinct from (b.purchased_at, b.inventory_item_id, b.is_checked, b.checked_by);
  update public.inventory_items i set quantity = b.quantity, status = b.status,
    location_id = b.location_id, expires_on = b.expires_on
    from jsonb_populate_recordset(null::public.inventory_items, snapshot.inventory_before) b
    where i.id = b.id and i.family_id = family
      and (i.quantity, i.status, i.location_id, i.expires_on)
        is distinct from (b.quantity, b.status, b.location_id, b.expires_on);
  delete from public.inventory_items i where i.family_id = family and i.id = any(created_inventory_ids);
  return '{}';
end;
$$;
revoke all on function public.undo_cart_restock(uuid) from public, anon, authenticated;
grant execute on function public.undo_cart_restock(uuid) to authenticated;
