-- CAL-18 / SCN-CAL-11
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (title ~ '[^[:space:]]'),
  due_on date check (due_on between date '0001-01-01' and date '9999-12-31'),
  visibility text not null default 'shared' check (visibility in ('shared', 'private')),
  owner_id uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility = 'shared' or owner_id is not null),
  check (completed_at is not null or completed_by is null)
);
create index todos_family_id_idx on public.todos (family_id, id);
create index todos_owner_id_idx on public.todos (owner_id);
create index todos_completed_by_idx on public.todos (completed_by);

alter table public.todos enable row level security;
revoke all on public.todos from public, anon, authenticated;
grant select on public.todos to authenticated;
create policy todos_visible on public.todos for select to authenticated
  using (family_id = (select private.current_family_id())
    and (visibility = 'shared' or owner_id = (select auth.uid())));

-- The last delete per caller matches the undo toast and preserves the original row.
create table private.todo_undo (
  actor_id uuid primary key references public.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  snapshot public.todos not null,
  expires_at timestamptz not null
);
alter table private.todo_undo enable row level security;
revoke all on private.todo_undo from public, anon, authenticated;

-- Realtime only carries a family refresh signal. Private rows are never published.
create table public.todo_changes (
  family_id uuid primary key references public.families(id) on delete cascade,
  changed_at timestamptz not null
);
alter table public.todo_changes enable row level security;
revoke all on public.todo_changes from public, anon, authenticated;
grant select on public.todo_changes to authenticated;
create policy todo_changes_in_family on public.todo_changes for select to authenticated
  using (family_id = (select private.current_family_id()));
alter publication supabase_realtime add table public.todo_changes;

create function private.notify_todo_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := coalesce(new.family_id, old.family_id);
begin
  if old.visibility = 'shared' or new.visibility = 'shared' then
    insert into public.todo_changes (family_id, changed_at)
      select id, clock_timestamp() from public.families where id = family
      on conflict (family_id) do update set changed_at = excluded.changed_at;
  end if;
  return null;
end;
$$;
revoke all on function private.notify_todo_changes() from public, anon, authenticated;
create trigger notify_todo_changes after insert or update or delete on public.todos
  for each row execute function private.notify_todo_changes();

create function private.remove_user_todos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.todos where owner_id = old.id and visibility = 'private';
  delete from private.todo_undo where actor_id = old.id or expires_at <= now();
  update private.todo_undo
    set snapshot = jsonb_populate_record(snapshot, jsonb_build_object(
      'owner_id', nullif((snapshot).owner_id, old.id),
      'completed_by', nullif((snapshot).completed_by, old.id)
    ))
    where (snapshot).owner_id = old.id or (snapshot).completed_by = old.id;
  return old;
end;
$$;
revoke all on function private.remove_user_todos() from public, anon, authenticated;
create trigger remove_user_todos before delete on public.users
  for each row execute function private.remove_user_todos();

create function public.write_todo(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  family uuid := private.current_family_id();
  operation text := payload->>'action';
  target uuid := (payload->>'id')::uuid;
  fields jsonb := payload->'item';
  title_value text := btrim(fields->>'title');
  due_value date;
  visibility_value text := fields->>'visibility';
  current_todo public.todos;
  done boolean;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  -- Match account withdrawal's family lock and recheck membership after waiting.
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if family is distinct from private.current_family_id() then
    raise exception 'family_required';
  end if;
  if operation is null or operation not in ('save', 'set_done', 'delete', 'undo') then
    raise exception 'invalid_todo';
  end if;
  if operation = 'save' then
    if jsonb_typeof(fields->'title') is distinct from 'string'
      or title_value !~ '[^[:space:]]'
      or visibility_value is null or visibility_value not in ('shared', 'private')
      or (fields->>'due_on' is not null and fields->>'due_on' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
      raise exception 'invalid_todo';
    end if;
    due_value := (fields->>'due_on')::date;
    if target is null then
      insert into public.todos (family_id, title, due_on, visibility, owner_id)
        values (family, title_value, due_value, visibility_value, actor)
        returning id into target;
      return target;
    end if;
  end if;

  if operation = 'undo' then
    delete from private.todo_undo
      where actor_id = actor and family_id = family and (snapshot).id = target and expires_at > clock_timestamp()
      returning (snapshot).* into current_todo;
    if not found then raise exception 'todo_not_found'; end if;
    insert into public.todos select (current_todo).*;
    return target;
  end if;

  select * into current_todo from public.todos
    where id = target and family_id = family
      and (visibility = 'shared' or owner_id = actor)
    for update;
  if not found then raise exception 'todo_not_found'; end if;

  case operation
    when 'save' then
      if visibility_value = 'private' and current_todo.owner_id is distinct from actor then
        raise exception 'todo_forbidden';
      end if;
      update public.todos set title = title_value, due_on = due_value,
        visibility = visibility_value, updated_at = now() where id = target;
    when 'set_done' then
      if jsonb_typeof(payload->'done') is distinct from 'boolean' then
        raise exception 'invalid_todo';
      end if;
      done := (payload->>'done')::boolean;
      if done <> (current_todo.completed_at is not null) then
        update public.todos set completed_at = case when done then now() end,
          completed_by = case when done then actor end, updated_at = now() where id = target;
      end if;
    when 'delete' then
      delete from public.todos where id = target;
      insert into private.todo_undo (actor_id, family_id, snapshot, expires_at)
        values (actor, family, current_todo, clock_timestamp() + interval '30 seconds')
        on conflict (actor_id) do update set family_id = excluded.family_id,
          snapshot = excluded.snapshot, expires_at = excluded.expires_at;
  end case;
  return target;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
  or check_violation then
  raise exception 'invalid_todo';
end;
$$;
revoke all on function public.write_todo(jsonb) from public, anon, authenticated;
grant execute on function public.write_todo(jsonb) to authenticated;
