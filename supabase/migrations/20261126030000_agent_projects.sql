-- PRJ-14: project reads and confirmed changes use the existing family-agent boundary.
begin;

create function private.agent_project_read(family uuid, project_id_filter uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  project public.projects;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if project_id_filter is null then
    return jsonb_build_object('projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status,
        'starts_on', p.starts_on, 'target_on', p.target_on, 'modules', p.modules)
        order by p.sort_order, p.id)
      from public.projects p where p.family_id = family
    ), '[]'), 'deadlines', coalesce((
      select jsonb_agg(to_jsonb(d) - 'familyId' order by d.date, d.kind, d.id)
      from private.project_deadlines(family, today, today + 6) d
    ), '[]'));
  end if;

  select * into project from public.projects p where p.id = project_id_filter and p.family_id = family;
  if not found then raise exception 'project_not_found'; end if;
  return jsonb_build_object(
    'project', to_jsonb(project) - 'family_id' - 'created_by',
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.display_name) order by u.id)
      from public.memberships m join public.users u on u.id = m.user_id where m.family_id = family), '[]'),
    'areas', coalesce((select jsonb_agg(to_jsonb(a) - 'family_id' - 'project_id' order by a.sort_order, a.id)
      from public.project_areas a where a.family_id = family and a.project_id = project.id), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'family_id' - 'project_id'
        || jsonb_build_object('revision', md5(to_jsonb(t)::text)) order by t.due_on, t.id)
      from public.project_tasks t where t.family_id = family and t.project_id = project.id), '[]'),
    'decisions', coalesce((select jsonb_agg(to_jsonb(d) - 'family_id' - 'project_id'
        || jsonb_build_object('opinions', coalesce((
          select jsonb_agg(jsonb_build_object('name', coalesce(u.display_name, '탈퇴한 구성원'),
            'opinion', o.opinion) order by u.display_name, o.id)
          from public.project_decision_opinions o
          left join public.memberships m on m.user_id = o.user_id and m.family_id = o.family_id
          left join public.users u on u.id = m.user_id
          where o.family_id = d.family_id and o.decision_id = d.id
        ), '[]')) order by d.due_on, d.id)
      from public.project_decisions d where d.family_id = family and d.project_id = project.id
        and 'decisions' = any(project.modules)), '[]'),
    'reservations', coalesce((select jsonb_agg(to_jsonb(r) - 'family_id' - 'project_id' order by r.starts_on, r.id)
      from public.project_reservations r where r.family_id = family and r.project_id = project.id
        and 'reservations' = any(project.modules)), '[]'),
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'family_id' - 'project_id'
        order by coalesce(e.paid_on, e.planned_on), e.id)
      from public.project_expenses e where e.family_id = family and e.project_id = project.id
        and 'budget' = any(project.modules)), '[]')
  );
end;
$$;
revoke all on function private.agent_project_read(uuid, uuid) from public, anon, authenticated;

create function private.agent_project_label(family uuid, payload jsonb, applied boolean, nominal boolean)
returns text language plpgsql stable set search_path = '' as $$
declare
  action text := payload->>'action';
  item jsonb := payload->'item';
  project public.projects;
  task_title text;
  member_name text;
  item_label text;
  verb text;
  details text;
  label_date date;
  year_start date := date_trunc('year', now() at time zone 'Asia/Seoul')::date;
