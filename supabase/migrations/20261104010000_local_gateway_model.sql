-- ACC-08/09, BOT-05/16: use the Mac mini Hermes model and credentials automatically.
-- Forward-only follow-up to 20261104000000_family_agent.sql. No inventory/data rewrite.
begin;
create or replace function public.chat_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id(); settings private.ai_settings;
  job public.agent_runs; receipt public.receipt_imports; attachment public.chat_attachments;
  message_id uuid; job_id uuid; attachment_id uuid; queue_id bigint; result jsonb; memory public.family_memories;
  cursor_sequence bigint := coalesce((input->>'after')::bigint,0);
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 40));
  insert into private.ai_settings(family_id) values(family) on conflict do nothing;
  select * into settings from private.ai_settings where family_id = family;
  if operation = 'list' then
    return jsonb_build_object('familyId',family,
      'messages', coalesce((select jsonb_agg(x order by x.sequence) from (
        select m.id,m.sequence,m.role,m.text,m.attachment_ids,m.created_at,
          case when m.role = 'assistant' then '김' || settings.name else coalesce(u.display_name,'탈퇴한 사용자') end as author
        from public.chat_messages m left join public.users u on u.id = m.author_id
        where m.family_id = family and m.sequence > cursor_sequence order by m.sequence limit 100
      ) x),'[]'),
      'runs',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'input_message_id',r.input_message_id,
        'status',r.status,'progress',r.progress,'version',r.version,'error_code',r.error_code))
        from public.agent_runs r where r.family_id = family and r.kind='chat'),'[]'),
      'receipts',coalesce((select jsonb_agg(r) from public.receipt_imports r where r.family_id = family),'[]'),
      'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'expires_at',a.expires_at,'status',a.status))
        from public.chat_attachments a where a.family_id = family),'[]'),
      'workerOnline',exists(select 1 from public.agent_workers where family_id=family and enabled and last_seen_at > now()-interval '2 minutes'),
      'name',settings.name);
  elsif operation = 'send' then
    select * into job from public.agent_runs where family_id = family and client_request_id = (input->>'clientRequestId')::uuid;
    if found then return jsonb_build_object('id',job.id); end if;
    if char_length(coalesce(input->>'text','')) > 10000 or
      (btrim(coalesce(input->>'text','')) = '' and jsonb_array_length(coalesce(input->'attachmentIds','[]')) = 0)
      then raise exception 'invalid_chat'; end if;
    if jsonb_array_length(coalesce(input->'attachmentIds','[]')) > 4 then raise exception 'invalid_chat'; end if;
    for attachment_id in select value::uuid from jsonb_array_elements_text(coalesce(input->'attachmentIds','[]')) loop
      if not exists(select 1 from public.chat_attachments where id=attachment_id and family_id=family
        and uploaded_by=auth.uid() and status='ready' and expires_at>now()) then raise exception 'attachment_expired'; end if;
    end loop;
    insert into public.chat_messages(family_id,author_id,role,text,attachment_ids)
      values(family,auth.uid(),'user',coalesce(input->>'text',''),array(select value::uuid from jsonb_array_elements_text(coalesce(input->'attachmentIds','[]')))) returning id into message_id;
    insert into public.agent_runs(family_id,input_message_id,client_request_id,config_version)
      values(family,message_id,(input->>'clientRequestId')::uuid,settings.version) returning id into job_id;
    select pgmq.send('family_agent_jobs',jsonb_build_object('jobId',job_id)) into queue_id;
    update public.agent_runs set queue_message_id=queue_id where id=job_id;
    perform private.agent_notice(family,'job.ready',jsonb_build_object('jobId',job_id,'messageId',message_id));
    return jsonb_build_object('id',job_id);
  elsif operation = 'cancel' then
    update public.agent_runs set status='cancelled',lease_token=null,lease_until=null,version=version+1
      where id=(input->>'id')::uuid and family_id=family and status in ('queued','running') returning * into job;
    if not found then raise exception 'state_conflict'; end if;
    perform pgmq.delete('family_agent_jobs',job.queue_message_id);
    perform private.agent_notice(family,'run.updated',jsonb_build_object('jobId',job.id));
  elsif operation in ('confirm','cancel-receipt') then
    select * into receipt from public.receipt_imports where id=(input->>'id')::uuid and family_id=family for update;
    if not found then raise exception 'not_found'; end if;
    if operation='confirm' and receipt.status='applied' then return receipt.result; end if;
    if receipt.status<>'draft' or receipt.version<>(input->>'version')::integer or receipt.expires_at<=now() then raise exception 'state_conflict'; end if;
    if operation='confirm' then
      result := private.apply_agent_items(family,input->'items');
      update public.receipt_imports set status='applied',items=input->'items',result=result,applied_by=auth.uid(),version=version+1 where id=receipt.id;
    else update public.receipt_imports set status='cancelled',version=version+1 where id=receipt.id; end if;
    perform private.agent_notice(family,'receipt.updated',jsonb_build_object('id',receipt.id));
    return result;
  elsif operation='settings' then
    return jsonb_build_object('name',settings.name,
      'memoryEnabled',settings.memory_enabled,'version',settings.version,
      'memoryVersion',settings.memory_version,'memories',coalesce((select jsonb_agg(m) from public.family_memories m where family_id=family),'[]'));
  elsif operation='save-settings' then
    if not private.is_family_admin(family) then raise exception 'forbidden'; end if;
    update private.ai_settings set name=coalesce(input->>'name',name),
      memory_enabled=coalesce((input->>'memoryEnabled')::boolean,memory_enabled),version=version+1,memory_version=memory_version+1,context_since=now() where family_id=family;
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
        if not found then raise exception 'state_conflict'; end if;
      end if;
    else delete from public.family_memories where id=(input->>'id')::uuid and family_id=family and version=(input->>'version')::integer;
      if not found then raise exception 'state_conflict'; end if;
    end if;
    update private.ai_settings set memory_version=memory_version+1,context_since=now(),summarized_at=now() where family_id=family;
    update public.agent_runs set status='cancelled',lease_token=null,version=version+1 where family_id=family and kind='summary' and status in ('queued','running');
    perform private.agent_notice(family,'family.config.updated',jsonb_build_object('familyId',family));
  elsif operation='attachment-create' then
    attachment_id := gen_random_uuid();
    insert into public.chat_attachments(id,family_id,uploaded_by,path,mime_type)
      values(attachment_id,family,auth.uid(),family::text || '/' || attachment_id::text,input->>'mimeType') returning * into attachment;
    return to_jsonb(attachment);
  elsif operation='attachment-ready' then
    select * into attachment from public.chat_attachments where id=(input->>'id')::uuid and family_id=family
      and uploaded_by=auth.uid() and expires_at>now() for update;
    if not found then raise exception 'attachment_expired'; end if;
    if not exists(select 1 from storage.objects where bucket_id='chat-attachments' and name=attachment.path
      and (metadata->>'size')::bigint between 1 and 1048576 and metadata->>'mimetype'=attachment.mime_type)
      then raise exception 'invalid_attachment'; end if;
    update public.chat_attachments set status='ready' where id=attachment.id;
  elsif operation='attachment-read' then
    select * into attachment from public.chat_attachments where id=(input->>'id')::uuid and family_id=family and status='ready' and expires_at>now();
    if not found then raise exception 'attachment_expired'; end if;
    return to_jsonb(attachment);
  else raise exception 'invalid_chat'; end if;
  return 'null'::jsonb;
