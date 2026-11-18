-- INV-11/CART-11: show selected categories and keep cart recommendations as a fallback.
begin;

create function private.write_cart_with_category(family uuid, actor uuid, input jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  payload jsonb := input->'command';
  target uuid := (input->>'id')::uuid;
  job private.cart_category_requests;
  category uuid;
  result jsonb;
begin
  if target is not null then
    select * into job from private.cart_category_requests where id=target and family_id=family
      and actor_id=actor for update;
    if not found or job.item_id is not null or job.name is distinct from payload->'item'->>'name'
      then raise exception 'invalid_cart'; end if;
    category:=job.category_id;
  else
    -- A matched category is revalidated against this family rather than trusted from the client.
    category:=(input->>'categoryId')::uuid;
  end if;
  if not exists(select 1 from public.inventory_categories where id=category and family_id=family) then
    select id into category from public.inventory_categories where family_id=family and name='기타';
  end if;
  payload:=jsonb_set(payload,'{item,category_id}',coalesce(to_jsonb(category),'null'));
  result:=public.write_cart(payload);
  if target is not null then
    if result->'item'->>'id' is not null and not exists (
      select 1 from private.cart_category_requests
        where family_id = family and item_id = (result->'item'->>'id')::uuid and status in ('queued', 'running')
    ) then
      update private.cart_category_requests set item_id=(result->'item'->>'id')::uuid where id=target;
      perform private.agent_notice(family,'job.ready','{"changed":true}');
    else
      delete from private.cart_category_requests where id=target;
    end if;
  end if;
  return result;
end $$;
revoke all on function private.write_cart_with_category(uuid,uuid,jsonb) from public, anon, authenticated;

create or replace function public.cart_category_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  family uuid;
  actor uuid:=auth.uid();
  worker public.agent_workers;
  job private.cart_category_requests;
  category uuid;
  categories jsonb;
  online boolean;
  target uuid:=(input->>'id')::uuid;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if operation in ('claim','complete','fail') then
    select * into worker from public.agent_workers where id=actor and enabled;
    if not found then raise exception 'forbidden'; end if;
    family:=worker.family_id;
  else
    family:=private.current_family_id();
    if family is null then raise exception 'family_required'; end if;
  end if;
  if operation='status' then
    select * into job from private.cart_category_requests where id=target and family_id=family and actor_id=actor;
    if not found then raise exception 'forbidden'; end if;
    return jsonb_build_object('id',job.id,'categoryId',job.category_id,'pending',job.status in ('queued','running'));
  end if;
  -- Same lock as write_cart, including category edits and checkout.
  perform pg_advisory_xact_lock(hashtextextended(family::text,6));
  delete from private.cart_category_requests where family_id=family
    and status in ('completed','failed') and created_at<now()-interval '1 hour';

  if operation='prepare' then
    if input->>'name' is null or char_length(input->>'name') not between 1 and 100
      or private.normalize_cart_name(input->>'name')='' then raise exception 'invalid_cart'; end if;
    select c.category_id into category from public.cart_items c
      where c.family_id=family and c.purchased_at is null
        and private.normalize_cart_name(c.name)=private.normalize_cart_name(input->>'name')
        and (input->'skipUncategorized' is distinct from 'true'::jsonb or c.category_id is not null)
      order by c.created_at,c.id limit 1;
    if found then
      return jsonb_build_object('id',null,'categoryId',category,'pending',false);
    end if;
    select i.category_id into category from public.inventory_items i
      join public.inventory_categories c on c.id=i.category_id and c.family_id=family
      where i.family_id=family and private.normalize_cart_name(i.name)=private.normalize_cart_name(input->>'name')
      order by i.id limit 1;
    if category is null then
      select c.category_id into category from public.cart_items c
        join public.inventory_categories k on k.id=c.category_id and k.family_id=family
        where c.family_id=family and c.purchased_at is not null
          and private.normalize_cart_name(c.name)=private.normalize_cart_name(input->>'name')
        order by c.purchased_at desc,c.created_at desc,c.id limit 1;
    end if;
    if category is not null then
      return jsonb_build_object('id',null,'categoryId',category,'pending',false);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order,id),'[]')
      into categories from public.inventory_categories where family_id=family;
    select exists(select 1 from public.agent_workers where family_id=family and enabled
      and last_seen_at>now()-interval '2 minutes') into online;
    insert into private.cart_category_requests(family_id,actor_id,name,categories)
      values(family,actor,input->>'name',categories) returning * into job;
    return jsonb_build_object('id',job.id,'categoryId',null,'pending',online);
  elsif operation='claim' then
    update public.agent_workers set last_seen_at=now() where id=actor;
    update private.cart_category_requests set status='failed',lease_token=null
      where family_id=family and ((status='running' and lease_until<=now())
        or (status='queued' and created_at<=now()-interval '5 minutes'));
    select * into job from private.cart_category_requests where family_id=family and status='queued'
      and item_id is not null
      order by created_at,id limit 1 for update;
    if not found then return 'null'; end if;
    update private.cart_category_requests set status='running',worker_id=actor,
      lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds'
      where id=job.id returning * into job;
    return jsonb_build_object('id',job.id,'leaseToken',job.lease_token,'name',job.name,
      'categories',(select jsonb_agg(value->>'name') from jsonb_array_elements(job.categories)));
  elsif operation in ('complete','fail') then
    select * into job from private.cart_category_requests where id=target and family_id=family
      and worker_id=actor and status='running' and lease_token=(input->>'leaseToken')::uuid
      and lease_until>now() for update;
    if not found then raise exception 'lease_lost'; end if;
    if operation='complete' then
      select (value->>'id')::uuid into category from jsonb_array_elements(job.categories)
        where value->>'name'=input->>'category' limit 1;
      if not exists(select 1 from public.inventory_categories where id=category and family_id=family)
        then category:=null; end if;
    end if;
    update private.cart_category_requests set status=case when category is null then 'failed' else 'completed' end,
      category_id=category,lease_token=null where id=job.id;
    if category is not null and job.item_id is not null then
      update public.cart_items set category_id=category where id=job.item_id and family_id=family
        and purchased_at is null;
    end if;
    return '{}';
  elsif operation='add' then
    if input->'command'->>'action' is distinct from 'add' then raise exception 'invalid_cart'; end if;
    return private.write_cart_with_category(family, actor, input);
  end if;
  raise exception 'invalid_cart';
end $$;
revoke all on function public.cart_category_command(text,jsonb) from public, anon;
grant execute on function public.cart_category_command(text,jsonb) to authenticated;

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

create or replace function private.execute_agent_actions(family uuid, actor uuid, scope text, actions jsonb)
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
    else raise exception 'invalid_chat'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  for a in select value from jsonb_array_elements(actions) loop
    p:=a->'payload'; target:=nullif(p->>'id','')::uuid;
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
revoke all on function private.execute_agent_actions(uuid,uuid,text,jsonb) from public, anon, authenticated;

commit;
