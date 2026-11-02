-- CART-07 INV-12: one short-lived undo per family, owned by the purchaser.
create table private.cart_restock_undo (
  family_id uuid primary key references public.families(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (clock_timestamp() + interval '30 seconds'),
  cart_before jsonb not null,
  inventory_before jsonb not null
);
alter table private.cart_restock_undo enable row level security;
revoke all on private.cart_restock_undo from public, anon, authenticated;

-- Invalidating on every write also catches changes subsequently changed back.
create function private.invalidate_cart_restock_undo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := case when tg_op = 'DELETE' then old.family_id else new.family_id end;
begin
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  delete from private.cart_restock_undo where family_id = family;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.invalidate_cart_restock_undo() from public, anon, authenticated;
create trigger invalidate_cart_restock_undo before insert or update or delete on public.cart_items
  for each row execute function private.invalidate_cart_restock_undo();
create trigger invalidate_cart_restock_undo before insert or update or delete on public.inventory_items
  for each row execute function private.invalidate_cart_restock_undo();
create trigger invalidate_cart_restock_undo before insert or update or delete on public.inventory_categories
  for each row execute function private.invalidate_cart_restock_undo();
create trigger invalidate_cart_restock_undo before insert or update or delete on public.locations
  for each row execute function private.invalidate_cart_restock_undo();
create trigger invalidate_cart_restock_undo before insert or update or delete on public.units
  for each row execute function private.invalidate_cart_restock_undo();

-- Preserve the existing validation and checkout transaction in a private implementation.
alter function public.write_cart(jsonb) set schema private;
revoke all on function private.write_cart(jsonb) from public, anon, authenticated;
create function public.write_cart(payload jsonb) returns jsonb
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
      from public.cart_items c where c.family_id = family;
    select coalesce(jsonb_agg(to_jsonb(i)), '[]') into inventory_snapshot
      from public.inventory_items i where i.family_id = family;
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

create function public.undo_cart_restock(token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  snapshot private.cart_restock_undo;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  delete from private.cart_restock_undo u where u.family_id = family
    and u.actor_id = auth.uid() and u.token = undo_cart_restock.token
    and u.expires_at >= clock_timestamp()
    returning * into snapshot;
  if not found then raise exception 'restock_undo_unavailable'; end if;

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
  delete from public.inventory_items i where i.family_id = family and not exists (
    select 1 from jsonb_populate_recordset(null::public.inventory_items, snapshot.inventory_before) b
      where b.id = i.id
  );
  return '{}';
end;
$$;
revoke all on function public.undo_cart_restock(uuid) from public, anon, authenticated;
grant execute on function public.undo_cart_restock(uuid) to authenticated;