end $$;
revoke all on function public.chat_command(text,jsonb) from public, anon;
grant execute on function public.chat_command(text,jsonb) to authenticated;

create or replace function public.agent_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  worker public.agent_workers; job public.agent_runs; settings private.ai_settings;
  result jsonb; previous private.agent_actions; message public.chat_messages; receipt_id uuid; memory_text text; queued_id bigint; new_job_id uuid;
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
    if exists(select 1 from public.agent_runs where family_id=worker.family_id and status in ('running','unknown')) then return 'null'; end if;
    if settings.memory_enabled and not exists(select 1 from public.agent_runs where family_id=worker.family_id and status='queued') then
      select * into message from public.chat_messages where family_id=worker.family_id and role='user' order by sequence desc limit 1;
      if found and message.created_at>settings.summarized_at and message.created_at<now()-interval '5 minutes' then
        insert into public.agent_runs(family_id,input_message_id,client_request_id,config_version,memory_version,kind)
          values(worker.family_id,message.id,gen_random_uuid(),settings.version,settings.memory_version,'summary') returning id into new_job_id;
        select pgmq.send('family_agent_jobs',jsonb_build_object('jobId',new_job_id)) into queued_id;
        update public.agent_runs set queue_message_id=queued_id where id=new_job_id;
        update private.ai_settings set summarized_at=message.created_at where family_id=worker.family_id;
      end if;
    end if;
    select * into job from public.agent_runs where family_id=worker.family_id and status='queued'
      order by created_at,id limit 1 for update;
    if not found then return 'null'; end if;
    update public.agent_runs set status='running',progress='thinking',worker_id=worker.id,
      lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',config_version=settings.version,memory_version=settings.memory_version,version=version+1
      where id=job.id returning * into job;
    perform pgmq.set_vt('family_agent_jobs',job.queue_message_id,90);
    perform private.agent_notice(worker.family_id,'run.updated',jsonb_build_object('jobId',job.id));
    return jsonb_build_object('id',job.id,'familyId',job.family_id,'leaseToken',job.lease_token,
      'configVersion',job.config_version,'memoryVersion',job.memory_version,'kind',job.kind,'hermesRunId',job.hermes_run_id);
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
    if job.kind='chat' and exists(select 1 from unnest(message.attachment_ids) as attached(attachment_id) where not exists(
      select 1 from public.chat_attachments a where a.id=attached.attachment_id and a.family_id=job.family_id and a.status='ready' and a.expires_at>now()))
      then raise exception 'attachment_expired'; end if;
    return jsonb_build_object('kind',job.kind,'message',to_jsonb(message),
      'history',coalesce((select jsonb_agg(x order by x.sequence) from (select role,text,sequence from public.chat_messages
        where family_id=job.family_id and created_at>=settings.context_since and sequence<message.sequence order by sequence desc limit 30) x),'[]'),
      'memories',case when settings.memory_enabled then coalesce((select jsonb_agg(text) from public.family_memories where family_id=job.family_id),'[]') else '[]'::jsonb end,
      'inventory',coalesce((select jsonb_agg(i) from public.inventory_items i where family_id=job.family_id),'[]'),
      'units',coalesce((select jsonb_agg(u) from public.units u where family_id=job.family_id),'[]'),
      'categories',coalesce((select jsonb_agg(c) from public.inventory_categories c where family_id=job.family_id),'[]'),
      'locations',coalesce((select jsonb_agg(l) from public.locations l where family_id=job.family_id and enabled),'[]'),
      'attachments',coalesce((select jsonb_agg(a) from public.chat_attachments a where a.id=any(message.attachment_ids) and job.kind='chat'),'[]'));
  elsif operation='complete' then
    if char_length(input->>'text') not between 1 and 20000 then raise exception 'invalid_chat'; end if;
    if job.kind='summary' then
      if input->>'kind'<>'summary' or not settings.memory_enabled or settings.memory_version<>job.memory_version
        or jsonb_typeof(input->'memories')<>'array' or jsonb_array_length(input->'memories')>20 then raise exception 'lease_lost'; end if;
      for memory_text in select jsonb_array_elements_text(input->'memories') loop
        if not exists(select 1 from public.family_memories where family_id=job.family_id and text=memory_text) then
          insert into public.family_memories(family_id,text) values(job.family_id,memory_text);
        end if;
      end loop;
      update private.ai_settings set memory_version=memory_version+1 where family_id=job.family_id;
    elsif input->>'kind' in ('receipt','proposal') then
      if jsonb_typeof(input->'items')<>'array' or jsonb_array_length(input->'items') not between 1 and 100 then raise exception 'invalid_inventory'; end if;
      insert into public.receipt_imports(family_id,run_id,kind,items,expires_at)
        values(job.family_id,job.id,input->>'kind',input->'items',now()+case when input->>'kind'='receipt' then interval '7 days' else interval '5 minutes' end)
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
    if job.kind='chat' then insert into public.chat_messages(family_id,role,text) values(job.family_id,'assistant',input->>'text'); end if;
    update public.agent_runs set status='completed',lease_token=null,lease_until=null,version=version+1 where id=job.id;
    perform pgmq.delete('family_agent_jobs',job.queue_message_id);
    perform private.agent_notice(job.family_id,'message.created',jsonb_build_object('jobId',job.id,'receiptId',receipt_id));
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
