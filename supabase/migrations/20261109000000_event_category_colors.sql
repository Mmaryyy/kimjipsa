alter table public.event_categories drop constraint event_categories_color_check;
update public.event_categories set color = case color
  when 'teal' then 'sky' when 'green' then 'sage' when 'purple' then 'gray'
  when 'pink' then 'cream' when 'brown' then 'sand' else color end;
alter table public.event_categories add constraint event_categories_color_check
  check (color in ('blue', 'sky', 'cream', 'sand', 'sage', 'gray') or color ~ '^#[0-9a-f]{6}$');

create or replace function private.seed_event_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_categories(family_id, name, color, sort_order)
    select new.id, seed.name, seed.color,
      (row_number() over (order by seed.is_family desc, seed.name collate "C") - 1)::integer
    from (select distinct on (name) name, color, is_family from
      (values (new.name, 'sky', true), ('회사', 'blue', false), ('가족', 'sage', false),
        ('약속', 'gray', false), ('병원', 'cream', false), ('기타', 'sand', false)) defaults(name, color, is_family)
      order by name, is_family desc) seed;
  return new;
end;
$$;
revoke all on function private.seed_event_categories() from public, anon, authenticated;
insert into public.event_categories(family_id, name, color, sort_order)
  select f.id, seed.name, seed.color,
    (row_number() over (partition by f.id order by seed.is_family desc, seed.name collate "C") - 1)::integer
  from public.families f
  cross join lateral (select distinct on (name) name, color, is_family from
    (values (f.name, 'sky', true), ('회사', 'blue', false), ('가족', 'sage', false),
      ('약속', 'gray', false), ('병원', 'cream', false), ('기타', 'sand', false)) defaults(name, color, is_family)
    order by name, is_family desc) seed
  where not exists (select 1 from public.event_categories c where c.family_id = f.id);

create or replace function public.save_event_category(
  category_id uuid, category_name text, category_color text, category_sort_order integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.event_categories;
  saved_id uuid;
  target_order integer;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  if category_name is null or length(btrim(category_name)) = 0 or category_color is null or
    category_sort_order is null or category_sort_order < 0 or
    (category_color not in ('blue', 'sky', 'cream', 'sand', 'sage', 'gray') and category_color !~ '^#[0-9a-f]{6}$')
    then raise exception 'invalid_category'; end if;
  select least(category_sort_order, count(*)::integer) into target_order
    from public.event_categories where family_id = family;
  if category_id is null then
    update public.event_categories set sort_order = sort_order + 1
      where family_id = family and sort_order >= target_order;
    insert into public.event_categories(family_id, name, color, sort_order)
      values (family, btrim(category_name), category_color, target_order)
      returning id into saved_id;
  else
    select * into target from public.event_categories where id = category_id and family_id = family for update;
    if not found then raise exception 'category_not_found'; end if;
    -- Keep the stable fallback addressable even after edits.
    if target.name = '기타' and btrim(category_name) <> '기타' then raise exception 'fallback_category'; end if;
    select least(target_order, count(*)::integer - 1) into target_order
      from public.event_categories where family_id = family;
    if target_order < target.sort_order then
      update public.event_categories set sort_order = sort_order + 1
        where family_id = family and sort_order >= target_order and sort_order < target.sort_order;
    elsif target_order > target.sort_order then
      update public.event_categories set sort_order = sort_order - 1
        where family_id = family and sort_order > target.sort_order and sort_order <= target_order;
    end if;
    update public.event_categories set name = btrim(category_name), color = category_color, sort_order = target_order
      where id = category_id;
    saved_id := category_id;
  end if;
  return saved_id;
exception when unique_violation then raise exception 'category_duplicate';
end;
$$;

