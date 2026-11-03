-- BOT-03~16, INV-17, ACC-08~10/14. Family chat + trusted local worker.
-- Shared inventory rules; only authenticated entry points can select the family.
create function private.write_inventory_for_family(family uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid := (payload->>'id')::uuid;
  action text := payload->>'action';
  item jsonb := payload->'item';
  saved uuid;
  current_item public.inventory_items;
  delta numeric;
begin
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  if target is not null then
    select * into current_item from public.inventory_items where id = target and family_id = family for update;
    if not found then raise exception 'inventory_not_found'; end if;
  end if;
  if action = 'delete' and target is not null then
    delete from public.inventory_items where id = target and family_id = family;
  elsif action = 'used-up' and target is not null then
    update public.inventory_items set quantity = case when mode = 'quantity' then 0 else quantity end,
      status = case when mode = 'status' then 'none' else status end where id = target and family_id = family;
  elsif action = 'status' and target is not null then
    if current_item.mode <> 'status' or payload->>'status' is null
      or payload->>'status' not in ('enough', 'low', 'none') then raise exception 'invalid_inventory'; end if;
    update public.inventory_items set status = payload->>'status' where id = target and family_id = family;
  elsif action in ('adjust', 'merge') and target is not null then
    if current_item.mode <> 'quantity' then raise exception 'quantity_required'; end if;
    delta := (payload->>'delta')::numeric;
    if delta is null or delta = 'NaN'::numeric or abs(delta) = 'Infinity'::numeric or
      (action = 'merge' and delta < 0) then raise exception 'invalid_inventory'; end if;
    update public.inventory_items set quantity = greatest(0, quantity + delta) where id = target and family_id = family;
  elsif action = 'save' and item is not null then
    if item->>'name' is null or char_length(btrim(item->>'name')) not between 1 and 100 then
      raise exception 'invalid_inventory';
    end if;
    if (item->>'unit_id') is not null and not exists(
      select 1 from public.units where id = (item->>'unit_id')::uuid and family_id = family)
      then raise exception 'invalid_inventory'; end if;
    if (item->>'category_id') is not null and not exists(
      select 1 from public.inventory_categories where id = (item->>'category_id')::uuid and family_id = family)
      then raise exception 'invalid_inventory'; end if;
    if (item->>'location_id') is not null and not exists(
      select 1 from public.locations where id = (item->>'location_id')::uuid and family_id = family
        and (enabled or id = current_item.location_id))
      then raise exception 'invalid_inventory'; end if;
    saved := coalesce(target, gen_random_uuid());
    insert into public.inventory_items(
      id, family_id, name, mode, quantity, status, unit_id, category_id, location_id, min_quantity, expires_on
    )
      values (saved, family, btrim(item->>'name'), item->>'mode',
        case when item->>'mode' = 'status' then 0 else (item->>'quantity')::numeric end,
        case when item->>'mode' = 'quantity' then 'enough' else item->>'status' end,
        case when item->>'mode' = 'status' then null else (item->>'unit_id')::uuid end,
        (item->>'category_id')::uuid, (item->>'location_id')::uuid,
        case when item->>'mode' = 'status' then null else (item->>'min_quantity')::numeric end,
        (item->>'expires_on')::date)
      on conflict (id) do update set name = excluded.name, mode = excluded.mode, quantity = excluded.quantity,
        status = excluded.status, unit_id = excluded.unit_id, category_id = excluded.category_id,
        location_id = excluded.location_id, min_quantity = excluded.min_quantity, expires_on = excluded.expires_on;
    return saved;
  else raise exception 'invalid_inventory';
  end if;
  return target;
end;
$$;


revoke all on function private.write_inventory_for_family(uuid, jsonb) from public, anon, authenticated;
create or replace function public.write_inventory(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  return private.write_inventory_for_family(private.current_family_id(), payload);
end $$;

create extension if not exists pgmq;
select pgmq.create('family_agent_jobs');

create table private.ai_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  provider text check (provider in ('claude','gemini')),
  model text,
  encrypted_key jsonb,
  key_suffix text,
  name text not null default '집사' check (char_length(name) between 1 and 20),
  memory_enabled boolean not null default true,
  version integer not null default 1,
  memory_version integer not null default 1,
  context_since timestamptz not null default now(),
  summarized_at timestamptz not null default now()
);
create table public.agent_workers (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null unique references public.families(id) on delete cascade,
  enabled boolean not null default true,
  last_seen_at timestamptz
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  sequence bigint generated always as identity unique,
  author_id uuid references public.users(id) on delete set null,
  role text not null check (role in ('user','assistant')),
  text text not null check (char_length(text) <= 20000),
  attachment_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  input_message_id uuid not null references public.chat_messages(id) on delete cascade,
  client_request_id uuid not null,
  queue_message_id bigint,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','unknown')),
  progress text not null default 'queued' check (progress in ('queued','reading','thinking','inventory','receipt')),
  version integer not null default 1,
  config_version integer not null,
  kind text not null default 'chat' check (kind in ('chat','summary')),
  memory_version integer not null default 1,
  worker_id uuid references public.agent_workers(id) on delete set null,
  lease_token uuid,
  lease_until timestamptz,
  hermes_run_id text,
  error_code text,
  created_at timestamptz not null default now(),
  unique(family_id, client_request_id)
);
create table public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  status text not null default 'uploading' check (status in ('uploading','ready','deleted')),
  expires_at timestamptz not null default now() + interval '24 hours',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.receipt_imports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  run_id uuid not null unique references public.agent_runs(id) on delete cascade,
  kind text not null check (kind in ('receipt','proposal')),
  items jsonb not null,
  status text not null default 'draft' check (status in ('draft','applied','cancelled','expired')),
  version integer not null default 1,
  expires_at timestamptz not null,
  applied_by uuid references public.users(id) on delete set null,
  result jsonb,
  created_at timestamptz not null default now()
);
create table public.family_memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  version integer not null default 1
);
create table private.agent_actions (
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  action_id text not null,
  input jsonb not null,
  result jsonb not null,
  primary key(run_id, action_id)
);
revoke all on private.ai_settings, private.agent_actions from public, anon, authenticated;

