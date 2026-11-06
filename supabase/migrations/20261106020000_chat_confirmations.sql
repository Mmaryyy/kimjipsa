-- BOT-07/08: every mutation requires one editable confirmation message.
begin;
alter table public.agent_proposals alter column expires_at set default 'infinity';
update public.agent_proposals set expires_at='infinity' where status='draft';
create function private.agent_action_label(family uuid, a jsonb, applied boolean default false, nominal boolean default false)
  returns text
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  p jsonb := a -> 'payload';
  e jsonb := p -> 'event';
  name text;
  verb text;
  day date;
  clock time;
  unit_name text;
  amount text;
  quantity numeric;
  category text;
  visibility text;
  all_day boolean;
begin
  if a ->> 'domain' = 'event' then
    if p ->> 'action' = 'delete' then
      select
        d.title,
        coalesce((p ->> 'occurrenceDate')::date, v.start_date),
        v.start_time,
        c.name,
        v.visibility,
        v.is_all_day
      into
        name,
        day,
        clock,
        category,
        visibility,
        all_day
      from
        public.events v
        join public.event_details d on d.event_id = v.id
        join public.event_categories c on c.id = d.category_id
          and c.family_id = family
      where
        v.id =(p ->> 'id')::uuid
        and v.family_id = family;
      verb := case when applied then
        '삭제했어요'
      when nominal then
        '삭제'
      else
        '삭제할까요?'
      end;
    else
      name := e ->> 'title';
      day :=(e ->> 'startDate')::date;
      clock :=(e ->> 'startTime')::time;
      visibility := e ->> 'visibility';
      all_day :=(e ->> 'isAllDay')::boolean;
      select
        c.name
      into
        category
      from
        public.event_categories c
      where
        c.id =(e ->> 'categoryId')::uuid
        and c.family_id = family;
      verb := case when p ->> 'id' is null then
        case when applied then
          '추가했어요'
        when nominal then
          '추가'
        else
          '추가할까요?'
        end
      else
        case when applied then
          '수정했어요'
        when nominal then
          '수정'
        else
          '수정할까요?'
        end
      end;
    end if;
    if applied then
      return to_char(day, 'FMMM월 FMDD일') || coalesce(' ' ||
        left (clock::text, 5), '') || ', ' || name || ' 일정을 ' || verb;
    end if;
    return to_char(day, 'FMMM월 FMDD일') || case when all_day then
      ' 종일'
    when clock is not null then
      ' ' ||
      left (clock::text,
        5)
    else
      ' 시간 미정'
    end || case when nominal then
      ' '
    else
      ', '
    end || name || case when nominal then
      ' '
    else
      ', ' || category || ' 카테고리의 '
    end || case when visibility = 'shared' then
      '공유 일정'
    else
      '개인 일정'
    end || case when nominal then
      ' '
    when p ->> 'action' = 'delete'
      or p ->> 'id' is not null then
      '을 '
    else
      '으로 '
    end || verb || case when nominal then
      ' (' || category || ')'
    else
      ''
    end;
  end if;
  name := p -> 'item' ->> 'name';
  select
    u.name
  into
    unit_name
  from
    public.units u
  where
    u.id =(p -> 'item' ->> 'unit_id')::uuid
    and u.family_id = family;
  if name is null and a ->> 'domain' = 'inventory' then
    select
      i.name,
      u.name
    into
      name,
      unit_name
    from
      public.inventory_items i
      left join public.units u on u.id = i.unit_id
    where
      i.id =(p ->> 'id')::uuid
      and i.family_id = family;
  elsif name is null
      and a ->> 'domain' = 'cart' then
      select
        c.name
      into
        name
      from
        public.cart_items c
      where
        c.id =(p ->> 'id')::uuid
        and c.family_id = family;
  end if;
  amount := coalesce(' ' ||(p -> 'item' ->> 'quantity') || coalesce(unit_name, ''),'');
  if p ->> 'action' = 'restock' then
    select
      string_agg(c.name || ' ' ||(entry ->> 'quantity') || coalesce(u.name, ''), ', ' order by i)
    into
      name
    from
      jsonb_array_elements(p -> 'entries')
  with ordinality r(entry, i)
  join public.cart_items c on c.id =(entry ->> 'id')::uuid
      and c.family_id = family
    left join public.units u on u.id =(entry ->> 'unit_id')::uuid
      and u.family_id = family;
    return name || case when applied then
      ' 구매를 재고에 반영했어요'
    when nominal then
      ' 구매 재고 반영'
    else
      ' 구매를 재고에 반영할까요?'
    end;
  end if;
  if a ->> 'domain' = 'inventory' then
    if p ->> 'action' = 'adjust' then
      quantity :=(p ->> 'delta')::numeric;
      verb := case when quantity < 0 then
        case when applied then
          '줄였어요'
        when nominal then
          '줄이기'
        else
          '줄일까요?'
        end
      else
        case when applied then
          '늘렸어요'
        when nominal then
          '늘리기'
        else
          '늘릴까요?'
        end
      end;
      return name || case when nominal then
        ' 재고 '
      else
        ' 재고를 '
      end || abs(quantity)::text || coalesce(unit_name, '') || ' ' || verb;
    elsif p ->> 'action' = 'status'
        or p -> 'item' ->> 'mode' = 'status' then
        verb := case coalesce(p ->> 'status', p -> 'item' ->> 'status')
        when 'enough' then
          '충분'
        when 'low' then
          '부족'
        when 'none' then
          '없음'
        end;
      return name || case when nominal then
        ' 재고 '
      else
        ' 재고를 '
      end || verb || case when applied then
        ' 상태로 표시했어요'
      when nominal then
        ' 상태로 표시'
      else
        ' 상태로 표시할까요?'
      end;
    elsif p ->> 'action' = 'used-up' then
      return name || case when applied then
        ' 재고를 다 쓴 것으로 표시했어요'
      when nominal then
        ' 재고 다 씀 표시'
      else
        ' 재고를 다 쓴 것으로 표시할까요?'
      end;
    end if;
    verb := case when p ->> 'action' = 'delete' then
      case when applied then
        '삭제했어요'
      when nominal then
        '삭제'
      else
        '삭제할까요?'
      end
    when p ->> 'id' is null then
      case when applied then
        '추가했어요'
      when nominal then
        '추가'
      else
        '추가할까요?'
      end
    else
      case when applied then
        '수정했어요'
      when nominal then
        '수정'
      else
        '수정할까요?'
      end
    end;
    return name || amount || case when nominal then
      ' 재고 '
    else
      ' 재고를 '
    end || verb;
  end if;
  verb := case p ->> 'action'
  when 'add' then
    case when applied then
      '담았어요'
    when nominal then
      '담기'
    else
      '담을까요?'
    end
  when 'delete' then
    case when applied then
      '삭제했어요'
    when nominal then
      '삭제'
    else
      '삭제할까요?'
    end
  when 'check' then
    case when (p ->> 'checked')::boolean then
      case when applied then
        '담음으로 표시했어요'
      when nominal then
        '담음 표시'
      else
        '담음으로 표시할까요?'
      end
    else
      case when applied then
        '담지 않음으로 표시했어요'
      when nominal then
        '담지 않음 표시'
      else
        '담지 않음으로 표시할까요?'
      end
    end
  else
    case when applied then
      '수정했어요'
    when nominal then
      '수정'
    else
      '수정할까요?'
    end
  end;
  return name || amount || case when nominal then
    ' 장바구니 '
  else
    ' 장바구니에 '
  end || verb;
