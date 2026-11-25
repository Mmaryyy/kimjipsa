-- PJ4: PRJ-06 and PRJ-07.
create table public.project_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  kind text not null check (kind in ('candidates', 'people')),
  name text not null check (length(btrim(name)) between 1 and 100),
  columns jsonb not null check (jsonb_typeof(columns) = 'array'),
  tags jsonb not null check (jsonb_typeof(tags) = 'array'),
  quantity_list_id uuid,
  quantity_tag_key uuid,
  sort_order integer not null check (sort_order >= 0),
  unique (id, family_id),
  unique (id, project_id, family_id),
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade,
  foreign key (quantity_list_id, project_id, family_id)
    references public.project_lists(id, project_id, family_id) on delete set null (quantity_list_id),
  check ((quantity_list_id is null) = (quantity_tag_key is null)),
  check ((kind = 'candidates' and tags = '[]') or (kind = 'people' and quantity_list_id is null))
);

create table public.project_list_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  list_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 100),
  status text check (status in ('candidate', 'selected', 'excluded')),
  price numeric check (price between 0 and 9007199254740991),
  links text[] not null check (private.valid_project_links(links)),
  "values" jsonb not null check (jsonb_typeof("values") = 'object'),
  tags text[] not null,
  done_tags text[] not null check (done_tags <@ tags),
  memo text not null check (length(memo) <= 1000),
  sort_order integer not null check (sort_order >= 0),
  unique (id, family_id),
  foreign key (list_id, family_id) references public.project_lists(id, family_id) on delete cascade
);

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  item_id uuid not null,
  storage_path text not null unique,
  thumb_path text not null unique,
  created_by uuid references public.users(id) on delete set null,
  is_ready boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (item_id, family_id) references public.project_list_items(id, family_id) on delete cascade
);

create index project_lists_parent_idx on public.project_lists(family_id, project_id, sort_order, id);
create index project_lists_quantity_idx on public.project_lists(quantity_list_id) where quantity_list_id is not null;
create index project_list_items_parent_idx on public.project_list_items(family_id, list_id, sort_order, id);
create index project_photos_parent_idx on public.project_photos(family_id, item_id);
create index project_photos_creator_idx on public.project_photos(created_by);

alter table public.project_lists enable row level security;
alter table public.project_list_items enable row level security;
alter table public.project_photos enable row level security;
revoke all on public.project_lists, public.project_list_items, public.project_photos from public, anon, authenticated;
grant select on public.project_lists, public.project_list_items, public.project_photos to authenticated;
create policy project_lists_read on public.project_lists for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_list_items_read on public.project_list_items for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_photos_read on public.project_photos for select to authenticated
  using (family_id = (select private.current_family_id()) and is_ready);
alter publication supabase_realtime add table public.project_lists, public.project_list_items, public.project_photos;

create function private.clear_project_quantity_tag() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.quantity_tag_key := null;
  return new;
end;
$$;
create trigger project_lists_clear_quantity_tag before update of quantity_list_id on public.project_lists
  for each row when (new.quantity_list_id is null) execute function private.clear_project_quantity_tag();