create index chat_messages_family_sequence on public.chat_messages(family_id, sequence);
create index agent_runs_family_status on public.agent_runs(family_id, status, created_at);
create index receipt_imports_family on public.receipt_imports(family_id);
create index family_memories_family on public.family_memories(family_id);
create index chat_attachments_expiry on public.chat_attachments(expires_at) where deleted_at is null;

-- Mutations and secret-bearing run rows are available exclusively through scoped RPCs.
do $$ declare tab text; begin
  foreach tab in array array['agent_workers','chat_messages','agent_runs','chat_attachments','receipt_imports','family_memories'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on public.%I from public, anon, authenticated', tab);
  end loop;
end $$;

create function private.agent_notice(family uuid, event text, payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare worker uuid;
begin
  perform realtime.send(payload, event, 'family:' || family::text || ':chat', true);
  select id into worker from public.agent_workers where family_id = family and enabled;
  if worker is not null then
    perform realtime.send(payload, event, 'worker:' || worker::text || ':jobs', true);
  end if;
end $$;
revoke all on function private.agent_notice(uuid,text,jsonb) from public, anon, authenticated;

create function private.can_receive_agent_topic(topic text) returns boolean
language sql stable security definer set search_path = '' as $$
 select topic = 'family:' || private.current_family_id()::text || ':chat'
 or exists(select 1 from public.agent_workers w where w.id = auth.uid() and w.enabled
   and topic = 'worker:' || w.id::text || ':jobs')
$$;
revoke all on function private.can_receive_agent_topic(text) from public, anon;
grant execute on function private.can_receive_agent_topic(text) to authenticated;
create policy agent_private_receive on realtime.messages for select to authenticated
using (extension = 'broadcast' and private.can_receive_agent_topic(realtime.topic()));

-- Transactional reuse of inventory rules; a bad item rolls back the whole batch.
create function private.apply_agent_items(family uuid, items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item jsonb; saved uuid; current_item public.inventory_items; result jsonb := '[]';
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 100 then
    raise exception 'invalid_inventory'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  for item in select value from jsonb_array_elements(items) loop
    if coalesce((item->>'selected')::boolean, true) then
      if (item->>'quantity')::numeric <= 0 then raise exception 'invalid_inventory'; end if;
      if item->>'inventory_item_id' is not null then
        select * into current_item from public.inventory_items
          where id = (item->>'inventory_item_id')::uuid and family_id = family for update;
        if not found or current_item.unit_id is distinct from (item->>'unit_id')::uuid then
          raise exception 'invalid_inventory'; end if;
        saved := private.write_inventory_for_family(family, jsonb_build_object(
          'action','merge','id',current_item.id,'delta',item->'quantity'));
      else
        saved := private.write_inventory_for_family(family, jsonb_build_object('action','save','item',
          item || jsonb_build_object('mode','quantity','status','enough','min_quantity',null)));
      end if;
      result := result || jsonb_build_array(jsonb_build_object('id',saved,'quantity',item->'quantity'));
    end if;
  end loop;
  if result = '[]'::jsonb then raise exception 'invalid_inventory'; end if;
  return result;
end $$;
revoke all on function private.apply_agent_items(uuid,jsonb) from public, anon, authenticated;

create function public.chat_command(operation text, input jsonb default '{}') returns jsonb
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
      'keyConfigured',settings.encrypted_key is not null,'name',settings.name);
  elsif operation = 'send' then
    select * into job from public.agent_runs where family_id = family and client_request_id = (input->>'clientRequestId')::uuid;
    if found then return jsonb_build_object('id',job.id); end if;
    if settings.encrypted_key is null then raise exception 'ai_key_missing'; end if;
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
    return jsonb_build_object('name',settings.name,'provider',settings.provider,'model',settings.model,
      'keySuffix',settings.key_suffix,'memoryEnabled',settings.memory_enabled,'version',settings.version,
      'memoryVersion',settings.memory_version,'memories',coalesce((select jsonb_agg(m) from public.family_memories m where family_id=family),'[]'));
  elsif operation in ('save-settings','delete-key') then
    if not private.is_family_admin(family) then raise exception 'forbidden'; end if;
    update private.ai_settings set name=coalesce(input->>'name',name),
      provider=case when operation='delete-key' then null else coalesce(input->>'provider',provider) end,
      model=case when operation='delete-key' then null else coalesce(input->>'model',model) end,
      encrypted_key=case when operation='delete-key' then null else coalesce(input->'encryptedKey',encrypted_key) end,
      key_suffix=case when operation='delete-key' then null else coalesce(input->>'keySuffix',key_suffix) end,
      memory_enabled=coalesce((input->>'memoryEnabled')::boolean,memory_enabled),version=version+1,memory_version=memory_version+1,context_since=now() where family_id=family;
    -- Old keys/settings cannot commit work after rotation or deletion.
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

create function public.agent_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  worker public.agent_workers; job public.agent_runs; settings private.ai_settings;
  result jsonb; previous private.agent_actions; message public.chat_messages; receipt_id uuid; memory_text text; queued_id bigint; new_job_id uuid;
begin
  select * into worker from public.agent_workers where id=auth.uid() and enabled;
  if not found then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(worker.family_id::text,40));
  update public.agent_workers set last_seen_at=now() where id=worker.id;
  select * into settings from private.ai_settings where family_id=worker.family_id;
  if operation='config' then
    return jsonb_build_object('workerId',worker.id,'familyId',worker.family_id,'provider',settings.provider,
      'model',settings.model,'encryptedKey',settings.encrypted_key,'version',settings.version,
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
    if settings.encrypted_key is null then return 'null'; end if;
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

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('chat-attachments','chat-attachments',false,1048576,array['image/jpeg','image/png','image/webp']);
create policy chat_attachment_upload on storage.objects for insert to authenticated with check (
  bucket_id='chat-attachments' and exists(select 1 from public.chat_attachments a
    where a.path=name and a.family_id=private.current_family_id() and a.uploaded_by=auth.uid()
      and a.status='uploading' and a.expires_at>now()));
-- Security definer helper avoids granting attachment metadata to clients.
create function private.can_read_chat_attachment(object_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.chat_attachments a where a.path=object_path and a.status='ready' and a.expires_at>now()
    and (a.family_id=private.current_family_id() or exists(select 1 from public.agent_workers w
      join public.agent_runs r on r.worker_id=w.id join public.chat_messages m on m.id=r.input_message_id
      where w.id=auth.uid() and w.enabled and w.family_id=a.family_id and r.status='running'
        and r.lease_until>now() and a.id=any(m.attachment_ids))))
$$;
create function private.can_upload_chat_attachment(object_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.chat_attachments a where a.path=object_path and a.family_id=private.current_family_id()
    and a.uploaded_by=auth.uid() and a.status='uploading' and a.expires_at>now())
$$;
revoke all on function private.can_read_chat_attachment(text), private.can_upload_chat_attachment(text) from public, anon;
grant execute on function private.can_read_chat_attachment(text), private.can_upload_chat_attachment(text) to authenticated;
drop policy chat_attachment_upload on storage.objects;
create policy chat_attachment_upload on storage.objects for insert to authenticated
with check (bucket_id='chat-attachments' and private.can_upload_chat_attachment(name));
create policy chat_attachment_read on storage.objects for select to authenticated
using (bucket_id='chat-attachments' and private.can_read_chat_attachment(name));

-- Orphan files survive family deletion only until the independently running cleanup job.
create table private.agent_file_deletions(path text primary key);
revoke all on private.agent_file_deletions from public, anon, authenticated;
create function private.queue_agent_file_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  if old.deleted_at is null then insert into private.agent_file_deletions values(old.path) on conflict do nothing; end if;
  return old;
end $$;
revoke all on function private.queue_agent_file_deletion() from public, anon, authenticated;
create trigger agent_file_delete before delete on public.chat_attachments for each row execute function private.queue_agent_file_deletion();

create function public.agent_cleanup(worker_secret text, operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare expected text; result jsonb;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='cron_secret';
  if expected is null or expected='' or worker_secret is distinct from expected then raise exception 'forbidden'; end if;
  if operation='list' then
    update public.receipt_imports set status='expired',version=version+1 where status='draft' and expires_at<=now();
    delete from public.chat_messages where created_at<now()-interval '90 days';
    delete from pgmq.q_family_agent_jobs q where not exists(select 1 from public.agent_runs r
      where r.queue_message_id=q.msg_id and r.status in ('queued','running','unknown'));
    select coalesce(jsonb_agg(x.path),'[]') into result from (
      select path from private.agent_file_deletions union
      select path from public.chat_attachments where expires_at<=now() and deleted_at is null limit 100
    ) x;
    return result;
  elsif operation='deleted' then
    update public.chat_attachments set status='deleted',deleted_at=now() where path in(select jsonb_array_elements_text(input->'paths')) and expires_at<=now();
    delete from private.agent_file_deletions where path in(select jsonb_array_elements_text(input->'paths'));
  else raise exception 'invalid_chat'; end if;
  return 'null';
end $$;
revoke all on function public.agent_cleanup(text,text,jsonb) from public, authenticated;
grant execute on function public.agent_cleanup(text,text,jsonb) to anon;
-- A narrowly scoped cron JWT is not needed: server uses a service-role client for Storage deletion.
select cron.schedule('kimjipsa-agent-cleanup','*/5 * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='app_url') || '/api/cron/agent',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := '{}'::jsonb
  );
$job$);