end
$$;

revoke all on function private.agent_action_label(uuid, jsonb, boolean, boolean) from public, anon, authenticated;

create function private.prepare_agent_actions(family uuid, actor uuid, actions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a jsonb; p jsonb; item jsonb; target public.events; result jsonb:='[]';
begin
  if jsonb_typeof(actions) is distinct from 'array' or jsonb_array_length(actions) not between 1 and 20
    then
      raise exception 'invalid_chat';
    end if;
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
    result:=result||jsonb_build_array(jsonb_set(a,'{label}',
      to_jsonb(private.agent_action_label(family,a,false,jsonb_array_length(actions)>1))));
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
  saved uuid; one_result jsonb; results jsonb:='[]'; old_sub text:=current_setting('request.jwt.claim.sub',true);
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
      if p->>'action'='add' then
        category_request:=public.cart_category_command('prepare',jsonb_build_object('name',p->'item'->>'name'));
        one_result:=public.cart_category_command('add',jsonb_build_object('id',category_request->'id',
          'categoryId',category_request->'categoryId','command',p));
      else one_result:=public.write_cart(p); end if;
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
create or replace function public.agent_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  worker public.agent_workers; job public.agent_runs; settings private.ai_settings;
  result jsonb; previous private.agent_actions; message public.chat_messages; receipt_id uuid; memory_text text;
    queued_id bigint; new_job_id uuid;
begin
  select * into worker from public.agent_workers where id=auth.uid() and enabled;
  if not found then
    raise exception 'forbidden';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(worker.family_id::text,40));
  if operation in ('claim','heartbeat','ping') then
    update public.agent_workers set last_seen_at=now() where id=worker.id;
  end if;
  insert into private.ai_settings(family_id) values(worker.family_id) on conflict do nothing;
  select * into settings from private.ai_settings where family_id=worker.family_id;
  if operation='config' then
    return jsonb_build_object('workerId',worker.id,'familyId',worker.family_id,'connectionMode','local',
      'capabilitiesVersion',2,
      'version',settings.version,
      'memoryVersion',settings.memory_version,'name',settings.name,'memoryEnabled',settings.memory_enabled);
  elsif operation='claim' then
    -- Expired executions are never rerun blindly; they require an operator to reconcile.
    update public.agent_runs set status='unknown',error_code='lease_expired',lease_token=null,version=version+1
      where family_id=worker.family_id and status='running' and lease_until<=now();
    -- Completion and inventory writes share a transaction. With a revoked lease and
    -- no committed action record, an unknown execution cannot have changed stock.
    update public.agent_runs r set status='failed',error_code='execution_unknown',version=version+1
      where r.family_id=worker.family_id and r.status='unknown'
        and not exists(select 1 from private.agent_actions a where a.run_id=r.id);
    if exists(select 1 from public.agent_runs where family_id=worker.family_id and status in ('running','unknown'))
      then return 'null'; end if;
    if settings.memory_enabled and not exists(select 1 from public.agent_runs where family_id=worker.family_id and
      status='queued') then
      select * into message from public.chat_messages where family_id=worker.family_id and role='user' and
        visibility='shared' order by sequence desc limit 1;
      if found and message.created_at>settings.summarized_at and message.created_at<now()-interval '5 minutes' then
        insert into public.agent_runs(family_id,input_message_id,client_request_id,config_version,memory_version,kind)
          values(worker.family_id,message.id,gen_random_uuid(),settings.version,settings.memory_version,'summary')
            returning id into new_job_id;
        select pgmq.send('family_agent_jobs',jsonb_build_object('jobId',new_job_id)) into queued_id;
        update public.agent_runs set queue_message_id=queued_id where id=new_job_id;
        update private.ai_settings set summarized_at=message.created_at where family_id=worker.family_id;
      end if;
    end if;
    select * into job from public.agent_runs where family_id=worker.family_id and status='queued'
      order by created_at,id limit 1 for update;
    if not found then return 'null'; end if;
    update public.agent_runs set status='running',progress='thinking',worker_id=worker.id,
      lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',config_version=settings.version,
        memory_version=settings.memory_version,version=version+1
      where id=job.id returning * into job;
    perform pgmq.set_vt('family_agent_jobs',job.queue_message_id,90);
    perform private.agent_notice(worker.family_id,'run.updated',jsonb_build_object('jobId',job.id));
    return jsonb_build_object('id',job.id,'familyId',job.family_id,'leaseToken',job.lease_token,
      'configVersion',job.config_version,'memoryVersion',job.memory_version,'kind',job.kind,'hermesRunId',
        job.hermes_run_id);
  elsif operation='ping' then return 'null';
  end if;
  select * into job from public.agent_runs where id=(input->>'jobId')::uuid and family_id=worker.family_id for update;
  if not found or job.worker_id<>worker.id or job.status<>'running' or job.lease_until<=now()
    or job.lease_token is distinct from (input->>'leaseToken')::uuid or job.config_version<>settings.version then
    raise exception 'lease_lost'; end if;
  if operation='heartbeat' then
    update public.agent_runs set lease_until=now()+interval '90 seconds',
      hermes_run_id=coalesce(input->>'hermesRunId',hermes_run_id) where id=job.id;
    perform pgmq.set_vt('family_agent_jobs',job.queue_message_id,90);
  elsif operation='context' then
    select * into message from public.chat_messages where id=job.input_message_id;
    if job.kind='chat' and not exists(select 1 from public.memberships where user_id=message.author_id and
      family_id=job.family_id) then
        raise exception 'forbidden';
      end if;
    if job.kind='chat' and exists(select 1 from unnest(message.attachment_ids) as attached(attachment_id) where not
      exists(
      select 1 from public.chat_attachments a where a.id=attached.attachment_id and a.family_id=job.family_id and
        a.status='ready' and a.expires_at>now()))
      then
        raise exception 'attachment_expired';
      end if;
    return jsonb_build_object('kind',job.kind,'message',to_jsonb(message),'actorId',message.author_id,'visibility',
      message.visibility,'now',now(),
      'calendar',private.agent_calendar_context(job.family_id,message.author_id,message.visibility),
      'cart',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('revision',md5(to_jsonb(c)::text))) from
        public.cart_items c where c.family_id=job.family_id and c.purchased_at is null),'[]'),
      'history',coalesce((select jsonb_agg(x order by x.sequence) from (select role,text,choices,sequence from
        public.chat_messages
        where family_id=job.family_id and visibility=message.visibility and (visibility='shared' or
          viewer_id=message.author_id) and created_at>=settings.context_since and sequence<message.sequence
        and sequence>coalesce((select max(cm.sequence) from public.agent_proposals cp
          join public.agent_runs cr on cr.id=cp.run_id join public.chat_messages cm on cm.id=cr.input_message_id
          where cp.status='cancelled' and cm.family_id=job.family_id and cm.viewer_id=message.author_id),0) order
          by sequence desc limit 30) x),'[]'),
      'memories',case when settings.memory_enabled then coalesce((select jsonb_agg(text) from
        public.family_memories where family_id=job.family_id),'[]') else '[]'::jsonb end,
      'inventory',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('revision',md5(to_jsonb(i)::text)))
        from public.inventory_items i where family_id=job.family_id),'[]'),
      'units',coalesce((select jsonb_agg(u) from public.units u where family_id=job.family_id),'[]'),
      'categories',coalesce((select jsonb_agg(c) from public.inventory_categories c where family_id=job.family_id),
        '[]'),
      'locations',coalesce((select jsonb_agg(l) from public.locations l where family_id=job.family_id and enabled),
        '[]'),
      'attachments',coalesce((select jsonb_agg(a) from public.chat_attachments a where
        a.id=any(message.attachment_ids) and job.kind='chat'),'[]'));
  elsif operation='complete' then
    if job.kind='chat' and input->>'kind' in ('actions','add','proposal') then
      raise exception 'confirmation_required';
    end if;
    if jsonb_typeof(coalesce(input->'awaitingAnswer','false'::jsonb)) is distinct from 'boolean'
      or (input->'awaitingAnswer'='true'::jsonb and input->>'kind' is distinct from 'reply') then
      raise exception 'invalid_chat';
    end if;
    if jsonb_typeof(coalesce(input->'choices','[]'::jsonb)) is distinct from 'array' then
      raise exception 'invalid_chat';
    end if;
    if jsonb_array_length(coalesce(input->'choices','[]'::jsonb)) > 0 then
      if input->>'kind' is distinct from 'reply'
        or jsonb_array_length(input->'choices') not between 2 and 6 then
        raise exception 'invalid_chat';
      end if;
      if exists(select 1 from jsonb_array_elements(input->'choices') c
        where jsonb_typeof(c) is distinct from 'object'
          or jsonb_typeof(c->'label') is distinct from 'string'
          or jsonb_typeof(c->'value') is distinct from 'string'
          or (select count(*) from jsonb_object_keys(
            case when jsonb_typeof(c)='object' then c else '{}'::jsonb end)) <> 2
          or char_length(btrim(c->>'label')) not between 1 and 30
          or char_length(btrim(c->>'value')) not between 1 and 200)
        or (select count(distinct c->>'value') from jsonb_array_elements(input->'choices') c)
          <> jsonb_array_length(input->'choices')
        or (select count(distinct c->>'label') from jsonb_array_elements(input->'choices') c)
          <> jsonb_array_length(input->'choices') then
        raise exception 'invalid_chat';
      end if;
    end if;
    select * into message from public.chat_messages where id=job.input_message_id;
    if job.kind='chat' and not exists(select 1 from public.memberships where user_id=message.author_id and
      family_id=job.family_id) then
        raise exception 'forbidden';
      end if;
    if char_length(input->>'text') not between 1 and 20000 then
      raise exception 'invalid_chat';
    end if;
    if job.kind='summary' then
      if message.visibility<>'shared' or input->>'kind'<>'summary' or not settings.memory_enabled or
        settings.memory_version<>job.memory_version
        or jsonb_typeof(input->'memories')<>'array' or jsonb_array_length(input->'memories')>20 then raise
          exception 'lease_lost'; end if;
      for memory_text in select jsonb_array_elements_text(input->'memories') loop
        if not exists(select 1 from public.family_memories where family_id=job.family_id and text=memory_text) then
          insert into public.family_memories(family_id,text) values(job.family_id,memory_text);
        end if;
      end loop;
      update private.ai_settings set memory_version=memory_version+1 where family_id=job.family_id;
    elsif input->>'kind' in ('actions','action_proposal') then
      if jsonb_typeof(input->'actions')<>'array' or jsonb_array_length(input->'actions') not between 1 and 20 then
        raise exception 'invalid_chat'; end if;
      insert into public.agent_proposals(family_id,run_id,actions)
        values(job.family_id,job.id,private.prepare_agent_actions(job.family_id,message.author_id,input->'actions'));
    elsif input->>'kind' in ('receipt','proposal') then
      if jsonb_typeof(input->'items')<>'array' or jsonb_array_length(input->'items') not between 1 and 100 then
        raise exception 'invalid_inventory'; end if;
      insert into public.receipt_imports(family_id,run_id,kind,items,expires_at)
        values(job.family_id,job.id,input->>'kind',input->'items',now()+case when input->>'kind'='receipt' then
          interval '7 days' else interval '5 minutes' end)
        returning id into receipt_id;
    elsif input->>'kind'<>'reply' then
      raise exception 'invalid_chat';
    end if;
    if job.kind='chat' and input->>'kind'<>'action_proposal' then
      if jsonb_typeof(coalesce(input->'sources','[]'))<>'array' or jsonb_array_length(coalesce(input->'sources',
        '[]'))>5 then
          raise exception 'invalid_chat';
        end if;
      if exists(select 1 from jsonb_array_elements(coalesce(input->'sources','[]')) s where s->>'url' !~
        '^https?://' or char_length(s->>'url')>2000) then
          raise exception 'invalid_chat';
        end if;
      insert into public.chat_messages(family_id,visibility,viewer_id,role,text,sources,choices,awaiting_answer)
        values(job.family_id,message.visibility,message.viewer_id,'assistant',input->>'text',
          coalesce(input->'sources','[]'),coalesce(input->'choices','[]'),
          coalesce((input->>'awaitingAnswer')::boolean,false)
            or jsonb_array_length(coalesce(input->'choices','[]'))>0);
    end if;
    update public.agent_runs set status='completed',lease_token=null,lease_until=null,version=version+1 where id=job.id;
    perform pgmq.delete('family_agent_jobs',job.queue_message_id);
    perform private.agent_notice(job.family_id,'message.created',jsonb_build_object('jobId',job.id,'receiptId',
      receipt_id));
    return result;
  elsif operation='fail' then
    update public.agent_runs set status=case when input->>'code'='execution_unknown' then 'unknown' else 'failed' end,
      error_code=input->>'code',lease_token=null,lease_until=null,version=version+1 where id=job.id;
    if input->>'code'<>'execution_unknown' then perform pgmq.delete('family_agent_jobs',job.queue_message_id); end if;
    perform private.agent_notice(job.family_id,'run.updated',jsonb_build_object('jobId',job.id));
  else raise exception 'invalid_chat'; end if;
  return 'null';
