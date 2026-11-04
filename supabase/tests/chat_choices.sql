-- BOT-07 / SCN-BOT-5: disposable PostgreSQL only.
begin;
do $$
declare
  person uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid(); household uuid:=gen_random_uuid();
  job jsonb; lease jsonb; snapshot jsonb; answer text;
  actions jsonb:='[{"domain":"cart","label":"우유 담기","payload":{"action":"add","item":{"name":"우유","quantity":1}},"expected":{}}]';
  choices jsonb:='[{"label":"공유 일정","value":"shared"},{"label":"개인 일정","value":"private"}]';
begin
  insert into auth.users(id) values(person),(worker);
  insert into public.users(id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version)
    values(person,'google',person::text,'작성자',now(),now(),'test');
  insert into public.families(id,name) values(household,'선택지 검증');
  insert into public.memberships(user_id,family_id,role) values(person,household,'admin');
  insert into public.agent_workers(id,family_id) values(worker,household);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',person::text,true);
  perform public.chat_command('send',jsonb_build_object('text','일정을 등록해 줘','clientRequestId',gen_random_uuid()));
  perform set_config('request.jwt.claim.sub',worker::text,true);
  job:=public.agent_command('claim');
  lease:=jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken');
  begin
    perform public.agent_command('complete',lease||jsonb_build_object('kind','reply','text','공개 범위는요?',
      'choices',jsonb_set(choices,'{0,extra}','true')));
    raise exception 'unexpected extra choice key accepted';
  exception when others then
    if sqlerrm<>'invalid_chat' then raise; end if;
  end;
  begin
    perform public.agent_command('complete',lease||jsonb_build_object('kind','reply','text','질문',
      'awaitingAnswer','true'));
    raise exception 'non-boolean awaitingAnswer accepted';
  exception when others then
    if sqlerrm<>'invalid_chat' then raise; end if;
  end;
  perform public.agent_command('complete',lease||jsonb_build_object('kind','reply','text','공개 범위는요?','choices',choices));
  if not exists(select 1 from public.chat_messages where family_id=household and role='assistant'
    and awaiting_answer) then raise exception 'choices did not mark awaiting_answer'; end if;
  perform set_config('request.jwt.claim.sub',person::text,true);
  perform public.chat_command('send',jsonb_build_object('text','공유 일정','clientRequestId',gen_random_uuid()));
  perform set_config('request.jwt.claim.sub',worker::text,true);
  job:=public.agent_command('claim');
  lease:=jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken');
  snapshot:=public.agent_command('context',lease);
  if snapshot->'history'->1->'choices' is distinct from choices then
    raise exception 'history lost choice labels or values';
  end if;
  begin
    perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','담았어요',
      'requestQuote','공유 일정','actions',actions));
    raise exception 'clarification answer executed without confirmation';
  exception when others then
    if sqlerrm<>'confirmation_required' then raise; end if;
  end;
  perform public.agent_command('complete',lease||jsonb_build_object('kind','action_proposal',
    'text','확인해 주세요','actions',actions));
  perform set_config('request.jwt.claim.sub',person::text,true);
  if not exists(select 1 from public.agent_proposals where run_id=(job->>'id')::uuid
    and expires_at between now()+interval '4 minutes' and now()+interval '5 minutes') then
    raise exception 'missing five-minute confirmation card';
  end if;
  -- BOT-07/08 / SCN-BOT-5~6: free-text answers also need a confirmation card.
  foreach answer in array array['내일','네'] loop
    perform public.chat_command('send',jsonb_build_object('text','계속 등록해 줘','clientRequestId',gen_random_uuid()));
    perform set_config('request.jwt.claim.sub',worker::text,true);
    job:=public.agent_command('claim');
    lease:=jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken');
    perform public.agent_command('complete',lease||jsonb_build_object('kind','reply',
      'text','언제로 등록할까요?','awaitingAnswer',true));
    if not exists(select 1 from public.chat_messages where family_id=household and text='언제로 등록할까요?'
      and awaiting_answer and choices='[]'::jsonb) then raise exception 'free-text question marker missing'; end if;
    perform set_config('request.jwt.claim.sub',person::text,true);
    perform public.chat_command('send',jsonb_build_object('text',answer,'clientRequestId',gen_random_uuid()));
    perform set_config('request.jwt.claim.sub',worker::text,true);
    job:=public.agent_command('claim');
    lease:=jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken');
    begin
      perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','담았어요',
        'requestQuote',answer,'actions',actions));
      raise exception 'free-text answer executed without confirmation';
    exception when others then
      if sqlerrm<>'confirmation_required' then raise; end if;
    end;
    perform public.agent_command('complete',lease||jsonb_build_object('kind','action_proposal',
      'text','확인해 주세요','actions',actions));
    perform set_config('request.jwt.claim.sub',person::text,true);
    if exists(select 1 from public.cart_items where family_id=household) then
      raise exception 'proposal changed cart before confirmation';
    end if;
    if not exists(select 1 from public.agent_proposals where run_id=(job->>'id')::uuid
      and expires_at between now()+interval '4 minutes' and now()+interval '5 minutes') then
      raise exception 'free-text answer missing five-minute confirmation card';
    end if;
  end loop;
  -- A complete, direct request still executes immediately after an ordinary reply.
  perform public.chat_command('send',jsonb_build_object('text','우유 담아줘','clientRequestId',gen_random_uuid()));
  perform set_config('request.jwt.claim.sub',worker::text,true);
  job:=public.agent_command('claim');
  lease:=jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken');
  perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','담았어요',
    'requestQuote','우유 담아줘','actions',actions));
  perform set_config('request.jwt.claim.sub',person::text,true);
  if not exists(select 1 from public.cart_items where family_id=household and name='우유') then
    raise exception 'direct request did not execute';
  end if;
end $$;
rollback;
