-- PJ2: PRJ-01~04. Reads use RLS and all user writes use write_project.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 100),
  description text not null default '' check (length(description) <= 1000),
  starts_on date,
  target_on date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  modules text[] not null default '{}' check (
    modules <@ array['decisions', 'lists', 'reservations', 'itinerary', 'budget']
    and array_position(modules, null) is null
  ),
  budget_limit numeric check (budget_limit >= 0),
  created_by uuid references public.users(id) on delete set null,
  sort_order integer not null default 0,
  unique (id, family_id),
  check (target_on >= starts_on)
);

create table public.project_areas (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (id, project_id, family_id),
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  area_id uuid,
  title text not null check (length(btrim(title)) between 1 and 100),
  starts_on date,
  ends_on date,
  is_tentative boolean not null default false,
  memo text not null default '' check (length(memo) <= 1000),
  event_id uuid,
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade,
  foreign key (area_id, project_id, family_id)
    references public.project_areas(id, project_id, family_id) on delete set null (area_id),
  foreign key (event_id, family_id) references public.events(id, family_id) on delete set null (event_id),
  check (
    (is_tentative and starts_on is null and ends_on is null)
    or (not is_tentative and starts_on is not null and (ends_on is null or ends_on >= starts_on))
  )
);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  area_id uuid,
  title text not null check (length(btrim(title)) between 1 and 100),
  assignee_kind text not null default 'unassigned' check (assignee_kind in ('unassigned', 'together', 'member')),
  assignee_id uuid references public.users(id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'on_hold')),
  starts_on date,
  due_on date,
  depends_note text not null default '' check (length(depends_note) <= 1000),
  memo text not null default '' check (length(memo) <= 1000),
  completed_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade,
  foreign key (area_id, project_id, family_id)
    references public.project_areas(id, project_id, family_id) on delete set null (area_id),
  check ((assignee_kind = 'member') = (assignee_id is not null)),
  check ((status = 'done') = (completed_at is not null)),
  check (completed_by is null or completed_at is not null),
  check (due_on >= starts_on)
);

create index projects_family_sort_idx on public.projects(family_id, sort_order, id);
create index project_areas_family_project_idx on public.project_areas(family_id, project_id);
create index project_milestones_family_project_idx on public.project_milestones(family_id, project_id);
create index project_milestones_event_idx on public.project_milestones(event_id) where event_id is not null;
create index project_tasks_family_project_idx on public.project_tasks(family_id, project_id);
create index project_tasks_assignee_idx on public.project_tasks(assignee_id) where assignee_id is not null;

alter table public.projects enable row level security;
alter table public.project_areas enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_tasks enable row level security;
revoke all on public.projects, public.project_areas, public.project_milestones, public.project_tasks
  from public, anon, authenticated;
grant select on public.projects, public.project_areas, public.project_milestones, public.project_tasks
  to authenticated;
create policy projects_read_family on public.projects for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_areas_read_family on public.project_areas for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_milestones_read_family on public.project_milestones for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_tasks_read_family on public.project_tasks for select to authenticated
  using (family_id = (select private.current_family_id()));

alter publication supabase_realtime add table
  public.projects, public.project_areas, public.project_milestones, public.project_tasks;

create function private.clear_project_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.project_tasks set assignee_kind = 'unassigned', assignee_id = null
    where family_id = old.family_id and assignee_id = old.user_id;
  return old;
end;
$$;
revoke all on function private.clear_project_assignee() from public, anon, authenticated;
create trigger clear_project_assignee before delete on public.memberships
  for each row execute function private.clear_project_assignee();

create function private.unlink_private_project_milestones() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.project_milestones set event_id = null
    where family_id = new.family_id and event_id = new.id;
  return new;
end;
$$;
revoke all on function private.unlink_private_project_milestones() from public, anon, authenticated;
create trigger unlink_private_project_milestones after update of visibility on public.events
  for each row when (old.visibility = 'shared' and new.visibility = 'private')
  execute function private.unlink_private_project_milestones();