end $$;
revoke all on function public.agent_command(text,jsonb) from public, anon;
grant execute on function public.agent_command(text,jsonb) to authenticated;
create or replace function private.execute_chat_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
<<chat_state>>
declare
  chosen_actions jsonb;
  family uuid := private.current_family_id(); settings private.ai_settings;
  job public.agent_runs; receipt public.receipt_imports; attachment public.chat_attachments;
  message_id uuid; job_id uuid; attachment_id uuid; queue_id bigint; result jsonb; memory public.family_memories;
  scope text := coalesce(input->>'visibility','shared'); proposal public.agent_proposals;
  cursor_sequence bigint := coalesce((input->>'after')::bigint,0);
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  if family is null then
    raise exception 'family_required';
  end if;
  if scope not in ('shared','private') then
    raise exception 'invalid_chat';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 40));
  insert into private.ai_settings(family_id) values(family) on conflict do nothing;
  select * into settings from private.ai_settings where family_id = family;
  if operation = 'list' then
    return jsonb_build_object('familyId',family,
      'messages', coalesce((select jsonb_agg(x order by x.sequence) from (
        select m.id,m.sequence,m.role,m.text,m.attachment_ids,m.created_at,m.visibility,m.sources,
          case when m.role = 'assistant' then '김' || settings.name else coalesce(u.display_name,'탈퇴한 사용자') end as author
        from public.chat_messages m left join public.users u on u.id = m.author_id
        where m.family_id = family and m.visibility=scope and (scope='shared' or m.viewer_id=auth.uid()) and
          m.sequence > cursor_sequence order by m.sequence limit 100
      ) x),'[]'),
      'runs',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'input_message_id',r.input_message_id,
        'status',r.status,'progress',r.progress,'version',r.version,'error_code',r.error_code))
        from public.agent_runs r where r.family_id = family and r.kind='chat' and exists(select 1 from
          public.chat_messages m where m.id=r.input_message_id and m.visibility=scope and
          private.can_read_agent_message(m.id))),'[]'),
      'receipts',coalesce((select jsonb_agg(to_jsonb(r)) from public.receipt_imports r join public.agent_runs j on
        j.id=r.run_id join public.chat_messages m on m.id=j.input_message_id where r.family_id=family and
        m.visibility=scope and private.can_read_agent_message(m.id)),'[]'),
      'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'expires_at',a.expires_at,'status',
        a.status))
        from public.chat_attachments a where a.family_id=family and a.visibility=scope and (scope='shared' or
          a.uploaded_by=auth.uid())),'[]'),
      'proposals',coalesce((select jsonb_agg(to_jsonb(p)) from public.agent_proposals p join public.agent_runs j on
        j.id=p.run_id join public.chat_messages m on m.id=j.input_message_id where p.family_id=family and
        m.visibility=scope and private.can_read_agent_message(m.id)),'[]'),
      'workerOnline',exists(select 1 from public.agent_workers where family_id=family and enabled and last_seen_at
        > now()-interval '2 minutes'),
      'name',settings.name);
  elsif operation = 'send' then
    select * into job from public.agent_runs where family_id = family and client_request_id =
      (input->>'clientRequestId')::uuid;
    if found then
      if not exists(select 1 from public.chat_messages m where m.id=job.input_message_id and m.author_id=auth.uid()
        and m.visibility=scope and m.text=coalesce(input->>'text','') and m.attachment_ids=array(select value::uuid
        from jsonb_array_elements_text(coalesce(input->'attachmentIds','[]')))) then
        raise exception 'state_conflict';
      end if;
      return jsonb_build_object('id',job.id); end if;
    if char_length(coalesce(input->>'text','')) > 10000 or
      (btrim(coalesce(input->>'text','')) = '' and jsonb_array_length(coalesce(input->'attachmentIds','[]')) = 0)
      then
        raise exception 'invalid_chat';
      end if;
    if jsonb_array_length(coalesce(input->'attachmentIds','[]')) > 4 then
      raise exception 'invalid_chat';
    end if;
    for attachment_id in select value::uuid from jsonb_array_elements_text(coalesce(input->'attachmentIds','[]')) loop
      if not exists(select 1 from public.chat_attachments where id=attachment_id and family_id=family
        and uploaded_by=auth.uid() and visibility=scope and status='ready' and expires_at>now()) then
          raise exception 'attachment_expired';
        end if;
    end loop;
    insert into public.chat_messages(family_id,author_id,visibility,viewer_id,role,text,attachment_ids)
      values(family,auth.uid(),scope,case when scope='private' then auth.uid() end,'user',coalesce(input->>'text',
        ''),array(select value::uuid from jsonb_array_elements_text(coalesce(input->'attachmentIds','[]'))))
        returning id into message_id;
    insert into public.agent_runs(family_id,input_message_id,client_request_id,config_version)
      values(family,message_id,(input->>'clientRequestId')::uuid,settings.version) returning id into job_id;
    select pgmq.send('family_agent_jobs',jsonb_build_object('jobId',job_id)) into queue_id;
    update public.agent_runs set queue_message_id=queue_id where id=job_id;
    perform private.agent_notice(family,'job.ready',jsonb_build_object('jobId',job_id,'messageId',message_id));
    return jsonb_build_object('id',job_id);
  elsif operation = 'cancel' then
    update public.agent_runs set status='cancelled',lease_token=null,lease_until=null,version=version+1
      where id=(input->>'id')::uuid and family_id=family and private.can_read_agent_message(input_message_id) and
        status in ('queued','running') returning * into job;
    if not found then
      raise exception 'state_conflict';
    end if;
    perform pgmq.delete('family_agent_jobs',job.queue_message_id);
    perform private.agent_notice(family,'run.updated',jsonb_build_object('jobId',job.id));
  elsif operation in ('confirm','cancel-receipt') then
    select * into receipt from public.receipt_imports where id=(input->>'id')::uuid and family_id=family and
      exists(select 1 from public.agent_runs j where j.id=run_id and
      private.can_read_agent_message(j.input_message_id)) for update;
    if not found then
      raise exception 'not_found';
    end if;
    if operation='confirm' and receipt.status='applied' then return receipt.result; end if;
    if receipt.status<>'draft' or receipt.version<>(input->>'version')::integer or receipt.expires_at<=now() then
      raise exception 'state_conflict';
    end if;
    if operation='confirm' then
      result := private.apply_agent_items(family,input->'items');
      update public.receipt_imports set status='applied',items=input->'items',result=chat_state.result,
        applied_by=auth.uid(),version=version+1 where id=receipt.id;
    else update public.receipt_imports set status='cancelled',version=version+1 where id=receipt.id; end if;
    perform private.agent_notice(family,'receipt.updated',jsonb_build_object('id',receipt.id));
    return result;
  elsif operation in ('confirm-actions','cancel-actions','edit-actions') then
    select * into proposal from public.agent_proposals p where p.id=(input->>'id')::uuid and p.family_id=family
      and exists(select 1 from public.agent_runs j where j.id=p.run_id and
        private.can_read_agent_message(j.input_message_id)) for update;
    if not found then
      raise exception 'not_found';
    end if;
    if operation='confirm-actions' and proposal.status='applied' then return proposal.result; end if;
    if proposal.status<>'draft' or proposal.version<>(input->>'version')::integer then
      raise exception 'state_conflict';
    end if;
    if operation='edit-actions' then
      if jsonb_typeof(input->'actions') is distinct from 'array' or
        jsonb_array_length(input->'actions')<>jsonb_array_length(proposal.actions)
        then
          raise exception 'invalid_chat';
        end if;
      -- The edit form cannot replace targets or refresh the original concurrency checks.
      if exists(select 1 from jsonb_array_elements(input->'actions') with ordinality n(value,i)
        where n.value->>'domain' is distinct from proposal.actions->(i::integer-1)->>'domain'
          or n.value->'payload'->'id' is distinct from proposal.actions->(i::integer-1)->'payload'->'id'
          or n.value->'payload'->'action' is distinct from proposal.actions->(i::integer-1)->'payload'->'action'
          or n.value->'payload'->'occurrenceDate' is distinct from
            proposal.actions->(i::integer-1)->'payload'->'occurrenceDate'
          or n.value->'expected' is distinct from proposal.actions->(i::integer-1)->'expected') then
            raise exception 'invalid_chat';
          end if;
      result:=private.prepare_agent_actions(family,auth.uid(),input->'actions');
      update public.agent_proposals set actions=chat_state.result,version=version+1 where id=proposal.id;
    elsif operation='confirm-actions' then
      if jsonb_typeof(input->'selected') is distinct from 'array' or jsonb_array_length(input->'selected')=0 then
        raise exception 'invalid_chat';
      end if;
      if exists(select 1 from jsonb_array_elements_text(input->'selected') s where s::integer<0 or
        s::integer>=jsonb_array_length(proposal.actions)) then
        raise exception 'invalid_chat';
      end if;
      select jsonb_agg(a.value order by a.ordinality) into result from jsonb_array_elements(proposal.actions) with
        ordinality a
        where (a.ordinality-1)::text in (select jsonb_array_elements_text(input->'selected'));
      result:=private.prepare_agent_actions(family,auth.uid(),result);
      chosen_actions:=result;
      result:=private.execute_agent_actions(family,auth.uid(),(select m.visibility from public.agent_runs j join
        public.chat_messages m on m.id=j.input_message_id where j.id=proposal.run_id),result);
      update public.agent_proposals set status='applied',actions=chosen_actions,result=chat_state.result,
        version=version+1 where id=proposal.id;
      insert into public.chat_messages(family_id,visibility,viewer_id,role,text)
        values(family,'private',auth.uid(),'assistant',
          (select string_agg(value->>'label',E'\n' order by i) from jsonb_array_elements(result) with ordinality
            r(value,i)));
    else
      update public.agent_proposals set status='cancelled',actions='[]',version=version+1 where id=proposal.id;
    end if;
    perform private.agent_notice(family,'actions.updated','{}'); return result;
  elsif operation='settings' then
    return jsonb_build_object('name',settings.name,
      'memoryEnabled',settings.memory_enabled,'version',settings.version,
      'memoryVersion',settings.memory_version,'memories',coalesce((select jsonb_agg(m) from public.family_memories
        m where family_id=family),'[]'));
  elsif operation='save-settings' then
    if not private.is_family_admin(family) then
      raise exception 'forbidden';
    end if;
    update private.ai_settings set name=coalesce(input->>'name',name),
      memory_enabled=coalesce((input->>'memoryEnabled')::boolean,memory_enabled),version=version+1,
        memory_version=memory_version+1,context_since=now() where family_id=family;
    -- Older settings cannot commit work after configuration changes.
    update public.agent_runs set status='cancelled',lease_token=null,lease_until=null,version=version+1
      where family_id=family and status in ('queued','running');
    perform private.agent_notice(family,'family.config.updated',jsonb_build_object('familyId',family));
  elsif operation in ('save-memory','delete-memory','reset-memories') then
    if operation='reset-memories' then delete from public.family_memories where family_id=family;
    elsif operation='save-memory' then
      if input->>'id' is null then insert into public.family_memories(family_id,text) values(family,input->>'text');
      else
        update public.family_memories set text=input->>'text',version=version+1 where id=(input->>'id')::uuid
          and family_id=family and version=(input->>'version')::integer;
        if not found then
          raise exception 'state_conflict';
        end if;
      end if;
    else delete from public.family_memories where id=(input->>'id')::uuid and family_id=family and
      version=(input->>'version')::integer;
      if not found then
        raise exception 'state_conflict';
      end if;
    end if;
    update private.ai_settings set memory_version=memory_version+1,context_since=now(),summarized_at=now() where
      family_id=family;
    update public.agent_runs set status='cancelled',lease_token=null,version=version+1 where family_id=family and
      kind='summary' and status in ('queued','running');
    perform private.agent_notice(family,'family.config.updated',jsonb_build_object('familyId',family));
  elsif operation='attachment-create' then
    attachment_id := gen_random_uuid();
    insert into public.chat_attachments(id,family_id,uploaded_by,visibility,path,mime_type)
      values(attachment_id,family,auth.uid(),scope,family::text || '/' || attachment_id::text,input->>'mimeType')
        returning * into attachment;
    return to_jsonb(attachment);
  elsif operation='attachment-ready' then
    select * into attachment from public.chat_attachments where id=(input->>'id')::uuid and family_id=family
      and uploaded_by=auth.uid() and expires_at>now() for update;
    if not found then
      raise exception 'attachment_expired';
    end if;
    if not exists(select 1 from storage.objects where bucket_id='chat-attachments' and name=attachment.path
      and (metadata->>'size')::bigint between 1 and 1048576 and metadata->>'mimetype'=attachment.mime_type)
      then
        raise exception 'invalid_attachment';
      end if;
    update public.chat_attachments set status='ready' where id=attachment.id;
  elsif operation='attachment-read' then
    select * into attachment from public.chat_attachments where id=(input->>'id')::uuid and family_id=family and
      (visibility='shared' or uploaded_by=auth.uid()) and status='ready' and expires_at>now();
    if not found then
      raise exception 'attachment_expired';
    end if;
    return to_jsonb(attachment);
  else raise exception 'invalid_chat'; end if;
  return 'null'::jsonb;
