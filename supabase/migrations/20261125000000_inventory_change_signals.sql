-- ADR-0024 RT1: private family broadcasts carry only the changed inventory topic.
begin;

create policy family_changes_receive on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and topic = (select realtime.topic())
    and topic = 'family:' || (select private.current_family_id())::text || ':changes'
  );

create function private.send_family_change(family uuid, change_topic text) returns void
language plpgsql set search_path = '' as $$
declare
  violated_constraint text;
begin
  -- realtime.send adds an id to object payloads.
  insert into realtime.messages (topic, extension, event, private, payload)
    values ('family:' || family::text || ':changes', 'broadcast', 'change', true,
      jsonb_build_object('topic', change_topic));
exception when check_violation then
  -- Realtime creates the daily partition when clients connect.
  get stacked diagnostics violated_constraint = constraint_name;
  if violated_constraint <> '' then raise; end if;
  raise warning 'Family change broadcast was skipped: %', sqlerrm;
end;
$$;

create function private.begin_inventory_change_batch() returns boolean
language plpgsql set search_path = '' as $$
begin
  if nullif(current_setting('kimjipsa.inventory_change_families', true), '') is not null then
    return false;
  end if;
  perform set_config('kimjipsa.inventory_change_families', '{}', true);
  return true;
end;
$$;

create function private.finish_inventory_change_batch(started boolean) returns void
language plpgsql set search_path = '' as $$
declare
  families uuid[];
  family uuid;
begin
  if not started then return; end if;
  families := current_setting('kimjipsa.inventory_change_families')::uuid[];
  perform set_config('kimjipsa.inventory_change_families', '', true);
  foreach family in array families loop
    perform private.send_family_change(family, 'inventory');
  end loop;
end;
$$;

create function private.signal_inventory_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  change_topic text := tg_argv[0];
  families uuid[];
  family uuid;
  pending_families uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct family_id) into families from new_rows;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct family_id) into families from old_rows;
  else
    select array_agg(family_id) into families from (
      select family_id from old_rows
      union
      select family_id from new_rows
    ) affected;
  end if;
  if families is null then return null; end if;

  if change_topic = 'inventory' then
    pending_families := nullif(current_setting('kimjipsa.inventory_change_families', true), '')::uuid[];
  end if;
  foreach family in array families loop
    if pending_families is null then
      perform private.send_family_change(family, change_topic);
    elsif not (family = any(pending_families)) then
      pending_families := array_append(pending_families, family);
      perform set_config('kimjipsa.inventory_change_families', pending_families::text, true);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function private.send_family_change(uuid, text), private.begin_inventory_change_batch(),
  private.finish_inventory_change_batch(boolean), private.signal_inventory_change()
  from public, anon, authenticated;

do $$
declare
  table_name text;
  change_topic text;
begin
  foreach table_name in array array['inventory_items', 'inventory_categories', 'locations', 'units'] loop
    change_topic := case when table_name = 'inventory_items' then 'inventory' else 'inventory-meta' end;
    execute format(
      'create trigger signal_inventory_insert after insert on public.%I
       referencing new table as new_rows for each statement execute function private.signal_inventory_change(%L)',
      table_name, change_topic
    );
    execute format(
      'create trigger signal_inventory_update after update on public.%I
       referencing old table as old_rows new table as new_rows
       for each statement execute function private.signal_inventory_change(%L)',
      table_name, change_topic
    );
    execute format(
      'create trigger signal_inventory_delete after delete on public.%I
       referencing old table as old_rows for each statement execute function private.signal_inventory_change(%L)',
      table_name, change_topic
    );
  end loop;
end;
$$;

-- Nested batches leave the collected families for the outer call to publish.
alter function private.write_cart(jsonb) rename to write_cart_with_unbatched_inventory;
-- Keep this batching wrapper. Change private.write_cart_with_unbatched_inventory for implementation updates.
create function private.write_cart(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  started boolean := false;
  result jsonb;
begin
  if payload->>'action' = 'restock' then
    started := private.begin_inventory_change_batch();
  end if;
  result := private.write_cart_with_unbatched_inventory(payload);
  perform private.finish_inventory_change_batch(started);
  return result;
end;
$$;
revoke all on function private.write_cart(jsonb) from public, anon, authenticated;

alter function public.undo_cart_restock(uuid) set schema private;
revoke all on function private.undo_cart_restock(uuid) from public, anon, authenticated, service_role;
-- Keep this batching wrapper. Change private.undo_cart_restock for implementation updates.
create function public.undo_cart_restock(token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  started boolean := private.begin_inventory_change_batch();
  result jsonb := private.undo_cart_restock(token);
begin
  perform private.finish_inventory_change_batch(started);
  return result;
end;
$$;
revoke all on function public.undo_cart_restock(uuid) from public, anon, authenticated;
grant execute on function public.undo_cart_restock(uuid) to authenticated;

alter function private.apply_agent_items(uuid, jsonb) rename to apply_agent_items_with_unbatched_inventory;
-- Keep this batching wrapper. Change private.apply_agent_items_with_unbatched_inventory for implementation updates.
create function private.apply_agent_items(family uuid, items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  started boolean := private.begin_inventory_change_batch();
  result jsonb := private.apply_agent_items_with_unbatched_inventory(family, items);
begin
  perform private.finish_inventory_change_batch(started);
  return result;
end;
$$;
revoke all on function private.apply_agent_items(uuid, jsonb) from public, anon, authenticated;

alter function private.execute_agent_actions(uuid, uuid, text, jsonb)
  rename to execute_agent_actions_with_unbatched_inventory;
-- Keep this batching wrapper. Change private.execute_agent_actions_with_unbatched_inventory for implementation updates.
create function private.execute_agent_actions(family uuid, actor uuid, scope text, actions jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  started boolean := private.begin_inventory_change_batch();
  result jsonb := private.execute_agent_actions_with_unbatched_inventory(family, actor, scope, actions);
begin
  perform private.finish_inventory_change_batch(started);
  return result;
end;
$$;
revoke all on function private.execute_agent_actions(uuid, uuid, text, jsonb) from public, anon, authenticated;

commit;