create function public.write_project(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  family uuid := private.current_family_id();
  action text := payload->>'action';
  item jsonb := payload->'item';
  target_id uuid;
  parent_id uuid;
  area_ref uuid;
  assignee uuid;
  next_status text;
  field text;
  result_id uuid;
  area_count integer;
begin
  if caller is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  -- Withdrawal uses this lock before removing the membership.
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not exists(select 1 from public.memberships where user_id = caller and family_id = family)
    then raise exception 'family_required'; end if;

  target_id := (payload->>'id')::uuid;
  parent_id := (payload->>'projectId')::uuid;
  area_ref := (item->>'area_id')::uuid;
  assignee := (item->>'assignee_id')::uuid;
  if action in ('save_project', 'save_area', 'save_milestone', 'save_task') then
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'invalid_project'; end if;
    foreach field in array (case action
      when 'save_project' then array['title', 'description', 'status']
      when 'save_area' then array['name']
      when 'save_milestone' then array['title', 'memo']
      else array['title', 'assignee_kind', 'status', 'depends_note', 'memo']
    end) loop
      if jsonb_typeof(item->field) is distinct from 'string' then raise exception 'invalid_project'; end if;
    end loop;
    foreach field in array array['starts_on', 'target_on', 'ends_on', 'due_on'] loop
      if item->>field is not null and (
        jsonb_typeof(item->field) <> 'string' or item->>field !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      ) then raise exception 'invalid_project'; end if;
    end loop;
    if (action = 'save_project' and jsonb_typeof(item->'modules') is distinct from 'array')
      or (action = 'save_area' and item ? 'sort_order' and jsonb_typeof(item->'sort_order') <> 'number')
      or (action = 'save_milestone' and jsonb_typeof(item->'is_tentative') is distinct from 'boolean')
      then raise exception 'invalid_project'; end if;
  end if;

  if action = 'save_project' then
    if target_id is null then
      insert into public.projects
        (family_id, title, description, starts_on, target_on, status, modules, created_by, sort_order)
      values (family, btrim(item->>'title'), item->>'description', (item->>'starts_on')::date,
        (item->>'target_on')::date, item->>'status', array(select jsonb_array_elements_text(item->'modules')),
        caller, (select coalesce(max(sort_order), 0) + 1 from public.projects where family_id = family))
      returning id into result_id;
    else
      update public.projects set title = btrim(item->>'title'), description = item->>'description',
        starts_on = (item->>'starts_on')::date, target_on = (item->>'target_on')::date, status = item->>'status',
        modules = array(select jsonb_array_elements_text(item->'modules'))
      where id = target_id and family_id = family returning id into result_id;
    end if;
  elsif action = 'delete_project' then
    delete from public.projects where id = target_id and family_id = family returning id into result_id;
  else
    if not exists(select 1 from public.projects where id = parent_id and family_id = family)
      then raise exception 'project_not_found'; end if;
    if area_ref is not null and not exists(
      select 1 from public.project_areas where id = area_ref and project_id = parent_id and family_id = family
    ) then raise exception 'invalid_project'; end if;

    case action
      when 'save_area' then
        if target_id is null then
          insert into public.project_areas (family_id, project_id, name, sort_order)
          values (family, parent_id, btrim(item->>'name'), coalesce(
            (item->>'sort_order')::integer,
            (select least(coalesce(max(sort_order), 0)::bigint + 1, 2147483647)
              from public.project_areas where project_id = parent_id and family_id = family)
          ))
          returning id into result_id;
        else
          update public.project_areas set name = btrim(item->>'name'),
            sort_order = coalesce((item->>'sort_order')::integer, sort_order)
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
        end if;
      when 'reorder_areas' then
        if jsonb_typeof(payload->'areaIds') is distinct from 'array'
          then raise exception 'invalid_project'; end if;
        select count(*) into area_count from public.project_areas
          where project_id = parent_id and family_id = family;
        if area_count = 0 or area_count <> jsonb_array_length(payload->'areaIds')
          then raise exception 'invalid_project'; end if;

        update public.project_areas as area
        set sort_order = requested.position - 1
        from jsonb_array_elements_text(payload->'areaIds') with ordinality as requested(id, position)
        where area.id = requested.id::uuid and area.project_id = parent_id and area.family_id = family;
        get diagnostics area_count = row_count;
        if area_count <> jsonb_array_length(payload->'areaIds')
          then raise exception 'invalid_project'; end if;
        result_id := parent_id;
      when 'delete_area' then
        delete from public.project_areas where id = target_id and project_id = parent_id and family_id = family
          returning id into result_id;
      when 'save_milestone' then
        if target_id is null then
          insert into public.project_milestones
            (family_id, project_id, area_id, title, starts_on, ends_on, is_tentative, memo)
          values (family, parent_id, area_ref, btrim(item->>'title'), (item->>'starts_on')::date,
            (item->>'ends_on')::date, (item->>'is_tentative')::boolean, item->>'memo')
          returning id into result_id;
        else
          update public.project_milestones set area_id = area_ref, title = btrim(item->>'title'),
            starts_on = (item->>'starts_on')::date, ends_on = (item->>'ends_on')::date,
            is_tentative = (item->>'is_tentative')::boolean, memo = item->>'memo'
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
        end if;
      when 'delete_milestone' then
        delete from public.project_milestones where id = target_id and project_id = parent_id and family_id = family
          returning id into result_id;
      when 'save_task' then
        if assignee is not null and not exists(
          select 1 from public.memberships where user_id = assignee and family_id = family
        ) then raise exception 'invalid_project'; end if;
        next_status := item->>'status';
        if target_id is null then
          insert into public.project_tasks
            (family_id, project_id, area_id, title, assignee_kind, assignee_id, status, starts_on, due_on,
              depends_note, memo, completed_by, completed_at)
          values (family, parent_id, area_ref, btrim(item->>'title'), item->>'assignee_kind', assignee, next_status,
            (item->>'starts_on')::date, (item->>'due_on')::date, item->>'depends_note', item->>'memo',
            case when next_status = 'done' then caller end, case when next_status = 'done' then now() end)
          returning id into result_id;
        else
          update public.project_tasks set area_id = area_ref, title = btrim(item->>'title'),
            assignee_kind = item->>'assignee_kind', assignee_id = assignee, status = next_status,
            starts_on = (item->>'starts_on')::date, due_on = (item->>'due_on')::date,
            depends_note = item->>'depends_note', memo = item->>'memo',
            completed_by = case
              when next_status is distinct from 'done' then null
              when status = 'done' then completed_by
              else caller
            end,
            completed_at = case when next_status = 'done' then coalesce(completed_at, now()) end
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
        end if;
      when 'set_task_done' then
        if jsonb_typeof(payload->'done') is distinct from 'boolean'
          then raise exception 'invalid_project'; end if;
        if (payload->>'done')::boolean then
          update public.project_tasks set status = 'done',
            completed_by = case when status = 'done' then completed_by else caller end,
            completed_at = coalesce(completed_at, now())
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
        else
          update public.project_tasks set status = case when status = 'done' then 'todo' else status end,
            completed_by = null, completed_at = null
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
        end if;
      when 'delete_task' then
        delete from public.project_tasks where id = target_id and project_id = parent_id and family_id = family
          returning id into result_id;
      else raise exception 'invalid_project';
    end case;
  end if;
  if result_id is null then raise exception 'project_not_found'; end if;
  return result_id;
exception
  when data_exception or foreign_key_violation or check_violation or not_null_violation then
    raise exception 'invalid_project';
end;
$$;
revoke all on function public.write_project(jsonb) from public, anon, authenticated;
grant execute on function public.write_project(jsonb) to authenticated;