create function private.valid_project_list_definitions(entries jsonb, is_column boolean) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(entries) = 'array'
    and count(*) = count(distinct entry->>'key')
    and coalesce(bool_and(coalesce(
      jsonb_typeof(entry) = 'object'
      and jsonb_typeof(entry->'key') = 'string'
      and entry->>'key' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(entry->'label') = 'string'
      and length(btrim(entry->>'label')) between 1 and 100
      and case when is_column then
        entry->>'type' in ('text', 'number', 'money', 'select')
        and jsonb_typeof(entry->'options') = 'array'
        and case when entry->>'type' = 'select' then
          (select count(*) > 0 and count(*) = count(distinct opt)
            and bool_and(jsonb_typeof(opt) = 'string' and length(btrim(opt #>> '{}')) between 1 and 100)
           from jsonb_array_elements(entry->'options') as options(opt))
        else entry->'options' = '[]' end
      else true end, false)), true)
  from jsonb_array_elements(entries) as definitions(entry);
$$;

create function private.valid_project_list_values(definitions jsonb, entries jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(entries) = 'object' and not exists (
    select 1 from jsonb_each(entries) as field(key, value)
    left join lateral (
      select entry from jsonb_array_elements(definitions) as definition(entry) where entry->>'key' = field.key
    ) as column_definition on true
    where not case entry->>'type'
      when 'text' then jsonb_typeof(value) = 'string' and length(value #>> '{}') <= 1000
      when 'number' then case when jsonb_typeof(value) = 'number'
        then abs((value #>> '{}')::numeric) <= 1.7976931348623157e308 else false end
      when 'money' then case when jsonb_typeof(value) = 'number'
        then (value #>> '{}')::numeric between 0 and 9007199254740991 else false end
      when 'select' then jsonb_typeof(value) = 'string' and (entry->'options') @> jsonb_build_array(value)
      else false
    end
  );
$$;

create function private.queue_project_photo_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.agent_file_deletions(path)
    values ('project-photos:' || old.storage_path), ('project-photos:' || old.thumb_path)
    on conflict do nothing;
  return old;
end;
$$;
revoke all on function private.queue_project_photo_deletion() from public, anon, authenticated;
create trigger project_photo_delete before delete on public.project_photos
  for each row execute function private.queue_project_photo_deletion();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('project-photos', 'project-photos', false, 1048576, array['image/jpeg']);

create function private.can_access_project_photo(object_path text, uploading boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if uploading then
    perform 1 from public.project_photos photo
      join public.project_list_items item on item.id = photo.item_id and item.family_id = photo.family_id
      join public.project_lists list on list.id = item.list_id and list.family_id = item.family_id
      join public.projects project on project.id = list.project_id and project.family_id = list.family_id
      where photo.family_id = private.current_family_id() and photo.created_by = auth.uid()
        and not photo.is_ready and object_path in (photo.storage_path, photo.thumb_path)
        and 'lists' = any(project.modules)
      for key share of photo;
    return found;
  end if;
  return exists (
    select 1 from public.project_photos photo
      join public.project_list_items item on item.id = photo.item_id and item.family_id = photo.family_id
      join public.project_lists list on list.id = item.list_id and list.family_id = item.family_id
      join public.projects project on project.id = list.project_id and project.family_id = list.family_id
      where photo.family_id = private.current_family_id()
        and photo.is_ready and object_path in (photo.storage_path, photo.thumb_path)
        and 'lists' = any(project.modules)
  );
end;
$$;
revoke all on function private.can_access_project_photo(text, boolean) from public, anon, authenticated;
grant execute on function private.can_access_project_photo(text, boolean) to authenticated;
create policy project_photo_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'project-photos' and private.can_access_project_photo(name, true));
create policy project_photo_read on storage.objects for select to authenticated
  using (bucket_id = 'project-photos' and private.can_access_project_photo(name, false));

create function public.write_project_list(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  family uuid := private.current_family_id();
  project uuid := (payload->>'projectId')::uuid;
  list_id_input uuid := (payload->>'listId')::uuid;
  target uuid := (payload->>'id')::uuid;
  operation text := payload->>'action';
  item jsonb := payload->'item';
  list public.project_lists;
  current_list public.project_lists;
  list_item public.project_list_items;
  tag_key text := payload->>'tagKey';
  tag_keys text[];
  column_keys text[];
  blocked_items text;
  photo_id uuid;
  photo_path text;
  result uuid;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not exists (
    select 1 from public.projects where id = project and family_id = family
      and ('lists' = any(modules) or operation = 'cancel_list_photo')
  ) then raise exception 'project_not_found'; end if;

  if operation in ('save_list', 'delete_list', 'disconnect_list_quantity') then
    list_id_input := target;
  end if;
  if list_id_input is not null then
    select * into current_list from public.project_lists
      where id = list_id_input and family_id = family and project_id = project;
    if not found then raise exception 'project_not_found'; end if;
  elsif operation is distinct from 'save_list' then
    raise exception 'invalid_project';
  end if;

  case operation
    when 'save_list' then
      if coalesce(jsonb_typeof(item->'name'), '') <> 'string'
        then raise exception 'invalid_project'; end if;
      list := jsonb_populate_record(null::public.project_lists, item);
      if not coalesce(private.valid_project_list_definitions(list.columns, true), false)
        or not coalesce(private.valid_project_list_definitions(list.tags, false), false)
        or (current_list.id is not null and list.kind is distinct from current_list.kind)
      then raise exception 'invalid_project'; end if;

      if list.quantity_list_id is not null and not exists (
        select 1 from public.project_lists roster
        where roster.id = list.quantity_list_id and roster.family_id = family and roster.project_id = project
          and roster.kind = 'people'
          and roster.tags @> jsonb_build_array(jsonb_build_object('key', list.quantity_tag_key))
      ) then raise exception 'invalid_project'; end if;

      if target is null then
        insert into public.project_lists (family_id, project_id, kind, name, columns, tags,
          quantity_list_id, quantity_tag_key, sort_order)
          values (family, project, list.kind, btrim(list.name), list.columns, list.tags,
            list.quantity_list_id, list.quantity_tag_key,
            (select coalesce(max(sort_order) + 1, 0) from public.project_lists where project_id = project))
          returning id into result;
      else
        column_keys := array(select entry->>'key' from jsonb_array_elements(list.columns) as definitions(entry));
        tag_keys := array(select entry->>'key' from jsonb_array_elements(list.tags) as definitions(entry));
        select string_agg('‘' || title || '’', ', ' order by sort_order, id) into blocked_items
          from public.project_list_items
          where list_id = target and family_id = family
            and not private.valid_project_list_values(list.columns, (
              select coalesce(jsonb_object_agg(key, value), '{}')
              from jsonb_each("values") where key = any(column_keys)
            ));
        if blocked_items is not null then
          raise exception 'project_columns_in_use' using detail = blocked_items;
        end if;
        update public.project_list_items as existing set
          "values" = (select coalesce(jsonb_object_agg(key, value), '{}') from jsonb_each(existing."values")
            where key = any(column_keys)),
          tags = array(select key from unnest(existing.tags) as tags(key) where key = any(tag_keys)),
          done_tags = array(select key from unnest(existing.done_tags) as tags(key) where key = any(tag_keys))
          where existing.list_id = target and existing.family_id = family
            and (not existing.tags <@ tag_keys or exists (
              select 1 from jsonb_object_keys(existing."values") as fields(key) where not key = any(column_keys)
            ));
        update public.project_lists set quantity_list_id = null, quantity_tag_key = null
          where quantity_list_id = target and family_id = family and not quantity_tag_key::text = any(tag_keys);
        update public.project_lists set name = btrim(list.name), columns = list.columns, tags = list.tags,
          quantity_list_id = list.quantity_list_id, quantity_tag_key = list.quantity_tag_key
          where id = target and family_id = family returning id into result;
      end if;

    when 'delete_list' then
      update public.project_lists set quantity_list_id = null, quantity_tag_key = null
        where quantity_list_id = target and family_id = family;
      delete from public.project_lists where id = target and family_id = family returning id into result;

    when 'disconnect_list_quantity' then
      update public.project_lists set quantity_list_id = null, quantity_tag_key = null
        where id = target and family_id = family and kind = 'candidates' returning id into result;

    when 'save_list_item' then
      if coalesce(jsonb_typeof(item->'title'), '') <> 'string'
        or coalesce(jsonb_typeof(item->'memo'), '') <> 'string'
        or (item->'price' is not null and jsonb_typeof(item->'price') not in ('number', 'null'))
        then raise exception 'invalid_project'; end if;
      if exists (select 1 from jsonb_array_elements(item->'links') as link(value)
        where jsonb_typeof(value) <> 'string') then raise exception 'invalid_project'; end if;
      list_item := jsonb_populate_record(null::public.project_list_items, item);
      tag_keys := array(select entry->>'key' from jsonb_array_elements(current_list.tags) as definitions(entry));
      if not coalesce(private.valid_project_list_values(current_list.columns, list_item."values"), false)
        or not coalesce(list_item.tags <@ tag_keys and list_item.done_tags <@ list_item.tags, false)
        or cardinality(list_item.tags) <> (select count(distinct key) from unnest(list_item.tags) as tags(key))
        or cardinality(list_item.done_tags) <> (
          select count(distinct key) from unnest(list_item.done_tags) as tags(key)
        )
        or (current_list.kind = 'candidates' and list_item.status is null)
        or (current_list.kind = 'people' and (list_item.status is not null or list_item.price is not null
          or list_item.links <> '{}'))
      then raise exception 'invalid_project'; end if;

      if target is null then
        insert into public.project_list_items (family_id, list_id, title, status, price,
          links, "values", tags, done_tags, memo, sort_order)
          values (family, current_list.id, btrim(list_item.title), list_item.status, list_item.price,
            list_item.links, list_item."values", list_item.tags, list_item.done_tags, list_item.memo,
            (select coalesce(max(sort_order) + 1, 0) from public.project_list_items
              where list_id = current_list.id))
          returning id into result;
      else
        update public.project_list_items set title = btrim(list_item.title), status = list_item.status,
          price = list_item.price, links = list_item.links, "values" = list_item."values",
          tags = list_item.tags, done_tags = array(
            select key from unnest(done_tags) as tags(key) where key = any(list_item.tags)
          ), memo = list_item.memo
          where id = target and list_id = current_list.id and family_id = family returning id into result;
      end if;

    when 'delete_list_item' then
      delete from public.project_list_items where id = target and list_id = current_list.id and family_id = family
        returning id into result;

    when 'set_list_tag_done' then
      if current_list.kind <> 'people' or coalesce(jsonb_typeof(payload->'done'), '') <> 'boolean'
        then raise exception 'invalid_project'; end if;
      update public.project_list_items set done_tags = case
        when (payload->>'done')::boolean then array_append(array_remove(done_tags, tag_key), tag_key)
        else array_remove(done_tags, tag_key) end
        where id = target and list_id = current_list.id and family_id = family and tag_key = any(tags)
        returning id into result;

    when 'reserve_list_photo' then
      if current_list.kind <> 'candidates' or not exists (
        select 1 from public.project_list_items where id = target and list_id = current_list.id and family_id = family
      ) then raise exception 'project_not_found'; end if;
      photo_id := gen_random_uuid();
      photo_path := family::text || '/' || target::text || '/' || photo_id::text;
      insert into public.project_photos (id, family_id, item_id, storage_path, thumb_path, created_by)
        values (photo_id, family, target, photo_path || '.jpg', photo_path || '-thumb.jpg', actor)
        returning id into result;

    when 'finalize_list_photo' then
      select photo.id into photo_id
        from public.project_photos photo
        join public.project_list_items parent_item
          on parent_item.id = photo.item_id and parent_item.family_id = photo.family_id
        where photo.id = (payload->>'photoId')::uuid and photo.item_id = target and photo.family_id = family
          and photo.created_by = actor and parent_item.list_id = current_list.id
        for update of photo;
      if not found then raise exception 'project_not_found'; end if;
      update public.project_photos photo set is_ready = true
        where photo.id = photo_id and (
          select count(*) from storage.objects
          where bucket_id = 'project-photos' and name in (photo.storage_path, photo.thumb_path)
        ) = 2
        returning photo.id into result;
      if result is null then raise exception 'photo_upload_failed'; end if;

    when 'delete_list_photo', 'cancel_list_photo' then
      delete from public.project_photos photo using public.project_list_items parent_item
        where photo.id = (payload->>'photoId')::uuid and photo.item_id = target and photo.family_id = family
          and parent_item.id = target and parent_item.list_id = current_list.id and parent_item.family_id = family
          and (
            (operation = 'delete_list_photo' and photo.is_ready)
            or (operation = 'cancel_list_photo' and not photo.is_ready and photo.created_by = actor)
          )
        returning photo.id into result;

    else raise exception 'invalid_project';
  end case;
  if result is null then raise exception 'project_not_found'; end if;
  return result;
exception
  when data_exception or foreign_key_violation or check_violation or not_null_violation then
    raise exception 'invalid_project';
end;
$$;
revoke all on function public.write_project_list(jsonb) from public, anon, authenticated;
grant execute on function public.write_project_list(jsonb) to authenticated;

notify pgrst, 'reload schema';