end $$;
revoke all on function private.execute_chat_command(text,jsonb) from public,anon,authenticated;
create or replace function private.expire_chat(family uuid, viewer uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare last_message timestamptz; job record;
begin
  -- Uses the same lock as send/worker complete so an expired reply cannot come back.
  perform pg_advisory_xact_lock(hashtextextended(family::text, 40));
  insert into private.chat_sessions(family_id, viewer_id) values(family, viewer) on conflict do nothing;
  select max(created_at) into last_message from public.chat_messages
    where family_id=family and visibility='private' and viewer_id=viewer;
  if exists(select 1 from public.agent_proposals p join public.agent_runs r on r.id=p.run_id
    join public.chat_messages m on m.id=r.input_message_id where p.status='draft'
      and m.family_id=family and m.viewer_id=viewer) then return false; end if;
  if last_message is null or last_message > now()-interval '1 hour' then return false; end if;
  for job in select r.queue_message_id from public.agent_runs r join public.chat_messages m on m.id=r.input_message_id
    where m.family_id=family and m.visibility='private' and m.viewer_id=viewer and r.queue_message_id is not null loop
    perform pgmq.delete('family_agent_jobs',job.queue_message_id);
  end loop;
  -- The existing delete trigger queues physical files for the five-minute cleanup.
  delete from public.chat_attachments a where a.family_id=family and a.visibility='private'
    and a.uploaded_by=viewer and exists(select 1 from public.chat_messages m
      where m.family_id=family and m.visibility='private' and m.viewer_id=viewer and a.id=any(m.attachment_ids));
  -- Runs, action receipts, receipt imports, and proposals cascade from these messages.
  delete from public.chat_messages where family_id=family and visibility='private' and viewer_id=viewer;
  update private.chat_sessions set version=version+1 where family_id=family and viewer_id=viewer;
  perform private.agent_notice(family,'chat.expired','{}');
  return true;
end $$;
revoke all on function private.expire_chat(uuid,uuid) from public, anon, authenticated;
create or replace function public.chat_page(input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare family uuid:=private.current_family_id(); viewer uuid:=auth.uid(); result jsonb;
begin
  if viewer is null then
    raise exception 'unauthorized';
  end if;
  if family is null then
    raise exception 'family_required';
  end if;
  if coalesce(input->>'visibility','private')<>'private' then
    raise exception 'private_chat_required';
  end if;
  perform private.expire_chat(family,viewer);
  result:=private.read_chat_page(input || jsonb_build_object('visibility','private'));
  return result || jsonb_build_object(
    'sessionVersion',(select version from private.chat_sessions where family_id=family and viewer_id=viewer),
    'expiresAt',case when exists(select 1 from public.agent_proposals p join public.agent_runs r on r.id=p.run_id
      join public.chat_messages m on m.id=r.input_message_id where p.status='draft'
        and m.family_id=family and m.viewer_id=viewer) then null else (select max(created_at)+interval '1 hour'
          from public.chat_messages
      where family_id=family and visibility='private' and viewer_id=viewer) end);
end $$;
revoke all on function public.chat_page(jsonb) from public, anon;
grant execute on function public.chat_page(jsonb) to authenticated;
create or replace function public.chat_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare family uuid:=private.current_family_id(); viewer uuid:=auth.uid(); expired boolean;
begin
  if viewer is null then
    raise exception 'unauthorized';
  end if;
  if family is null then
    raise exception 'family_required';
  end if;
  if coalesce(input->>'visibility','private')<>'private' then
    raise exception 'private_chat_required';
  end if;
  if operation='list' then return public.chat_page(input); end if;
  if operation in ('send','cancel','confirm','cancel-receipt','confirm-actions','cancel-actions','edit-actions',
    'attachment-create','attachment-read','attachment-ready') then
    expired:=private.expire_chat(family,viewer);
    if expired and operation not in ('send','attachment-create') then
      -- Returning an error marker commits the deletion; raising here would roll it back.
      return jsonb_build_object('chatExpired',true);
    end if;
  end if;
  if operation='send' and input ? 'sessionVersion' and (input->>'sessionVersion')::integer is distinct from
    (select version from private.chat_sessions where family_id=family and viewer_id=viewer) then
    return jsonb_build_object('chatExpired',true);
  end if;
  if operation in ('attachment-read','attachment-ready') and not exists(
    select 1 from public.chat_attachments where id=(input->>'id')::uuid
      and family_id=family and visibility='private' and uploaded_by=viewer)
    then
      raise exception 'attachment_expired';
    end if;
  return private.execute_chat_command(operation,input || jsonb_build_object('visibility','private'));
end $$;
revoke all on function public.chat_command(text,jsonb) from public, anon;
grant execute on function public.chat_command(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
