-- P3: CAL-01~05, CAL-08, CAL-12, ACC-13; ADR-0012.
create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  sort_order integer not null check (sort_order >= 0),
  color text not null check (color in ('teal', 'blue', 'green', 'purple', 'pink', 'brown')),
  unique (family_id, name),
  unique (id, family_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid references public.users(id),
  visibility text not null default 'shared' check (visibility in ('shared', 'private')),
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  is_all_day boolean not null default false,
  kind text not null default 'event' check (kind = 'event'),
  check (end_date >= start_date),
  check (end_date > start_date or start_time is null or end_time is null or end_time > start_time),
  check (visibility = 'shared' or owner_id is not null),
  check (not is_all_day or (start_time is null and end_time is null)),
  unique (id, family_id)
);
create index events_family_time_idx on public.events(family_id, start_date, start_time);

create table public.event_details (
  event_id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  place text not null default '',
  memo text not null default '',
  category_id uuid not null,
  unique (event_id, family_id),
  foreign key (event_id, family_id) references public.events(id, family_id) on delete cascade,
  foreign key (category_id, family_id) references public.event_categories(id, family_id)
);
create index event_details_category_idx on public.event_details(category_id);

alter table public.event_categories enable row level security;
alter table public.events enable row level security;
alter table public.event_details enable row level security;
revoke all on public.event_categories, public.events, public.event_details from public, anon, authenticated;
grant select on public.event_categories, public.events, public.event_details to authenticated;
create policy categories_read_family on public.event_categories for select to authenticated
  using (family_id = private.current_family_id());
create policy events_read_family on public.events for select to authenticated
  using (family_id = private.current_family_id());
create policy details_read_authorized on public.event_details for select to authenticated
  using (family_id = private.current_family_id() and exists (
    select 1 from public.events e where e.id = event_id
      and (e.visibility = 'shared' or e.owner_id = auth.uid())
  ));

-- Seed within create_family's transaction without replacing P2's RPC.
create function private.seed_event_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_categories(family_id, name, color, sort_order)
    select new.id, seed.name, seed.color,
      (row_number() over (order by seed.is_family desc, seed.name collate "C") - 1)::integer
    from (select distinct on (name) name, color, is_family from
      (values (new.name, 'teal', true), ('회사', 'blue', false), ('가족', 'green', false),
        ('약속', 'purple', false), ('병원', 'pink', false), ('기타', 'brown', false)) defaults(name, color, is_family)
      order by name, is_family desc) seed;
  return new;
end;
$$;
revoke all on function private.seed_event_categories() from public, anon, authenticated;
create trigger seed_event_categories after insert on public.families
  for each row execute function private.seed_event_categories();
insert into public.event_categories(family_id, name, color, sort_order)
  select f.id, seed.name, seed.color,
    (row_number() over (partition by f.id order by seed.is_family desc, seed.name collate "C") - 1)::integer
  from public.families f
  cross join lateral (select distinct on (name) name, color, is_family from
    (values (f.name, 'teal', true), ('회사', 'blue', false), ('가족', 'green', false),
      ('약속', 'purple', false), ('병원', 'pink', false), ('기타', 'brown', false)) defaults(name, color, is_family)
    order by name, is_family desc) seed;

-- Family lock serializes category reassignment and event writes. Caller IDs are never arguments.
create function public.save_event(
  event_id uuid, event_title text, event_place text, event_memo text,
  event_category_id uuid, event_visibility text, event_start_date date,
  event_end_date date, event_start_time time, event_end_time time, event_is_all_day boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.events;
  saved_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  if event_title is null or length(btrim(event_title)) = 0 or
     event_visibility is null or event_visibility not in ('shared', 'private') or
     event_start_date is null or event_end_date is null or event_end_date < event_start_date or
     (event_start_date = event_end_date and event_start_time is not null and event_end_time is not null
       and event_end_time <= event_start_time) or
     (event_is_all_day and (event_start_time is not null or event_end_time is not null)) or
     event_is_all_day is null then raise exception 'invalid_event'; end if;
  if not exists(select 1 from public.event_categories where id = event_category_id and family_id = family)
    then raise exception 'category_not_found'; end if;
  if event_id is null then
    insert into public.events(family_id, owner_id, visibility, start_date, end_date, start_time, end_time, is_all_day)
      values (family, auth.uid(), event_visibility, event_start_date, event_end_date,
        event_start_time, event_end_time, event_is_all_day)
      returning id into saved_id;
    insert into public.event_details(event_id, family_id, title, place, memo, category_id)
      values (saved_id, family, btrim(event_title), coalesce(event_place, ''),
        coalesce(event_memo, ''), event_category_id);
  else
    select * into target from public.events where id = event_id and family_id = family for update;
    if not found then raise exception 'event_not_found'; end if;
    if target.visibility = 'private' and target.owner_id is distinct from auth.uid()
      then raise exception 'event_forbidden'; end if;
    if event_visibility = 'private' and target.owner_id is distinct from auth.uid()
      then raise exception 'event_forbidden'; end if;
    update public.events set visibility = event_visibility, start_date = event_start_date,
      end_date = event_end_date, start_time = event_start_time, end_time = event_end_time,
      is_all_day = event_is_all_day where id = event_id;
    update public.event_details set title = btrim(event_title), place = coalesce(event_place, ''),
      memo = coalesce(event_memo, ''), category_id = event_category_id
      where event_details.event_id = save_event.event_id;
    saved_id := event_id;
  end if;
  return saved_id;
end;
$$;

create function public.delete_event(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.events;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  select * into target from public.events where id = event_id and family_id = family for update;
  if not found then raise exception 'event_not_found'; end if;
  if target.visibility = 'private' and target.owner_id is distinct from auth.uid()
    then raise exception 'event_forbidden'; end if;
  delete from public.events where id = event_id;
end;
$$;

create function public.save_event_category(
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
    category_color not in ('teal', 'blue', 'green', 'purple', 'pink', 'brown')
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

create function public.delete_event_category(category_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.event_categories;
  fallback uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  select * into target from public.event_categories where id = category_id and family_id = family for update;
  if not found then raise exception 'category_not_found'; end if;
  if target.name = '기타' then raise exception 'fallback_category'; end if;
  select id into fallback from public.event_categories where family_id = family and name = '기타';
  if fallback is null then raise exception 'category_not_found'; end if;
  update public.event_details set category_id = fallback
    where family_id = family and event_details.category_id = delete_event_category.category_id;
  delete from public.event_categories where id = category_id;
  update public.event_categories set sort_order = sort_order - 1
    where family_id = family and sort_order > target.sort_order;
end;
$$;

revoke all on function public.save_event(uuid, text, text, text, uuid, text, date, date, time, time, boolean),
  public.delete_event(uuid), public.save_event_category(uuid, text, text, integer), public.delete_event_category(uuid)
  from public, anon, authenticated;
grant execute on function public.save_event(uuid, text, text, text, uuid, text, date, date, time, time, boolean),
  public.delete_event(uuid), public.save_event_category(uuid, text, text, integer), public.delete_event_category(uuid)
  to authenticated;

-- Content is never published, including DELETEs (which cannot be protected by SELECT RLS).
-- Only time metadata invalidates clients; detail-only saves also UPDATE events in the same transaction.
alter publication supabase_realtime add table public.events;
