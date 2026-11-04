-- BOT-11/14: private-only app chat, one hour of inactivity, delete expired history.
begin;

create table private.chat_sessions (
  family_id uuid not null references public.families(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  version integer not null default 1,
  primary key (family_id, viewer_id)
);
revoke all on private.chat_sessions from public, anon, authenticated;
create index chat_messages_private_activity on public.chat_messages(family_id, viewer_id, created_at desc)
  where visibility = 'private';

create function private.expire_chat(family uuid, viewer uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare last_message timestamptz; job record;
begin
  -- Uses the same lock as send/worker complete so an expired reply cannot come back.
  perform pg_advisory_xact_lock(hashtextextended(family::text, 40));
  insert into private.chat_sessions(family_id, viewer_id) values(family, viewer) on conflict do nothing;
  select max(created_at) into last_message from public.chat_messages
    where family_id=family and visibility='private' and viewer_id=viewer;
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

-- Keep the existing bounded page query; only the public entry point can expire/read a session.
alter function public.chat_page(jsonb) rename to read_chat_page;
alter function public.read_chat_page(jsonb) set schema private;
revoke all on function private.read_chat_page(jsonb) from public, anon, authenticated;
create function public.chat_page(input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare family uuid:=private.current_family_id(); viewer uuid:=auth.uid(); result jsonb;
begin
  if viewer is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  if coalesce(input->>'visibility','private')<>'private' then raise exception 'private_chat_required'; end if;
  perform private.expire_chat(family,viewer);
  result:=private.read_chat_page(input || jsonb_build_object('visibility','private'));
  return result || jsonb_build_object(
    'sessionVersion',(select version from private.chat_sessions where family_id=family and viewer_id=viewer),
    'expiresAt',(select max(created_at)+interval '1 hour' from public.chat_messages
      where family_id=family and visibility='private' and viewer_id=viewer));
end $$;
revoke all on function public.chat_page(jsonb) from public, anon;
grant execute on function public.chat_page(jsonb) to authenticated;

alter function public.chat_command(text,jsonb) rename to execute_chat_command;
alter function public.execute_chat_command(text,jsonb) set schema private;
revoke all on function private.execute_chat_command(text,jsonb) from public, anon, authenticated;
create function public.chat_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare family uuid:=private.current_family_id(); viewer uuid:=auth.uid(); expired boolean;
begin
  if viewer is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  if coalesce(input->>'visibility','private')<>'private' then raise exception 'private_chat_required'; end if;
  if operation='list' then return public.chat_page(input); end if;
  if operation in ('send','cancel','confirm','cancel-receipt','confirm-actions','cancel-actions',
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
    then raise exception 'attachment_expired'; end if;
  return private.execute_chat_command(operation,input || jsonb_build_object('visibility','private'));
end $$;
revoke all on function public.chat_command(text,jsonb) from public, anon;
grant execute on function public.chat_command(text,jsonb) to authenticated;

create or replace function private.can_read_agent_message(message_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.chat_messages where id=message_id
    and family_id=private.current_family_id() and visibility='private' and viewer_id=auth.uid());
$$;

create or replace function public.agent_cleanup(worker_secret text, operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare expected text; result jsonb; session record;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='cron_secret';
  if expected is null or expected='' or worker_secret is distinct from expected then raise exception 'forbidden'; end if;
  if operation='list' then
    for session in select family_id,viewer_id from public.chat_messages where visibility='private'
      group by family_id,viewer_id having max(created_at)<=now()-interval '1 hour'
      order by family_id,viewer_id loop
      perform private.expire_chat(session.family_id,session.viewer_id);
    end loop;
    update public.receipt_imports set status='expired',version=version+1 where status='draft' and expires_at<=now();
    delete from public.chat_messages where visibility='shared' and created_at<now()-interval '90 days';
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

notify pgrst, 'reload schema';
commit;
