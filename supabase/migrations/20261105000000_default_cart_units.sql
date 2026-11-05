create or replace function private.seed_inventory_defaults(family uuid, kind text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if kind is null or kind = 'categories' then
    insert into public.inventory_categories(family_id, name, sort_order, icon_kind, icon_value)
      select family, name, ord::integer - 1, 'lucide', icon from
      unnest(array[
        '채소·과일','정육·수산','유제품·계란','가공식품','음료',
        '양념·소스','생활용품','건강·뷰티','기타'],
      array['carrot','beef','milk','pizza','cup-soda','flask-round','soap-dispenser-droplet','heart-pulse','tag'])
      with ordinality seed(name, icon, ord) on conflict (family_id, name)
      do update set sort_order = excluded.sort_order, icon_kind = excluded.icon_kind, icon_value = excluded.icon_value;
  end if;
  if kind is null or kind = 'locations' then
    insert into public.locations(family_id, name, sort_order)
      select family, name, ord::integer - 1 from
      unnest(array['냉장실','냉동실','실온 식품장·팬트리','욕실·세탁실','서랍·수납장'])
      with ordinality seed(name, ord) on conflict (family_id, name)
      do update set sort_order = excluded.sort_order;
  end if;
  if kind is null or kind = 'units' then
    insert into public.units(family_id, name, sort_order)
      select family, name, ord::integer - 1 from
      unnest(array['개','팩','병','봉지','캔','박스','롤','g','kg','ml','L'])
      with ordinality seed(name, ord) on conflict (family_id, name) do nothing;
    insert into public.units(family_id, name, sort_order)
      select family, name,
        (select coalesce(max(sort_order), -1) from public.units where family_id = family) + ord::integer
      from unnest(array['통','번들']) with ordinality seed(name, ord)
      on conflict (family_id, name) do nothing;
  end if;
end;
$$;

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
        and u.name <> all(array['개','팩','병','봉지','캔','박스','롤','g','kg','ml','L','통','번들'])
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

-- Preserve existing unit IDs and append new defaults after each family's last unit.
insert into public.units(family_id, name, sort_order)
  select f.id, seed.name, coalesce(last_unit.sort_order, -1) + seed.ord::integer
  from public.families f
  left join lateral (
    select max(u.sort_order) as sort_order from public.units u where u.family_id = f.id
  ) last_unit on true
  cross join unnest(array['통','번들']) with ordinality seed(name, ord)
  on conflict (family_id, name) do nothing;
