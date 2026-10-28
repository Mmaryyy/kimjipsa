-- P7: CART-01~10, CART-12~14, INV-12. No remote application in this phase.
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  quantity numeric not null check (quantity > 0 and quantity <> 'NaN'::numeric and quantity <> 'Infinity'::numeric),
  unit_id uuid references public.units(id) on delete restrict,
  category_id uuid references public.inventory_categories(id) on delete set null,
  memo text not null default '' check (char_length(memo) <= 1000),
  link_url text not null default '' check (link_url = '' or link_url ~ '^https?://[^[:space:]]+$'),
  added_by uuid references public.users(id),
  checked_by uuid references public.users(id),
  is_checked boolean not null default false,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  check (is_checked or checked_by is null)
);
create index cart_family_active on public.cart_items(family_id, purchased_at);
alter table public.cart_items enable row level security;
create policy cart_family_read on public.cart_items for select to authenticated
  using (family_id = private.current_family_id());
-- Writes only go through requester-scoped RPCs. Realtime shares the same read policy.
revoke all on public.cart_items from anon, authenticated;
grant select on public.cart_items to authenticated;
alter publication supabase_realtime add table public.cart_items;
alter publication supabase_realtime add table public.inventory_categories;

-- Shared category deletion/reset also moves cart references to 기타.
create function private.move_cart_category() returns trigger
language plpgsql security definer set search_path = '' as $$
declare other_id uuid;
begin
  select id into other_id from public.inventory_categories
    where family_id = old.family_id and name = '기타' and id <> old.id;
  update public.cart_items set category_id = other_id where category_id = old.id and family_id = old.family_id;
  return old;
end;
$$;
create trigger move_cart_category before delete on public.inventory_categories
  for each row execute function private.move_cart_category();
revoke all on function private.move_cart_category() from public, anon, authenticated;

