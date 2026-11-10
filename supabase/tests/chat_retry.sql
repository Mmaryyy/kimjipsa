-- BOT-01/14: same-message retry, ownership, idempotency and expiry. Local database only.
begin;
do $$
<<chat_retry>>
declare
  person uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid();
  family uuid:=gen_random_uuid(); first_job uuid; retry_job uuid; message_id uuid; request_id uuid;
  result jsonb; snapshot jsonb; status text; attachment uuid:=gen_random_uuid();
  other_family uuid:=gen_random_uuid(); other_person uuid:=gen_random_uuid(); foreign_job uuid;
  second_job uuid;
begin
  insert into auth.users(id) values(person),(partner),(worker);
  insert into public.users(
    id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version
  )
    select id,'google',id::text,'테스트',now(),now(),'test' from auth.users where id in(person,partner);
  insert into public.families(id,name) values(family,'재시도 확인');
  insert into public.memberships(user_id,family_id,role) values(person,family,'admin'),(partner,family,'member');
  insert into public.agent_workers(id,family_id) values(worker,family);
  perform set_config('request.jwt.claim.sub',person::text,true);
  set local role authenticated;
  result:=public.chat_command('send',jsonb_build_object('text','같은 요청','clientRequestId',gen_random_uuid()));
  first_job:=(result->>'id')::uuid;
  foreach status in array array['queued','running','completed'] loop
    reset role;
    update public.agent_runs set status=chat_retry.status where id=first_job;
    set local role authenticated;
    begin
      perform public.chat_command('retry',jsonb_build_object('id',first_job,'clientRequestId',gen_random_uuid()));
      raise exception 'active or completed retry accepted';
    exception when raise_exception then if sqlerrm<>'state_conflict' then raise; end if; end;
  end loop;
  reset role;
  select input_message_id into message_id from public.agent_runs where id=first_job;
  update public.agent_runs set status='failed' where id=first_job;
  perform set_config('request.jwt.claim.sub',partner::text,true);
  set local role authenticated;
  begin
    perform public.chat_command('retry',jsonb_build_object('id',first_job,'clientRequestId',gen_random_uuid()));
    raise exception 'partner retry accepted';
  exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',person::text,true);
  request_id:=gen_random_uuid();
  result:=public.chat_command('retry',jsonb_build_object('id',first_job,'clientRequestId',request_id));
  retry_job:=(result->>'id')::uuid;
  if public.chat_command('retry',jsonb_build_object('id',first_job,'clientRequestId',request_id))<>result
    then raise exception 'duplicate request created another run'; end if;
  begin
    perform public.chat_command('retry',jsonb_build_object('id',first_job,'clientRequestId',gen_random_uuid()));
    raise exception 'stale run retry accepted';
  exception when raise_exception then if sqlerrm<>'state_conflict' then raise; end if; end;
  snapshot:=public.chat_page();
  if jsonb_array_length(snapshot->'messages')<>1 or jsonb_array_length(snapshot->'runs')<>1
    or snapshot->'runs'->0->>'id'<>retry_job::text or snapshot->'runs'->0->>'status'<>'queued'
    then raise exception 'retry duplicated message or did not select latest run'; end if;
  -- BOT-14: retry at minute 59 renews the expiry exposed to the client and used by cleanup.
  reset role;
  update public.chat_messages set created_at=now()-interval '59 minutes' where id=message_id;
  update public.agent_runs set created_at=now()-interval '60 minutes',status='failed' where family_id=family;
  update public.agent_runs set created_at=now()-interval '59 minutes' where id=retry_job;
  set local role authenticated;
  result:=public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
  retry_job:=(result->>'id')::uuid;
  snapshot:=public.chat_page();
  if (snapshot->>'expiresAt')::timestamptz < now()+interval '59 minutes'
    then raise exception 'retry did not renew expiry'; end if;
  reset role;
  update public.chat_messages set created_at=now()-interval '61 minutes' where id=message_id;
  if private.expire_chat(family,person) then raise exception 'retry activity ignored by cleanup'; end if;
  set local role authenticated;
  foreach status in array array['cancelled','unknown'] loop
    reset role;
    update public.agent_runs set status=chat_retry.status where id=retry_job;
    set local role authenticated;
    result:=public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
    retry_job:=(result->>'id')::uuid;
  end loop;
  -- Unknown work with committed actions must remain fenced even after a user retry.
  reset role;
  update public.agent_runs set status='unknown' where id=retry_job;
  insert into private.agent_actions(run_id,action_id,input,result) values(retry_job,'retry-test','{}','{}');
  set local role authenticated;
  begin
    perform public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
    raise exception 'unknown action record retry accepted';
  exception when raise_exception then if sqlerrm<>'state_conflict' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',worker::text,true);
  if public.agent_command('claim') is distinct from 'null'::jsonb
    then raise exception 'unknown action record unfenced'; end if;
  reset role;
  delete from private.agent_actions where run_id=retry_job;
  update public.agent_runs set status='failed' where id=retry_job;
  perform set_config('request.jwt.claim.sub',person::text,true);
  set local role authenticated;
  result:=public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
  retry_job:=(result->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',worker::text,true);
  result:=public.agent_command('claim');
  if result->>'id' is distinct from retry_job::text
    then raise exception 'unknown predecessor blocked explicit retry'; end if;
  perform set_config('request.jwt.claim.sub',person::text,true);
  reset role;
  if (select count(*) from public.chat_messages where family_id=family)<>1
    or (select input_message_id from public.agent_runs where id=retry_job)<>message_id
    then raise exception 'retry changed the input message'; end if;
  -- A running request can be cancelled then retried immediately; its old lease stays revoked.
  set local role authenticated;
  perform public.chat_command('cancel',jsonb_build_object('id',retry_job));
  result:=public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
  retry_job:=(result->>'id')::uuid;
  reset role;
  -- Expired attachments reject retry without creating a new request.
  insert into public.chat_attachments(
    id,family_id,uploaded_by,visibility,path,mime_type,status,expires_at
  )
    values(attachment,family,person,'private','retry-test','image/png','ready',now()-interval '1 second');
  update public.chat_messages set attachment_ids=array[attachment] where id=message_id;
  update public.agent_runs set status='failed' where id=retry_job;
  set local role authenticated;
  begin
    perform public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
    raise exception 'expired attachment retry accepted';
  exception when raise_exception then if sqlerrm<>'attachment_expired' then raise; end if; end;
  reset role;
  update public.chat_messages set attachment_ids='{}' where id=message_id;
  set local role authenticated;
  result:=public.chat_command('send',jsonb_build_object('text','다음 요청','clientRequestId',gen_random_uuid()));
  second_job:=(result->>'id')::uuid;
  begin
    perform public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
    raise exception 'older user message retry accepted';
  exception when raise_exception then if sqlerrm<>'state_conflict' then raise; end if; end;
  reset role;
  update public.agent_runs set status='failed' where id=second_job;
  set local role authenticated;
  begin
    perform public.chat_command('retry',jsonb_build_object('id',second_job,'clientRequestId',request_id));
    raise exception 'request id reused across messages';
  exception when raise_exception then if sqlerrm<>'state_conflict' then raise; end if; end;
  reset role;
  insert into auth.users(id) values(other_person);
  insert into public.users(id,provider,provider_user_id,display_name)
    values(other_person,'google',other_person::text,'다른 집');
  insert into public.families(id,name) values(other_family,'다른 가정');
  insert into public.memberships(user_id,family_id,role) values(other_person,other_family,'admin');
  perform set_config('request.jwt.claim.sub',other_person::text,true);
  set local role authenticated;
  result:=public.chat_command('send',
    jsonb_build_object('text','다른 집 요청','clientRequestId',gen_random_uuid()));
  foreign_job:=(result->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',person::text,true);
  begin
    perform public.chat_command('retry',jsonb_build_object('id',foreign_job,'clientRequestId',gen_random_uuid()));
    raise exception 'foreign family retry accepted';
  exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
  reset role;
  update public.chat_messages set created_at=now()-interval '1 hour' where family_id=family;
  update public.agent_runs set created_at=now()-interval '1 hour' where family_id=family;
  retry_job:=second_job;
  update public.agent_runs set status='failed' where id=retry_job;
  set local role authenticated;
  result:=public.chat_command('retry',jsonb_build_object('id',retry_job,'clientRequestId',gen_random_uuid()));
  if result->>'chatExpired' is distinct from 'true' then raise exception 'expired retry accepted'; end if;
  reset role;
  if exists(select 1 from public.chat_messages where id=message_id)
    then raise exception 'expired retry rolled back deletion'; end if;
end $$;
rollback;
