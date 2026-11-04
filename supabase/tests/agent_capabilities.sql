-- CAL-02/03/04, INV-02/07/16, CART-01/07, BOT-06/07/08/10/11.
-- SCN-CAL-2/4, SCN-CART-4, SCN-BOT-5/6/7: disposable PostgreSQL only.
begin;
create function pg_temp.start_agent_turn(person uuid, worker uuid, scope text default 'private') returns jsonb language plpgsql as $$
declare job jsonb;
begin
  perform set_config('request.jwt.claim.sub',person::text,true);
  perform public.chat_command('send',jsonb_build_object('visibility',scope,'text','요청한 작업 실행','clientRequestId',gen_random_uuid()));
  perform set_config('request.jwt.claim.sub',worker::text,true);
  job:=public.agent_command('claim');
  return jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken');
end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if sqlerrm=expected then return; end if; raise;
  end;
  raise exception 'Expected error: %',expected;
end $$;
do $$
declare
  person uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid();
  household uuid:=gen_random_uuid(); other_family uuid:=gen_random_uuid(); stock uuid:=gen_random_uuid();
  unit uuid; category uuid; location uuid; event_category uuid; own_event uuid; partner_event uuid; cart uuid; attachment uuid; proposal uuid;
  lease jsonb; context jsonb; result jsonb; action jsonb; actions jsonb; event_input jsonb; snapshot jsonb; request_id uuid:=gen_random_uuid();