-- DEC-010 mirrors shared/lib/item-name.utils.ts, including JavaScript whitespace.
create function private.normalize_cart_name(value text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(value,
    U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]', '', 'g'))
$$;
revoke all on function private.normalize_cart_name(text) from public, anon, authenticated;

-- RLS scopes both the aggregate and the representative record to the requester family.
create function public.frequent_cart_items() returns setof public.cart_items
language sql stable security invoker set search_path = '' as $$
  with purchases as (
    select c.*, private.normalize_cart_name(c.name) as normalized_name
    from public.cart_items c where c.purchased_at is not null
  ), ranked as (
    select id, count(*) over (partition by normalized_name) as purchases,
      count(*) filter (where purchased_at >= now() - interval '90 days')
        over (partition by normalized_name) as recent_purchases,
      row_number() over (partition by normalized_name order by purchased_at desc, created_at desc, id) as position
    from purchases
  )
  select c.* from ranked r join public.cart_items c on c.id = r.id
    where r.position = 1 and r.purchases >= 2
    order by r.recent_purchases desc, c.name collate "C", c.id limit 10
$$;
grant usage on schema private to authenticated;
grant execute on function private.normalize_cart_name(text) to authenticated;
revoke all on function public.frequent_cart_items() from public, anon;
grant execute on function public.frequent_cart_items() to authenticated;

-- Same family advisory lock as inventory writes: check, merge, restock and deletion serialize.
create function public.write_cart(payload jsonb) returns jsonb
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
      checked_by = case when (payload->>'checked')::boolean then actor else null end where id = target;
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
revoke all on function public.write_cart(jsonb) from public, anon, authenticated;
grant execute on function public.write_cart(jsonb) to authenticated;

-- Keep units referenced by cart entries when restoring defaults.
create or replace function public.write_inventory_meta(payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  kind text := payload->>'kind';
  action text := payload->>'action';
  target uuid := (payload->>'id')::uuid;
  entry jsonb := payload->'entry';
  table_name text;
  affected integer;
  other_category uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  if action = 'expiry' then
    if payload->>'days' is null or (payload->>'days')::numeric not between 0 and 30
      or (payload->>'days')::numeric <> trunc((payload->>'days')::numeric) then
      raise exception 'invalid_inventory';
    end if;
    update public.families set expiry_days = (payload->>'days')::integer where id = family;
    return;
  end if;
  table_name := case kind when 'categories' then 'inventory_categories'
    when 'locations' then 'locations' when 'units' then 'units' else null end;
  if table_name is null then raise exception 'invalid_inventory'; end if;
  if target is not null then
    execute format('select 1 from public.%I where id = $1 and family_id = $2', table_name) using target, family;
    get diagnostics affected = row_count;
    if affected = 0 then raise exception 'inventory_not_found'; end if;
  end if;
  if action = 'delete' and target is not null then
    if kind = 'units' and exists(
      select 1 from public.inventory_items where unit_id = target and family_id = family)
      or (kind = 'units' and exists(select 1 from public.cart_items where unit_id = target and family_id = family))
      then raise exception 'unit_in_use'; end if;
    if kind = 'categories' then
      if exists(select 1 from public.inventory_categories where id = target and name = '기타')
        then raise exception 'invalid_inventory'; end if;
      insert into public.inventory_categories(family_id, name, sort_order, icon_kind, icon_value)
        values(family, '기타', 8, 'lucide', 'tag') on conflict (family_id, name) do nothing;
      select id into other_category from public.inventory_categories where family_id = family and name = '기타';
      update public.inventory_items set category_id = other_category where category_id = target and family_id = family;
    end if;
    if kind = 'locations' then
      update public.inventory_items set location_id = null where location_id = target and family_id = family;
    end if;
    execute format('delete from public.%I where id = $1 and family_id = $2', table_name) using target, family;
  elsif action = 'reset' then
    perform private.seed_inventory_defaults(family, kind);
    if kind = 'categories' then
      select id into other_category from public.inventory_categories where family_id = family and name = '기타';
      update public.inventory_items i set category_id = other_category
        where i.family_id = family and i.category_id in (
          select id from public.inventory_categories where family_id = family and name <> all(array[
            '채소·과일','정육·수산','유제품·계란','가공식품','음료',
            '양념·소스','생활용품','건강·뷰티','기타']));
      delete from public.inventory_categories where family_id = family and name <> all(array[
        '채소·과일','정육·수산','유제품·계란','가공식품','음료',
        '양념·소스','생활용품','건강·뷰티','기타']);
    elsif kind = 'locations' then
      update public.locations set enabled = true where family_id = family;
    else
      delete from public.units u where u.family_id = family
        and u.name <> all(array['개','팩','병','봉지','캔','박스','롤','g','kg','ml','L'])
        and not exists(select 1 from public.inventory_items i where i.unit_id = u.id)
        and not exists(select 1 from public.cart_items c where c.unit_id = u.id);
    end if;
  elsif action = 'save' and entry is not null then
    if entry->>'name' is null or char_length(btrim(entry->>'name')) not between 1 and 30 then
      raise exception 'invalid_inventory';
    end if;
    if kind = 'categories' and not private.inventory_icon_valid(entry->>'icon_kind', coalesce(entry->>'icon_value', ''))
      then raise exception 'invalid_inventory'; end if;
    target := coalesce(target, gen_random_uuid());
    if kind = 'categories' then
      insert into public.inventory_categories(id, family_id, name, sort_order, icon_kind, icon_value)
        values(target, family, btrim(entry->>'name'), (entry->>'sort_order')::integer,
          entry->>'icon_kind', coalesce(entry->>'icon_value', ''))
        on conflict(id) do update set name = excluded.name, sort_order = excluded.sort_order,
          icon_kind = excluded.icon_kind, icon_value = excluded.icon_value;
    elsif kind = 'locations' then
      insert into public.locations(id, family_id, name, sort_order, enabled)
        values(target, family, btrim(entry->>'name'), (entry->>'sort_order')::integer, (entry->>'enabled')::boolean)
        on conflict(id) do update set name = excluded.name, sort_order = excluded.sort_order,
          enabled = excluded.enabled;
    else
      insert into public.units(id, family_id, name, sort_order)
        values(target, family, btrim(entry->>'name'), (entry->>'sort_order')::integer)
        on conflict(id) do update set name = excluded.name, sort_order = excluded.sort_order;
    end if;
  else raise exception 'invalid_inventory';
  end if;
exception when unique_violation then raise exception 'inventory_meta_duplicate';
end;
$$;
