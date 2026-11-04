-- BOT-01/10/11: newest-first history, cursor stability, and private metadata isolation.
-- Disposable database only; all fixtures are rolled back.
begin;
do $$
declare
  person uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  household uuid:=gen_random_uuid(); other_family uuid:=gen_random_uuid();
  message uuid; attachment uuid; job uuid; page jsonb; entry jsonb;
  seen bigint[]:='{}'; cursor_sequence bigint; first_cursor bigint;
begin
  insert into auth.users(id) values(person),(partner),(outsider);
  insert into public.users(id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version)
    select id,'google',id::text,'테스트',now(),now(),'test' from auth.users where id in(person,partner,outsider);
  insert into public.families(id,name) values(household,'페이지 가정'),(other_family,'다른 가정');
  insert into public.memberships(user_id,family_id,role) values(person,household,'admin'),(partner,household,'member'),(outsider,other_family,'admin');
  for n in 1..121 loop
    insert into public.chat_attachments(family_id,uploaded_by,visibility,path,mime_type,status)
      values(household,person,'private','test/'||gen_random_uuid(),'image/jpeg','ready') returning id into attachment;
    insert into public.chat_messages(family_id,author_id,viewer_id,visibility,role,text,attachment_ids)
      values(household,person,person,'private','user','내 대화 '||n,array[attachment]) returning id into message;
    insert into public.agent_runs(family_id,input_message_id,client_request_id,config_version)
      values(household,message,gen_random_uuid(),1) returning id into job;
    insert into public.receipt_imports(family_id,run_id,kind,items,expires_at)
      values(household,job,'receipt','[]',now()+interval '7 days');
    insert into public.agent_proposals(family_id,run_id,actions) values(household,job,'[]');
  end loop;
  insert into public.chat_messages(family_id,author_id,viewer_id,visibility,role,text)
    select household,partner,partner,'private','user','배우자 비공개 '||n from generate_series(1,57) n;
  insert into public.chat_messages(family_id,author_id,role,text)
    values(other_family,outsider,'user','다른 가정 메시지');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',person::text,true);
  page:=public.chat_page();
  if jsonb_array_length(page->'messages')<>50 or page->'messages'->0->>'text'<>'내 대화 72'
    or page->'messages'->49->>'text'<>'내 대화 121' then raise exception 'initial page is not latest 50'; end if;
  if jsonb_array_length(page->'runs')<>50 or jsonb_array_length(page->'receipts')<>50
    or jsonb_array_length(page->'proposals')<>50 or jsonb_array_length(page->'attachments')<>50
    then raise exception 'metadata was not bounded to the page'; end if;
  if page::text like '%배우자%' or page::text like '%다른 가정%' or page::text like '%lease_token%'
    then raise exception 'page leaked private data'; end if;
  first_cursor:=(page->>'nextBefore')::bigint;
  loop
    for entry in select value from jsonb_array_elements(page->'messages') loop
      if (entry->>'sequence')::bigint=any(seen) then raise exception 'duplicate message'; end if;
      seen:=array_append(seen,(entry->>'sequence')::bigint);
    end loop;
    cursor_sequence:=(page->>'nextBefore')::bigint;
    exit when cursor_sequence is null;
    page:=public.chat_page(jsonb_build_object('before',cursor_sequence));
    if (page->'messages'->0->>'sequence')::bigint>=cursor_sequence then raise exception 'cursor is not exclusive'; end if;
  end loop;
  if cardinality(seen)<>121 then raise exception 'pagination skipped messages'; end if;
  -- New messages do not shift the earlier page boundary.
  reset role;
  insert into public.chat_messages(family_id,author_id,viewer_id,visibility,role,text) values(household,person,person,'private','user','새 메시지');
  set local role authenticated;
  page:=public.chat_page(jsonb_build_object('before',first_cursor));
  if page->'messages'->0->>'text'<>'내 대화 22' or page->'messages'->49->>'text'<>'내 대화 71'
    then raise exception 'new message shifted history cursor'; end if;
  perform set_config('request.jwt.claim.sub',partner::text,true);
  page:=public.chat_page('{"visibility":"private"}');
  if page::text like '%내 대화%' then raise exception 'partner can read own private history'; end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  page:=public.chat_page();
  if jsonb_array_length(page->'messages')<>0 or page->>'nextBefore' is not null then raise exception 'empty page or household scope invalid'; end if;
  begin
    perform public.chat_page('{"before":0}');
    raise exception 'invalid cursor accepted';
  exception when raise_exception then
    if sqlerrm<>'invalid_chat' then raise; end if;
  end;
  set local role anon;
  begin
    perform public.chat_page();
    raise exception 'anonymous page accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