begin
  select * into project from public.projects p
    where p.family_id = family and p.id = (payload->>'projectId')::uuid;
  if not found then raise exception 'project_not_found'; end if;

  if action = 'set_task_done' and payload->'done' = 'true'::jsonb then
    select t.title into task_title from public.project_tasks t
      where t.family_id = family and t.project_id = project.id and t.id = (payload->>'id')::uuid;
    if not found then raise exception 'project_not_found'; end if;
    item_label := task_title;
    verb := '완료';
  elsif action in ('save_task', 'save_expense') and payload->>'id' is null
      and jsonb_typeof(item->'title') = 'string' and char_length(btrim(item->>'title')) between 1 and 100 then
    item_label := btrim(item->>'title');
    if item->>'area_id' is not null and not exists (
      select from public.project_areas a where a.family_id = family and a.project_id = project.id
        and a.id = (item->>'area_id')::uuid
    ) then raise exception 'invalid_project'; end if;

    if action = 'save_task' then
      if coalesce(item->>'status', '') not in ('todo', 'in_progress', 'on_hold') then
        raise exception 'invalid_project';
      end if;
      if item->>'assignee_kind' = 'together' then member_name := '함께'; end if;
      label_date := (item->>'due_on')::date;
      verb := '할 일 추가';
    else
      if not ('budget' = any(project.modules)) then raise exception 'project_not_found'; end if;
      if (item->>'actual_amount' is null and item->>'estimated_amount' is null)
        or (item->>'actual_amount' is not null and (item->>'paid_on' is null or item->>'payer_id' is null)) then
        raise exception 'invalid_project';
      end if;
      label_date := (case when item->>'actual_amount' is not null
        then item->>'paid_on' else item->>'planned_on' end)::date;
      verb := '지출 기록';
    end if;

    if coalesce(item->>'assignee_id', item->>'payer_id') is not null then
      select u.display_name into member_name from public.memberships m join public.users u on u.id = m.user_id
        where m.family_id = family and u.id = coalesce(item->>'assignee_id', item->>'payer_id')::uuid;
      if not found then raise exception 'invalid_project'; end if;
    end if;

    details := concat_ws(' · ',
      case when label_date is not null then
        (case when action = 'save_task' then '마감 ' else '' end)
        || to_char(label_date, case when date_trunc('year', label_date::timestamp)::date = year_start
          then 'MM.DD' else 'YYYY.MM.DD' end)
      end,
      member_name,
      case when action = 'save_expense' and applied then
        (case when item->>'actual_amount' is null then '예상 ' else '' end)
        || to_char(coalesce(item->>'actual_amount', item->>'estimated_amount')::numeric, 'FM9,999,999,999,999,990')
        || '원'
      end);
  else
    raise exception 'invalid_project';
  end if;

  return format('‘%s’ · ‘%s’%s %s%s', project.title, item_label,
    case when nullif(details, '') is not null then ' (' || details || ')' else '' end, verb,
    case when applied then '했어요.' when nominal then '' else '할까요?' end);
end;
$$;
revoke all on function private.agent_project_label(uuid, jsonb, boolean, boolean) from public, anon, authenticated;

create or replace function public.agent_read(input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare worker public.agent_workers; resource text:=input->>'resource'; settings private.ai_settings;
begin
  select * into worker from public.agent_workers where id=auth.uid() and enabled;
  if not found then raise exception 'forbidden'; end if;
  if resource='memories' then
    select * into settings from private.ai_settings where family_id=worker.family_id;
    return jsonb_build_object('enabled',coalesce(settings.memory_enabled,true),'memories',
      case when settings.memory_enabled is false then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('id',id,'text',text,'version',version) order by id)
        from public.family_memories where family_id=worker.family_id),'[]'::jsonb) end);
  elsif resource='inventory' then
    return jsonb_build_object(
      'items',coalesce((select jsonb_agg(i order by i.name,i.id) from public.inventory_items i where family_id=worker.family_id),'[]'),
      'units',coalesce((select jsonb_agg(u) from public.units u where family_id=worker.family_id),'[]'),
      'categories',coalesce((select jsonb_agg(c) from public.inventory_categories c where family_id=worker.family_id),'[]'),
      'locations',coalesce((select jsonb_agg(l) from public.locations l where family_id=worker.family_id and enabled),'[]'));
  elsif resource='cart' then
    return jsonb_build_object(
      'items',coalesce((select jsonb_agg(c order by c.created_at,c.id) from public.cart_items c where family_id=worker.family_id and purchased_at is null),'[]'),
      'units',coalesce((select jsonb_agg(u) from public.units u where family_id=worker.family_id),'[]'));
  elsif resource='projects' then
    return private.agent_project_read(worker.family_id, (input->>'projectId')::uuid);
  elsif resource='calendar' then
    return private.agent_calendar_context(worker.family_id,null,'shared');
  end if;
  raise exception 'invalid_chat';
end $$;
revoke all on function public.agent_read(jsonb) from public, anon;
grant execute on function public.agent_read(jsonb) to authenticated;