begin
  insert into auth.users(id) values(person),(partner),(outsider),(worker);
  insert into public.users(id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version) values
    (person,'google',person::text,'작성자',now(),now(),'test'),(partner,'google',partner::text,'배우자',now(),now(),'test'),(outsider,'google',outsider::text,'외부',now(),now(),'test');
  insert into public.families(id,name) values(household,'확장 검증'),(other_family,'다른 가정');
  insert into public.memberships(user_id,family_id,role) values(person,household,'admin'),(partner,household,'member'),(outsider,other_family,'admin');
  insert into public.agent_workers(id,family_id) values(worker,household);
  select id into unit from public.units where family_id=household limit 1;
  select id into category from public.inventory_categories where family_id=household limit 1;
  select id into location from public.locations where family_id=household and enabled limit 1;
  select id into event_category from public.event_categories where family_id=household limit 1;
  insert into public.inventory_items(id,family_id,name,quantity,unit_id) values(stock,household,'우유',5,unit);
  event_input:=jsonb_build_object('title','내 비공개 진료','place','비밀 장소','memo','비밀 메모','categoryId',event_category,'visibility','private','startDate','2026-11-10','endDate','2026-11-10','startTime',null,'endTime',null,'isAllDay',true,'kind','event','recurrence',null);
  set local role authenticated;

  -- Private calendar creation reuses save_event with the original user's identity.
  lease:=pg_temp.start_agent_turn(person,worker,'private');
  action:=jsonb_build_object('domain','event','label','개인 일정 등록','payload',jsonb_build_object('id',null,'event',event_input),'expected','{}'::jsonb);
  result:=public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','등록했어요','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  own_event:=(result->0->'result'->>'id')::uuid;
  if auth.uid()<>worker then raise exception 'worker identity not restored'; end if;
  perform pg_temp.expect_error(format('select public.agent_command(''complete'',%L::jsonb)',lease||jsonb_build_object('kind','reply','text','중복')), 'lease_lost');
  lease:=pg_temp.start_agent_turn(partner,worker,'private');
  action:=jsonb_set(action,'{payload,event,title}','"배우자 비밀"');
  result:=public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','등록','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  partner_event:=(result->0->'result'->>'id')::uuid;
  lease:=pg_temp.start_agent_turn(person,worker,'private');
  context:=public.agent_command('context',lease);
  if context::text not like '%내 비공개 진료%' or context::text like '%배우자 비밀%' then raise exception 'private calendar scope leaked'; end if;
  if context->'calendar'->'revisions' ? partner_event::text then raise exception 'partner revision leaked'; end if;
  action:=jsonb_build_object('domain','event','label','개인 일정 변경','payload',jsonb_build_object('id',own_event,'event',event_input||'{"title":"변경한 진료"}'),'expected',context->'calendar'->'revisions');
  perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','변경','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  perform set_config('request.jwt.claim.sub',person::text,true);
  perform pg_temp.expect_error('select public.chat_page(''{"visibility":"shared"}'')','private_chat_required');

  -- Partner cannot read/cancel a private run or read the other user's private photos.
  perform set_config('request.jwt.claim.sub',person::text,true);
  result:=public.chat_command('attachment-create','{"visibility":"private","mimeType":"image/jpeg"}'); attachment:=(result->>'id')::uuid;
  reset role; update public.chat_attachments set status='ready' where id=attachment; set local role authenticated;
  if (public.chat_command('attachment-read',jsonb_build_object('id',attachment))->>'id')::uuid<>attachment then raise exception 'owner cannot read private photo'; end if;
  result:=public.chat_command('send',jsonb_build_object('visibility','private','text','나만 보는 질문','clientRequestId',request_id));
  perform set_config('request.jwt.claim.sub',partner::text,true);
  snapshot:=public.chat_command('list','{"visibility":"private"}');
  if snapshot::text like '%나만 보는 질문%' or snapshot::text like '%개인 일정 변경%' or snapshot::text like '%'||attachment::text||'%' then raise exception 'private chat leaked'; end if;
  perform pg_temp.expect_error(format('select public.chat_command(''cancel'',%L::jsonb)',result),'state_conflict');
  perform pg_temp.expect_error(format('select public.chat_command(''send'',%L::jsonb)',jsonb_build_object('visibility','private','text','나만 보는 질문','clientRequestId',request_id)),'state_conflict');
  perform pg_temp.expect_error(format('select public.chat_command(''attachment-read'',%L::jsonb)',jsonb_build_object('id',attachment)),'attachment_expired');
  perform set_config('request.jwt.claim.sub',person::text,true);
  perform public.chat_command('cancel',result);

  -- Inventory decrement, transaction rollback, and stale snapshot rejection.
  lease:=pg_temp.start_agent_turn(person,worker);
  context:=public.agent_command('context',lease);
  action:=jsonb_build_object('domain','inventory','label','우유 차감','payload',jsonb_build_object('action','adjust','id',stock,'delta',-2),'expected',jsonb_build_object(stock::text,context->'inventory'->0->>'revision'));
  perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','차감','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  lease:=pg_temp.start_agent_turn(person,worker);
  perform pg_temp.expect_error(format('select public.agent_command(''complete'',%L::jsonb)',lease||jsonb_build_object('kind','actions','text','오래된 변경','requestQuote','작업 실행','actions',jsonb_build_array(action))),'state_conflict');
  context:=public.agent_command('context',lease);
  action:=jsonb_set(action,'{expected}',jsonb_build_object(stock::text,context->'inventory'->0->>'revision'));
  actions:=jsonb_build_array(action,jsonb_build_object('domain','inventory','label','잘못된 항목','payload',jsonb_build_object('action','save','id',null,'item',jsonb_build_object('name','잘못된 단위','mode','quantity','quantity',1,'unit_id',gen_random_uuid()))));
  perform pg_temp.expect_error(format('select public.agent_command(''complete'',%L::jsonb)',lease||jsonb_build_object('kind','actions','text','묶음','requestQuote','작업 실행','actions',actions)),'invalid_inventory');
  context:=public.agent_command('context',lease);
  if (context->'inventory'->0->>'quantity')::numeric<>3 then raise exception 'partial mutation committed'; end if;
  if auth.uid()<>worker then raise exception 'failed mutation changed identity'; end if;
  perform public.agent_command('complete',lease||'{"kind":"reply","text":"재확인해 주세요"}');

  -- Existing inventory edit retains quantity and changes only the requested metadata.
  lease:=pg_temp.start_agent_turn(person,worker); context:=public.agent_command('context',lease);
  action:=jsonb_build_object('domain','inventory','label','우유 유통기한 수정','payload',jsonb_build_object('action','save','id',stock,'item',(context->'inventory'->0)||jsonb_build_object('expires_on','2026-12-01','location_id',location,'category_id',category)),'expected',jsonb_build_object(stock::text,context->'inventory'->0->>'revision'));
  perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','수정','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  reset role;
  if not exists(select 1 from public.inventory_items where id=stock and quantity=3 and expires_on='2026-12-01') then raise exception 'inventory edit failed'; end if;
  set local role authenticated;

  -- Cart add and purchase completion atomically check, restock, and close the cart row.
  lease:=pg_temp.start_agent_turn(person,worker);
  action:=jsonb_build_object('domain','cart','label','우유 장바구니 추가','payload',jsonb_build_object('action','add','duplicate','ask','item',jsonb_build_object('name','우유','quantity',2,'unit_id',unit,'category_id',category,'inventory_item_id',stock,'memo','','link_url','')));
  perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','추가','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  lease:=pg_temp.start_agent_turn(person,worker);
  perform pg_temp.expect_error(format('select public.agent_command(''complete'',%L::jsonb)',lease||jsonb_build_object('kind','actions','text','중복','requestQuote','작업 실행','actions',jsonb_build_array(action))),'cart_duplicate');
  context:=public.agent_command('context',lease); cart:=(context->'cart'->0->>'id')::uuid;
  action:=jsonb_build_object('domain','cart','label','우유 구매 완료','payload',jsonb_build_object('action','restock','entries',jsonb_build_array(jsonb_build_object('id',cart,'quantity',2,'unit_id',unit,'category_id',category,'location_id',location,'expires_on',null))),'expected',jsonb_build_object(cart::text,context->'cart'->0->>'revision',stock::text,context->'inventory'->0->>'revision'));
  result:=public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','구매 완료','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  perform pg_temp.expect_error(format('select public.agent_command(''complete'',%L::jsonb)',lease||jsonb_build_object('kind','actions','text','중복 구매','requestQuote','작업 실행','actions',jsonb_build_array(action))),'lease_lost');
  reset role;
  if (select quantity from public.inventory_items where id=stock)<>5 or (select purchased_at from public.cart_items where id=cart) is null then raise exception 'purchase did not restock once'; end if;
  set local role authenticated;

  -- Suggested deletes require confirmation, are private, versioned, and idempotent.
  lease:=pg_temp.start_agent_turn(person,worker,'private'); context:=public.agent_command('context',lease);
  action:=jsonb_build_object('domain','inventory','label','우유 삭제','payload',jsonb_build_object('action','delete','id',stock),'expected',jsonb_build_object(stock::text,context->'inventory'->0->>'revision'));
  perform public.agent_command('complete',lease||jsonb_build_object('kind','action_proposal','text','삭제할까요?','actions',jsonb_build_array(action)));
  perform set_config('request.jwt.claim.sub',person::text,true);
  snapshot:=public.chat_command('list','{"visibility":"private"}'); proposal:=(snapshot->'proposals'->0->>'id')::uuid;
  if proposal is null then raise exception 'proposal missing'; end if;
  perform set_config('request.jwt.claim.sub',partner::text,true);
  perform pg_temp.expect_error(format('select public.chat_command(''confirm-actions'',%L::jsonb)',jsonb_build_object('id',proposal,'version',1,'selected',jsonb_build_array(0))),'not_found');
  perform set_config('request.jwt.claim.sub',person::text,true);
  result:=public.chat_command('confirm-actions',jsonb_build_object('id',proposal,'version',1,'selected',jsonb_build_array(0)));
  if result is distinct from public.chat_command('confirm-actions',jsonb_build_object('id',proposal,'version',1,'selected',jsonb_build_array(0))) then raise exception 'proposal replay changed'; end if;
  reset role;
  if exists(select 1 from public.inventory_items where id=stock) then raise exception 'confirmed delete failed'; end if;
  if to_regclass('realtime.test_messages') is not null then
    execute 'select to_jsonb(exists(select 1 from realtime.test_messages where topic=$1 and payload<>''{"changed":true}''::jsonb))' into result using 'family:'||household::text||':chat';
    if result='true'::jsonb then raise exception 'private broadcast leaked'; end if;
  end if;
  set local role authenticated;
  -- A proposed shared calendar change expires after five minutes.
  lease:=pg_temp.start_agent_turn(person,worker);
  action:=jsonb_build_object('domain','event','label','공유 일정 제안','payload',jsonb_build_object('id',null,'event',event_input||'{"visibility":"shared","title":"공유 약속"}'));
  perform public.agent_command('complete',lease||jsonb_build_object('kind','action_proposal','text','등록할까요?','actions',jsonb_build_array(action)));
  reset role;
  update public.agent_proposals set expires_at=now()-interval '1 second' where run_id=(lease->>'jobId')::uuid returning id into proposal;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',person::text,true);
  perform pg_temp.expect_error(format('select public.chat_command(''confirm-actions'',%L::jsonb)',jsonb_build_object('id',proposal,'version',1,'selected',jsonb_build_array(0))),'state_conflict');
  -- Without an exact user request, direct changes must fail before saving anything.
  lease:=pg_temp.start_agent_turn(person,worker);
  perform pg_temp.expect_error(format('select public.agent_command(''complete'',%L::jsonb)',lease||jsonb_build_object('kind','actions','text','등록','requestQuote','모델이 지어낸 요청','actions',jsonb_build_array(action))),'confirmation_required');
  perform public.agent_command('complete',lease||jsonb_build_object('kind','actions','text','등록','requestQuote','작업 실행','actions',jsonb_build_array(action)));
  -- A user who left the family cannot execute a previously queued action.
  lease:=pg_temp.start_agent_turn(partner,worker,'private');
  reset role; delete from public.memberships where user_id=partner; set local role authenticated;
  perform pg_temp.expect_error(format('select public.agent_command(''context'',%L::jsonb)',lease),'forbidden');
  perform pg_temp.expect_error(format('select public.agent_command(''complete'',%L::jsonb)',lease||jsonb_build_object('kind','actions','text','등록','requestQuote','작업 실행','actions',jsonb_build_array(action))),'forbidden');
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if jsonb_array_length(public.chat_command('list')->'messages')<>0 then raise exception 'other household leaked'; end if;
  perform pg_temp.expect_error('select public.agent_command(''claim'')','forbidden');
end $$;
rollback;
