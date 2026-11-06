-- BOT-10/11/14: private scope, idle boundary, DB deletion and stale worker fencing.
-- Disposable database only. Every fixture is rolled back.
begin;
create schema if not exists vault;
create table if not exists vault.decrypted_secrets(name text, decrypted_secret text);
create table if not exists pgmq.q_family_agent_jobs(msg_id bigint);
insert into vault.decrypted_secrets(name,decrypted_secret) values('cron_secret','disposable-test-secret');
do $$
declare
  person uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid();
  family uuid:=gen_random_uuid(); other_family uuid:=gen_random_uuid(); message uuid; attachment uuid;
  job jsonb; lease jsonb; snapshot jsonb; version integer; result jsonb; old_proposal uuid;
begin
  insert into auth.users(id) values(person),(partner),(outsider),(worker);
  insert into public.users(id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version)
    select id,'google',id::text,'테스트',now(),now(),'test' from auth.users where id in(person,partner,outsider);
  insert into public.families(id,name) values(family,'개인 대화'),(other_family,'다른 가정');
  insert into public.memberships(user_id,family_id,role) values(person,family,'admin'),(partner,family,'member'),(outsider,other_family,'admin');
  insert into public.agent_workers(id,family_id) values(worker,family);
  insert into public.family_memories(family_id,text) values(family,'보존할 가족 기억');
  insert into public.chat_messages(family_id,author_id,visibility,viewer_id,role,text,created_at) values
    (family,partner,'private',partner,'user','배우자 기록',now()-interval '2 hours'),
    (other_family,outsider,'private',outsider,'user','다른 가정 기록',now()-interval '2 hours'),
    (family,person,'shared',null,'user','기존 공용 기록',now()-interval '2 hours');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',person::text,true);
  snapshot:=public.chat_page(); version:=(snapshot->>'sessionVersion')::integer;
  if snapshot->'messages'<>'[]'::jsonb or snapshot->>'expiresAt' is not null then raise exception 'private default leaked'; end if;
  begin perform public.chat_page('{"visibility":"shared"}'); raise exception 'shared page accepted';
    exception when raise_exception then if sqlerrm<>'private_chat_required' then raise; end if; end;
  begin perform public.chat_command('send',jsonb_build_object('visibility','shared','text','공용','clientRequestId',gen_random_uuid())); raise exception 'shared send accepted';
    exception when raise_exception then if sqlerrm<>'private_chat_required' then raise; end if; end;
  begin perform private.read_chat_page('{}'); raise exception 'legacy reader exposed'; exception when insufficient_privilege then null; end;
  begin perform private.execute_chat_command('list','{}'); raise exception 'legacy writer exposed'; exception when insufficient_privilege then null; end;
  result:=public.chat_command('attachment-create','{"mimeType":"image/jpeg"}'); attachment:=(result->>'id')::uuid;
  reset role; update public.chat_attachments set status='ready' where id=attachment; set local role authenticated;
  job:=public.chat_command('send',jsonb_build_object('text','이전 개인 요청','clientRequestId',gen_random_uuid(),'sessionVersion',version,'attachmentIds',jsonb_build_array(attachment)));
  perform set_config('request.jwt.claim.sub',worker::text,true);
  result:=public.agent_command('claim'); lease:=jsonb_build_object('jobId',result->>'id','leaseToken',result->>'leaseToken');
  reset role;
  select input_message_id into message from public.agent_runs where id=(job->>'id')::uuid;
  insert into public.receipt_imports(family_id,run_id,kind,items,expires_at) values(family,(job->>'id')::uuid,'receipt','[]',now()+interval '7 days');
  insert into public.agent_proposals(family_id,run_id,actions) values(family,(job->>'id')::uuid,'[]') returning id into old_proposal;
  insert into private.agent_actions values((job->>'id')::uuid,'test','{}','{}');
  update public.chat_messages set created_at=now()-interval '59 minutes 59 seconds' where id=message;
  perform set_config('request.jwt.claim.sub',person::text,true); set local role authenticated;
  snapshot:=public.chat_page();
  if jsonb_array_length(snapshot->'messages')<>1 or (snapshot->>'sessionVersion')::integer<>version then raise exception 'expired before one hour'; end if;
  reset role;
  update public.chat_messages set created_at=now()-interval '2 hours' where id=message;
  insert into public.chat_messages(family_id,visibility,viewer_id,role,text,created_at)
    values(family,'private',person,'assistant','최근 집사 답변',now()-interval '1 minute');
  set local role authenticated; snapshot:=public.chat_page();
  if jsonb_array_length(snapshot->'messages')<>2 then raise exception 'assistant did not extend session'; end if;
  reset role;
  -- Confirmed cards no longer protect an idle session from expiry.
  update public.agent_proposals set status='applied' where id=old_proposal;
  update public.chat_messages set created_at=now()-interval '1 hour' where family_id=family and viewer_id=person;
  set local role authenticated;
  snapshot:=public.chat_page(jsonb_build_object('before',999999999));
  if snapshot->'messages'<>'[]'::jsonb or snapshot->>'expiresAt' is not null or (snapshot->>'sessionVersion')::integer<>version+1 then raise exception 'hour boundary did not reset'; end if;
  perform set_config('request.jwt.claim.sub',worker::text,true);
  begin perform public.agent_command('complete',lease||'{"kind":"reply","text":"늦은 답변"}'); raise exception 'stale worker completed';
    exception when raise_exception then if sqlerrm<>'lease_lost' then raise; end if; end;
  reset role;
  if exists(select 1 from public.agent_runs where id=(job->>'id')::uuid)
    or exists(select 1 from public.receipt_imports where run_id=(job->>'id')::uuid)
    or exists(select 1 from public.agent_proposals where id=old_proposal)
    or exists(select 1 from private.agent_actions where run_id=(job->>'id')::uuid)
    or exists(select 1 from public.chat_attachments where id=attachment) then raise exception 'expired metadata retained'; end if;
  if not exists(select 1 from private.agent_file_deletions where path=family::text||'/'||attachment::text) then raise exception 'file deletion not queued'; end if;
  if (select count(*) from public.chat_messages)<>3 or not exists(select 1 from public.family_memories where family_id=family)
    then raise exception 'another viewer, household, legacy history or memory was deleted'; end if;
  perform set_config('request.jwt.claim.sub',person::text,true); set local role authenticated;
  result:=public.chat_command('send',jsonb_build_object('text','오래된 요청 재시도','clientRequestId',gen_random_uuid(),'sessionVersion',version));
  if result->>'chatExpired'<>'true' then raise exception 'old session request accepted'; end if;
  result:=public.chat_command('send',jsonb_build_object('text','새 요청','clientRequestId',gen_random_uuid(),'sessionVersion',version+1));
  perform set_config('request.jwt.claim.sub',worker::text,true);
  job:=public.agent_command('claim'); lease:=jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken');
  snapshot:=public.agent_command('context',lease);
  if snapshot->'history'<>'[]'::jsonb or snapshot::text like '%이전 개인 요청%' or snapshot::text like '%최근 집사 답변%'
    then raise exception 'expired model context survived'; end if;
  perform set_config('request.jwt.claim.sub',person::text,true);
  reset role; update public.chat_messages set created_at=now()-interval '1 hour' where family_id=family and viewer_id=person; set local role authenticated;
  result:=public.chat_command('cancel',jsonb_build_object('id',job->>'id'));
  if result->>'chatExpired'<>'true' then raise exception 'expired action did not commit reset'; end if;
  reset role;
  if exists(select 1 from public.chat_messages where viewer_id=person) then raise exception 'expiry rolled back on stale action'; end if;
  set local role anon;
  begin perform public.agent_cleanup('wrong-secret','list'); raise exception 'unauthorized cleanup accepted';
    exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
  snapshot:=public.agent_cleanup('disposable-test-secret','list');
  if not (snapshot ? (family::text||'/'||attachment::text)) then raise exception 'cleanup did not return deleted photo'; end if;
  perform public.agent_cleanup('disposable-test-secret','deleted',jsonb_build_object('paths',snapshot));
  reset role;
  if exists(select 1 from public.chat_messages where visibility='private') then raise exception 'scheduled cleanup retained expired sessions'; end if;
  if exists(select 1 from private.agent_file_deletions where path=family::text||'/'||attachment::text) then raise exception 'deleted file queue retained'; end if;
  if not exists(select 1 from public.family_memories where family_id=family) then raise exception 'cleanup removed memory'; end if;
end $$;
rollback;
