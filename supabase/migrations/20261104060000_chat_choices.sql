-- BOT-07: persist clarification choices through the existing authorized RPCs.
begin;
alter table public.chat_messages add column choices jsonb not null default '[]',
  add column awaiting_answer boolean not null default false;
alter table public.chat_messages add constraint chat_messages_choices_array
  check (jsonb_typeof(choices) = 'array');

create or replace function private.read_chat_page(input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  family uuid := private.current_family_id();
  viewer uuid := auth.uid();
  scope text := coalesce(input->>'visibility','shared');
  before_sequence bigint := (input->>'before')::bigint;
  assistant_name text;
  result jsonb;
begin
  if viewer is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  if scope not in ('shared','private') or before_sequence <= 0 or before_sequence > 9007199254740991
    then raise exception 'invalid_chat'; end if;
  select name into assistant_name from private.ai_settings where family_id=family;
  assistant_name := coalesce(assistant_name,'집사');

  with candidates as materialized (
    select m.* from public.chat_messages m
    where m.family_id=family and m.visibility=scope and (scope='shared' or m.viewer_id=viewer)
      and (before_sequence is null or m.sequence<before_sequence)
    order by m.sequence desc limit 51
  ), page as materialized (
    select * from candidates order by sequence desc limit 50
  ), page_runs as materialized (
    select r.* from public.agent_runs r join page m on m.id=r.input_message_id
    where r.family_id=family and r.kind='chat'
  )
  select jsonb_build_object(
    'familyId',family,'name',assistant_name,
    'workerOnline',exists(select 1 from public.agent_workers
      where family_id=family and enabled and last_seen_at>now()-interval '2 minutes'),
    'nextBefore',case when (select count(*) from candidates)>50 then (select min(sequence) from page) else null end,
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'sequence',m.sequence,'role',m.role,'text',m.text,'attachment_ids',m.attachment_ids,
      'created_at',m.created_at,'visibility',m.visibility,'sources',m.sources,'choices',m.choices,
      'awaiting_answer',m.awaiting_answer,
      'author',case when m.role='assistant' then '김'||assistant_name else coalesce(u.display_name,'탈퇴한 사용자') end
    ) order by m.sequence) from page m left join public.users u on u.id=m.author_id),'[]'),
    'runs',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'input_message_id',r.input_message_id,'status',r.status,
      'progress',r.progress,'version',r.version,'error_code',r.error_code
    )) from page_runs r),'[]'),
    'receipts',coalesce((select jsonb_agg(to_jsonb(r)) from public.receipt_imports r
      join page_runs j on j.id=r.run_id where r.family_id=family),'[]'),
    'proposals',coalesce((select jsonb_agg(to_jsonb(p)) from public.agent_proposals p
      join page_runs j on j.id=p.run_id where p.family_id=family),'[]'),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'expires_at',a.expires_at,'status',a.status))
      from public.chat_attachments a where a.family_id=family and a.visibility=scope
        and (scope='shared' or a.uploaded_by=viewer)
        and exists(select 1 from page m where a.id=any(m.attachment_ids))),'[]')
  ) into result;
  return result;
end $$;

revoke all on function private.read_chat_page(jsonb) from public, anon, authenticated;

create or replace function public.agent_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  worker public.agent_workers; job public.agent_runs; settings private.ai_settings;
  result jsonb; previous private.agent_actions; message public.chat_messages; receipt_id uuid; memory_text text;
    queued_id bigint; new_job_id uuid;
begin
  select * into worker from public.agent_workers where id=auth.uid() and enabled;
  if not found then raise exception 'forbidden'; end if;
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
      family_id=job.family_id) then raise exception 'forbidden'; end if;
    if job.kind='chat' and exists(select 1 from unnest(message.attachment_ids) as attached(attachment_id) where not
      exists(
      select 1 from public.chat_attachments a where a.id=attached.attachment_id and a.family_id=job.family_id and
        a.status='ready' and a.expires_at>now()))
      then raise exception 'attachment_expired'; end if;
    return jsonb_build_object('kind',job.kind,'message',to_jsonb(message),'actorId',message.author_id,'visibility',
      message.visibility,'now',now(),
      'calendar',private.agent_calendar_context(job.family_id,message.author_id,message.visibility),
      'cart',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('revision',md5(to_jsonb(c)::text))) from
        public.cart_items c where c.family_id=job.family_id and c.purchased_at is null),'[]'),
      'history',coalesce((select jsonb_agg(x order by x.sequence) from (select role,text,choices,sequence from
        public.chat_messages
        where family_id=job.family_id and visibility=message.visibility and (visibility='shared' or
          viewer_id=message.author_id) and created_at>=settings.context_since and sequence<message.sequence order
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
      family_id=job.family_id) then raise exception 'forbidden'; end if;
    if char_length(input->>'text') not between 1 and 20000 then raise exception 'invalid_chat'; end if;
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
      if input->>'kind'='actions' then
        if exists (
          select 1 from (
            select role,awaiting_answer from public.chat_messages
            where family_id=job.family_id and visibility=message.visibility
              and (visibility='shared' or viewer_id=message.author_id)
              and sequence<message.sequence
            order by sequence desc limit 1
          ) preceding where role='assistant' and awaiting_answer
        ) then raise exception 'confirmation_required'; end if;
        if cardinality(message.attachment_ids)>0 or char_length(coalesce(input->>'requestQuote',''))<2 or
          position(input->>'requestQuote' in message.text)=0 then raise exception 'confirmation_required'; end if;
        result:=private.execute_agent_actions(job.family_id,message.author_id,message.visibility,input->'actions');
        insert into private.agent_actions values(job.id,'commands',input->'actions',result);
      else
        insert into public.agent_proposals(family_id,run_id,actions) values(job.family_id,job.id,input->'actions');
      end if;
    elsif input->>'kind' in ('receipt','proposal') then
      if jsonb_typeof(input->'items')<>'array' or jsonb_array_length(input->'items') not between 1 and 100 then
        raise exception 'invalid_inventory'; end if;
      insert into public.receipt_imports(family_id,run_id,kind,items,expires_at)
        values(job.family_id,job.id,input->>'kind',input->'items',now()+case when input->>'kind'='receipt' then
          interval '7 days' else interval '5 minutes' end)
        returning id into receipt_id;
    elsif input->>'kind'='add' then
      select * into message from public.chat_messages where id=job.input_message_id;
      if cardinality(message.attachment_ids)>0 or char_length(coalesce(input->>'requestQuote',''))<2
        or position(input->>'requestQuote' in message.text)=0 then raise exception 'confirmation_required'; end if;
      select * into previous from private.agent_actions where run_id=job.id and action_id='inventory-add';
      if found then result:=previous.result;
      else
        result:=private.apply_agent_items(job.family_id,input->'items');
        insert into private.agent_actions values(job.id,'inventory-add',input->'items',result);
      end if;
    elsif input->>'kind'<>'reply' then raise exception 'invalid_chat'; end if;
    if job.kind='chat' then
      if jsonb_typeof(coalesce(input->'sources','[]'))<>'array' or jsonb_array_length(coalesce(input->'sources',
        '[]'))>5 then raise exception 'invalid_chat'; end if;
      if exists(select 1 from jsonb_array_elements(coalesce(input->'sources','[]')) s where s->>'url' !~
        '^https?://' or char_length(s->>'url')>2000) then raise exception 'invalid_chat'; end if;
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
notify pgrst, 'reload schema';
commit;