create or replace function private.prepare_agent_actions(family uuid, actor uuid, actions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  a jsonb;
  p jsonb;
  item jsonb;
  target public.events;
  category uuid;
  category_name text;
  label text;
  nominal boolean;
  result jsonb := '[]';
begin
  if jsonb_typeof(actions) is distinct from 'array' or jsonb_array_length(actions) not between 1 and 20
    then
      raise exception 'invalid_chat';
    end if;
  nominal := jsonb_array_length(actions) > 1;
  for a in select value from jsonb_array_elements(actions) loop
    p:=a->'payload';
    if a->>'domain'='event' then
      if p->>'id' is not null then
        select * into target from public.events where id=(p->>'id')::uuid and family_id=family;
        if not found then
          raise exception 'event_not_found';
        end if;
        if target.visibility='private' and target.owner_id is distinct from actor then
          raise exception 'event_forbidden';
        end if;
        if p->'event'->>'visibility'='private' and target.owner_id is distinct from actor then
          raise exception 'event_forbidden';
        end if;
      end if;
      if p->>'action' is distinct from 'delete' and not exists(select 1 from public.event_categories
        where id=(p->'event'->>'categoryId')::uuid and family_id=family) then
          raise exception 'invalid_event';
        end if;
    elsif a->>'domain' in ('inventory','cart') then
      if p->>'id' is not null then
        if a->>'domain'='inventory' and not exists(select 1 from public.inventory_items where id=(p->>'id')::uuid
          and family_id=family)
          then
            raise exception 'invalid_inventory';
          end if;
        if a->>'domain'='cart' and not exists(select 1 from public.cart_items where id=(p->>'id')::uuid and
          family_id=family)
          then
            raise exception 'invalid_cart';
          end if;
      end if;
      if (a->>'domain' = 'inventory' and p->>'action' = 'save')
        or (a->>'domain' = 'cart' and p->>'action' in ('add', 'save')) then
        select c.id into category from public.inventory_categories c
          where c.family_id = family and c.id::text = lower(p->'item'->>'category_id');
        if category is null then
          if a->>'domain' = 'inventory' then
            select c.id into category from public.inventory_categories c
              where c.family_id = family and c.name = '기타';
          elsif p->>'action' = 'save' then
            select c.category_id into category from public.cart_items c
              where c.family_id = family and c.id = (p->>'id')::uuid;
          end if;
        end if;
        p := jsonb_set(p, '{item,category_id}', coalesce(to_jsonb(category), 'null'));
        a := jsonb_set(a, '{payload}', p);
      end if;
      for item in select value from jsonb_array_elements(case when p ? 'entries' then p->'entries'
        when p ? 'item' then jsonb_build_array(p->'item') else '[]'::jsonb end) loop
        if a->>'domain'='inventory' and (item->>'category_id' is null or item->>'location_id' is null)
          then
            raise exception 'invalid_inventory';
          end if;
        if (a->>'domain'='cart' and p->>'action' in ('add','save') or a->>'domain'='inventory' and
          item->>'mode'='quantity') and item->>'unit_id' is null then
          raise exception 'invalid_inventory';
        end if;
        if item->>'category_id' is not null and not exists(select 1 from public.inventory_categories where
          id=(item->>'category_id')::uuid and family_id=family)
          then
            raise exception 'invalid_inventory';
          end if;
        if item->>'location_id' is not null and not exists(select 1 from public.locations where
          id=(item->>'location_id')::uuid and family_id=family and enabled)
          then
            raise exception 'invalid_inventory';
          end if;
        if item->>'unit_id' is not null and not exists(select 1 from public.units where id=(item->>'unit_id')::uuid
          and family_id=family)
          then
            raise exception 'invalid_inventory';
          end if;
        if item->>'inventory_item_id' is not null and not exists(select 1 from public.inventory_items where
          id=(item->>'inventory_item_id')::uuid and family_id=family)
          then
            raise exception 'invalid_inventory';
          end if;
      end loop;
    elsif a->>'domain' = 'project' then
      label := private.agent_project_label(family, p, false, nominal);
      result := result || jsonb_build_array(jsonb_set(a, '{label}', to_jsonb(label)));
      continue;
    else raise exception 'invalid_chat'; end if;
    label := private.agent_action_label(family, a, false, nominal);
    if (a->>'domain' = 'inventory' and p->>'action' = 'save')
      or (a->>'domain' = 'cart' and p->>'action' in ('add', 'save')) then
      select c.name into category_name from public.inventory_categories c
        where c.family_id = family and c.id = (p->'item'->>'category_id')::uuid;
      if category_name is not null then
        if nominal then
          label := label || ' (' || category_name || ')';
        else
          label := left(label, -1) || ' (' || category_name || ')?';
        end if;
      end if;
    end if;
    result := result || jsonb_build_array(jsonb_set(a, '{label}', to_jsonb(label)));
  end loop;
  return result;
end $$;
revoke all on function private.prepare_agent_actions(uuid,uuid,jsonb) from public,anon,authenticated;

create or replace function private.execute_agent_actions_with_unbatched_inventory(family uuid, actor uuid, scope text, actions jsonb)
  returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  category_request jsonb; a jsonb; p jsonb; e jsonb; entry jsonb; current_row jsonb; target uuid; stock
    public.inventory_items;
  category uuid; saved uuid; one_result jsonb; results jsonb:='[]';
  old_sub text:=current_setting('request.jwt.claim.sub',true);
begin
  if actor is null or not exists(select 1 from public.memberships m where m.user_id=actor and m.family_id=family) then
    raise exception 'forbidden';
  end if;
  if scope not in ('shared','private') or jsonb_typeof(actions)<>'array' or jsonb_array_length(actions) not between
    1 and 20 then
    raise exception 'invalid_chat';
  end if;
  -- Project calendar links and withdrawal take the family lock before event or inventory locks.
  if exists (select from jsonb_array_elements(actions) a where a->>'domain' = 'project') then
    perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text,3));
  perform pg_advisory_xact_lock(hashtextextended(family::text,6));
  -- Check every snapshot before executing the batch (check + restock may target the same row).
  for a in select value from jsonb_array_elements(actions) loop
    p:=a->'payload'; target:=nullif(p->>'id','')::uuid;
    if a->>'domain'='event' then
      if p->'event'->>'visibility'='private' and scope<>'private' then
        raise exception 'private_chat_required';
      end if;
      if target is not null then
        select to_jsonb(ev) into current_row from public.events ev where ev.id=target and ev.family_id=family for
          update;
        if current_row is null then
          raise exception 'event_not_found';
        end if;
        if current_row->>'visibility'='private' and (scope<>'private' or current_row->>'owner_id' is distinct from
          actor::text) then
          raise exception 'event_forbidden';
        end if;
        if a->'expected'->>target::text is distinct from private.agent_event_revision(target) then
          raise exception 'state_conflict';
        end if;
      end if;
    elsif a->>'domain'='inventory' then
      if p->>'action' not in ('save','adjust','delete','used-up','status') then
        raise exception 'invalid_inventory';
      end if;
      if target is null and p->>'action'<>'save' then
        raise exception 'invalid_inventory';
      end if;
      if target is not null then
        select to_jsonb(i) into current_row from public.inventory_items i where i.id=target and i.family_id=family
          for update;
        if current_row is null or a->'expected'->>target::text is distinct from md5(current_row::text) then
          raise exception 'state_conflict';
        end if;
      end if;
    elsif a->>'domain'='cart' then
      if p->>'action' not in ('add','save','delete','check','restock') then
        raise exception 'invalid_cart';
      end if;
      if p->>'action' in ('check','save','delete') then
        select to_jsonb(c) into current_row from public.cart_items c where c.id=target and c.family_id=family and
          c.purchased_at is null for update;
        if current_row is null or a->'expected'->>target::text is distinct from md5(current_row::text) then
          raise exception 'state_conflict';
        end if;
      elsif p->>'action'='restock' then
        if jsonb_typeof(p->'entries')<>'array' or jsonb_array_length(p->'entries') not between 1 and 100 then
          raise exception 'invalid_cart';
        end if;
        for entry in select value from jsonb_array_elements(p->'entries') loop
          select to_jsonb(c) into current_row from public.cart_items c where c.id=(entry->>'id')::uuid and
            c.family_id=family and c.purchased_at is null for update;
          if current_row is null or a->'expected'->>(entry->>'id') is distinct from md5(current_row::text) then
            raise exception 'state_conflict';
          end if;
          select * into stock from public.inventory_items i where i.family_id=family and
            (i.id=nullif(current_row->>'inventory_item_id','')::uuid or (current_row->>'inventory_item_id' is null
              and private.normalize_cart_name(i.name)=private.normalize_cart_name(current_row->>'name'))) order by
              i.id limit 1 for update;
          if found and a->'expected'->>stock.id::text is distinct from md5(to_jsonb(stock)::text) then
            raise exception 'state_conflict';
          end if;
        end loop;
      end if;
    elsif a->>'domain' = 'project' then
      perform private.agent_project_label(family, p, false, false);
      if p->>'action' = 'set_task_done' then
        select to_jsonb(t) into current_row from public.project_tasks t
          where t.id = target and t.project_id = (p->>'projectId')::uuid and t.family_id = family
          for update;
        if current_row is null or a->'expected'->>target::text is distinct from md5(current_row::text) then
          raise exception 'state_conflict';
        end if;
      end if;
    else raise exception 'invalid_chat'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  for a in select value from jsonb_array_elements(actions) loop
    p:=a->'payload'; target:=nullif(p->>'id','')::uuid;
    if a->>'domain' = 'project' then
      a := jsonb_set(a, '{label}', to_jsonb(private.agent_project_label(family, p, true, false)));
      -- Pass only the allowed action fields to the existing user-authorized write RPCs.
      p := jsonb_build_object('action', p->'action', 'projectId', p->'projectId', 'item', p->'item',
        'id', case when p->>'action' = 'set_task_done' then p->'id' end,
        'done', case when p->>'action' = 'set_task_done' then true end);
      if p->>'action' = 'save_expense' then
        saved := public.write_project_budget(p);
      else
        saved := public.write_project(p);
      end if;
      results := results || jsonb_build_array(jsonb_build_object(
        'domain', 'project', 'label', a->'label', 'result', jsonb_build_object('id', saved)
      ));
      continue;
    end if;
    a:=jsonb_set(a,'{label}',to_jsonb(private.agent_action_label(family,a,true)));
    if a->>'domain'='event' then
      e:=p->'event';
      if p->>'action'='delete' then
        perform public.delete_event(target,(p->>'occurrenceDate')::date,p->>'scope');
        one_result:=jsonb_build_object('id',target);
      else
      saved:=public.save_event(target,e->>'title',e->>'place',e->>'memo',(e->>'categoryId')::uuid,e->>'visibility',
        (e->>'startDate')::date,(e->>'endDate')::date,(e->>'startTime')::time,(e->>'endTime')::time,
          (e->>'isAllDay')::boolean,
        coalesce(e->>'kind','event'),coalesce(e->>'ddayStyle','normal'),coalesce(e->>'celebrateMessage',''),
        case when e ? 'remindBefore' then (e->>'remindBefore')::integer else 30 end,e->>'recurrence',
          (p->>'occurrenceDate')::date,e->>'scope');
      one_result:=jsonb_build_object('id',saved);
      end if;
    elsif a->>'domain'='inventory' then
      saved:=public.write_inventory(p); one_result:=jsonb_build_object('id',saved);
    else
      if p->>'action'='restock' then
        -- Explicit purchase completion includes checking the selected rows in the same transaction.
        for entry in select value from jsonb_array_elements(p->'entries') loop
          perform public.write_cart(jsonb_build_object('action','check','id',entry->>'id','checked',true));
        end loop;
      end if;
      if p->>'action' in ('add', 'save') then
        select c.id into category from public.inventory_categories c
          where c.family_id = family and c.id::text = lower(p->'item'->>'category_id');
        if category is null and p->>'action' = 'save' then
          select c.category_id into category from public.cart_items c
            where c.family_id = family and c.id = target;
        end if;
        if category is null then
          category_request := public.cart_category_command('prepare', jsonb_build_object(
            'name', p->'item'->>'name', 'skipUncategorized', true
          ));
          one_result := private.write_cart_with_category(family, actor, jsonb_build_object(
            'id', category_request->'id', 'categoryId', category_request->'categoryId', 'command', p
          ));
        else
          p := jsonb_set(p, '{item,category_id}', to_jsonb(category));
          one_result := public.write_cart(p);
        end if;
      else
        one_result := public.write_cart(p);
      end if;
      if one_result ? 'duplicate' then
        raise exception 'cart_duplicate';
      end if;
    end if;
    results:=results||jsonb_build_array(jsonb_build_object('domain',a->>'domain','label',a->>'label','result',
      one_result));
  end loop;
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  return results;
exception when others then
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true); raise;
end $$;
revoke all on function private.execute_agent_actions_with_unbatched_inventory(uuid,uuid,text,jsonb) from public, anon, authenticated;

commit;
