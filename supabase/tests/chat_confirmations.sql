-- BOT-07/08/10, CAL-12, INV-11/14, CART-11 / SCN-BOT-5~7: disposable database only.
begin;
do $$
declare
  person uuid := gen_random_uuid();
  partner uuid := gen_random_uuid();
  worker uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  unit_id uuid;
  category_id uuid;
  event_id uuid;
  job jsonb;
  lease jsonb;
  proposal public.agent_proposals;
  actions jsonb;
  edited jsonb;
  snapshot jsonb;
  batch jsonb;
  summary_action jsonb;
  category_name text;
begin
    insert into auth.users(id) values (person), (partner), (worker);
  insert into public.users(id, provider, provider_user_id, display_name, terms_accepted_at, privacy_accepted_at,
    terms_version) values (person, 'google', person::text, '작성자', now(), now(), 'test'),
    (partner, 'google', partner::text, '가족', now(), now(), 'test');
  insert into public.families(id, name) values (household, '확인 검증');
  insert into public.memberships(user_id, family_id, role) values (person, household, 'admin'), (partner,
    household, 'member');
  insert into public.agent_workers(id, family_id) values (worker, household);
  select id into unit_id from public.units where family_id = household limit 1;
  actions := jsonb_build_array(jsonb_build_object('domain', 'cart', 'label', '워커 설명은 쓰지 않음',
    'expected', '{}'::jsonb, 'payload', jsonb_build_object('action', 'add',
    'duplicate', 'separate', 'item', jsonb_build_object('name', '우유',
    'quantity', 1, 'unit_id', unit_id, 'category_id', null, 'memo',
    '','link_url','', 'inventory_item_id', null))));
  if private.agent_action_label(household, actions->0) not like '%장바구니에 담을까요?' or
      private.agent_action_label(household, actions->0,false,true) not like '%장바구니 담기' or
      private.agent_action_label(household, actions->0,true) not like '%담았어요' then
    raise exception 'cart confirmation wording';
  end if;
  select id,name into category_id,category_name from public.event_categories where family_id=household limit 1;
  summary_action := jsonb_build_object('domain','event','payload',jsonb_build_object('id',null,
    'event',jsonb_build_object('title','데이부 워크샵','startDate','2026-11-06','isAllDay',true,
      'visibility','shared','categoryId',category_id)));
  if private.agent_action_label(household,summary_action) <>
      '11월 6일 종일, 데이부 워크샵, '||category_name||' 카테고리의 공유 일정으로 추가할까요?' or
      private.agent_action_label(household,summary_action,false,true) <>
      '11월 6일 종일 데이부 워크샵 공유 일정 추가 ('||category_name||')' or
      private.agent_action_label(household,summary_action,true) not like '%추가했어요' then
    raise exception 'event confirmation wording';
  end if;
  summary_action := jsonb_set(summary_action,'{payload,id}',to_jsonb(gen_random_uuid()::text));
  if private.agent_action_label(household,summary_action) not like '%공유 일정을 수정할까요?' then
    raise exception 'event edit question';
  end if;
  summary_action := jsonb_build_object('domain','inventory','payload',jsonb_build_object(
    'action','save','id',null,'item',jsonb_build_object('name','우유','quantity',2,'unit_id',unit_id)));
  if private.agent_action_label(household,summary_action) not like '%재고를 추가할까요?' then
    raise exception 'inventory question';
  end if;
  perform set_config('request.jwt.claim.sub', person::text, true);
  perform public.chat_command('send', jsonb_build_object('text', '우유 담아줘', 'clientRequestId',
    gen_random_uuid()));
  perform set_config('request.jwt.claim.sub', worker::text, true);
  job := public.agent_command('claim');
  lease := jsonb_build_object('jobId', job ->> 'id', 'leaseToken', job ->> 'leaseToken');
  perform public.agent_command('complete', lease || jsonb_build_object('kind', 'action_proposal',
    'text', '별도 긴 설명', 'actions', actions));
  select * into proposal from public.agent_proposals where run_id =(job ->> 'id')::uuid;
  if proposal.id is null or proposal.actions -> 0 ->> 'label' = '워커 설명은 쓰지 않음' then
    raise exception 'missing server summary';
  end if;
  if exists ( select 1 from public.chat_messages where family_id = household and role = 'assistant') then
    raise exception 'duplicate worker message';
  end if;
  if exists ( select 1 from public.cart_items where family_id = household) then
    raise exception 'changed before confirmation';
  end if;
  perform set_config('request.jwt.claim.sub', partner::text, true);
  if jsonb_array_length(public.chat_page() -> 'proposals') <> 0 then
    raise exception 'proposal leaked to partner';
  end if;
  begin
    perform public.chat_command('confirm-actions', jsonb_build_object('id', proposal.id, 'version',
      1, 'selected', '[0]'::jsonb));
    raise exception 'partner confirmed private proposal';
  exception
    when others then
      if sqlerrm <> 'not_found' then
        raise;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', person::text, true);
  edited := jsonb_set(proposal.actions, '{0,payload,item,name}', '"두유"');
  perform public.chat_command('edit-actions', jsonb_build_object('id', proposal.id, 'version',
    1, 'actions', edited));
  -- Editing does not renew target revisions or execute any writes.
  if exists ( select 1 from public.cart_items where family_id = household) then
    raise exception 'edit executed';
  end if;
  begin
    perform public.chat_command('edit-actions', jsonb_build_object('id', proposal.id,
      'version', 2, 'actions', jsonb_set(edited, '{0,expected}', '{"bad":"00000000000000000000000000000000"}')));
    raise exception 'edit refreshed expected revisions';
  exception
    when others then
      if sqlerrm <> 'invalid_chat' then
        raise;
    end if;
  end;
  update public.chat_messages set created_at = now() - interval '2 hours' where family_id = household;
  if public.chat_page() ->> 'expiresAt' is not null then
    raise exception 'draft session expired';
  end if;
  if not exists ( select 1 from public.agent_proposals where id = proposal.id) then
    raise exception 'editing lost draft';
  end if;
  perform public.chat_command('confirm-actions', jsonb_build_object('id', proposal.id,
    'version', 2, 'selected', '[0]'::jsonb));
  if not exists ( select 1 from public.cart_items where family_id = household and name = '두유')
    then
    raise exception 'edited value not applied';
  end if;
  if ( select count(*) from public.chat_messages where family_id = household and role = 'assistant' and
    text like '%두유%담았어요') <> 1 then
    raise exception 'missing result message';
  end if;
  perform public.chat_command('confirm-actions', jsonb_build_object('id', proposal.id,
    'version', 2, 'selected', '[0]'::jsonb));
  if ( select count(*) from public.chat_messages where family_id = household and role = 'assistant') <>
    1 then
    raise exception 'duplicate confirmation result';
  end if;
  perform public.chat_command('send', jsonb_build_object('text', '폐기할값 담아줘',
    'clientRequestId', gen_random_uuid()));
  perform set_config('request.jwt.claim.sub', worker::text, true);
  job := public.agent_command('claim');
  lease := jsonb_build_object('jobId', job ->> 'id', 'leaseToken', job ->>
    'leaseToken');
  perform public.agent_command('complete', lease || jsonb_build_object('kind',
    'action_proposal', 'text', '확인', 'actions', actions));
  select * into proposal from public.agent_proposals where run_id =(job ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', person::text, true);
  perform public.chat_command('cancel-actions', jsonb_build_object('id', proposal.id,
    'version', 1));
  if ( select p.actions from public.agent_proposals p where p.id = proposal.id) <> '[]'::jsonb
    then
    raise exception 'cancel retained values';
  end if;
  perform public.chat_command('send', jsonb_build_object('text', '새로운 요청',
    'clientRequestId', gen_random_uuid()));
  perform set_config('request.jwt.claim.sub', worker::text, true);
  job := public.agent_command('claim');
  lease := jsonb_build_object('jobId', job ->> 'id', 'leaseToken', job ->>
    'leaseToken');
  snapshot := public.agent_command('context', lease);
  if snapshot -> 'history' @> '[{"text":"폐기할값 담아줘"}]'::jsonb then
    raise exception 'cancelled input reused';
  end if;
  -- The second action fails during execution; the first action must roll back too.
  batch := jsonb_set(actions, '{0,payload,item,name}', '"한꺼번에"');
  batch := batch || jsonb_build_array(jsonb_set(batch -> 0, '{payload,duplicate}', '"ask"'));
  perform public.agent_command('complete', lease || jsonb_build_object('kind',
    'action_proposal', 'text', '확인', 'actions', batch));
  select * into proposal from public.agent_proposals where run_id =(job ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', person::text, true);
  begin
    perform public.chat_command('confirm-actions', jsonb_build_object('id', proposal.id,
      'version', 1, 'selected', '[0,1]'::jsonb));
    raise exception 'partial batch committed';
  exception
    when others then
      if sqlerrm <> 'cart_duplicate' then
        raise;
    end if;
  end;
  if exists ( select 1 from public.cart_items where family_id = household and name = '한꺼번에') then
    raise exception 'batch was not atomic';
  end if;
  perform public.chat_command('confirm-actions', jsonb_build_object('id', proposal.id,
    'version', 1, 'selected', '[0]'::jsonb));
  if not exists ( select 1 from public.cart_items where family_id = household and name = '한꺼번에')
    then
    raise exception 'remaining line failed';
  end if;
  select id into category_id from public.event_categories where family_id = household limit 1;
  event_id := public.save_event(null, 'PRIVATE_TITLE', 'PRIVATE_PLACE', 'PRIVATE_MEMO', category_id,
    'private', date '2026-11-07', date '2026-11-07', time '15:00', null, false);
  perform set_config('request.jwt.claim.sub', partner::text, true);
  perform public.chat_command('send', jsonb_build_object('text', '일정 삭제',
    'clientRequestId', gen_random_uuid()));
  perform set_config('request.jwt.claim.sub', worker::text, true);
  job := public.agent_command('claim');
  lease := jsonb_build_object('jobId', job ->> 'id', 'leaseToken', job ->>
    'leaseToken');
  snapshot := public.agent_command('context', lease);
  if snapshot::text like '%PRIVATE_%' then
    raise exception 'private contents leaked';
  end if;
  begin
    perform public.agent_command('complete', lease || jsonb_build_object('kind',
      'action_proposal', 'text', '삭제', 'actions',
      jsonb_build_array(jsonb_build_object('domain', 'event', 'label',
      '삭제', 'payload', jsonb_build_object('action', 'delete',
      'id', event_id, 'occurrenceDate', null, 'scope', null)))));
    raise exception 'partner private deletion proposal accepted';
  exception
    when others then
      if sqlerrm <> 'event_forbidden' then
        raise;
    end if;
  end;
  perform public.agent_command('fail', lease || jsonb_build_object('code', 'cancelled'));
  perform set_config('request.jwt.claim.sub', person::text, true);
  perform public.chat_command('send', jsonb_build_object(
    'text', '내 개인 일정 삭제', 'clientRequestId', gen_random_uuid()
  ));
  perform set_config('request.jwt.claim.sub', worker::text, true);
  job := public.agent_command('claim');
  lease := jsonb_build_object('jobId', job->>'id', 'leaseToken', job->>'leaseToken');
  snapshot := public.agent_command('context', lease);
  actions := jsonb_build_array(jsonb_build_object(
    'domain', 'event', 'label', '삭제', 'expected', snapshot->'calendar'->'revisions',
    'payload', jsonb_build_object('action', 'delete', 'id', event_id, 'occurrenceDate', null, 'scope', null)
  ));
  perform public.agent_command('complete', lease || jsonb_build_object(
    'kind', 'action_proposal', 'text', '삭제', 'actions', actions
  ));
  select * into proposal from public.agent_proposals where run_id=(job->>'id')::uuid;
  if proposal.actions->0->>'label' not like '%개인 일정을 삭제할까요?' then
    raise exception 'event deletion question';
  end if;
  perform set_config('request.jwt.claim.sub', person::text, true);
  perform public.chat_command('confirm-actions', jsonb_build_object(
    'id', proposal.id, 'version', 1, 'selected', '[0]'::jsonb
  ));
  if exists(select 1 from public.events where id=event_id) then
    raise exception 'confirmed event deletion failed';
  end if;
  if not exists(select 1 from public.chat_messages where viewer_id=person and text like '%PRIVATE_TITLE%삭제했어요') then
    raise exception 'event deletion result missing';
  end if;

end
$$;
rollback;
