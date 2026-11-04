-- BOT-06/10/12/13, SCN-BOT-9: shared skill access and independent Supabase memory control.
begin;
do $$
declare
  person uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  family uuid:=gen_random_uuid(); other_family uuid:=gen_random_uuid(); unit uuid; snapshot jsonb;
  event_id uuid:=gen_random_uuid(); category uuid;
begin
  insert into auth.users(id) values(person),(worker),(outsider);
  insert into public.users(id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version)
    values(person,'google',person::text,'등록자',now(),now(),'test');
  insert into public.families(id,name) values(family,'도구검증'),(other_family,'외부가정');
  insert into public.memberships(user_id,family_id,role) values(person,family,'admin');
  insert into public.agent_workers(id,family_id) values(worker,family),(outsider,other_family);
  insert into private.ai_settings(family_id) values(family),(other_family);
  insert into public.family_memories(family_id,text) values(family,'매운 음식 선호'),(other_family,'다른 가정 비밀');
  select id into unit from public.units where family_id=family limit 1;
  insert into public.inventory_items(family_id,name,unit_id,quantity) values(family,'우유',unit,2);
  select id into category from public.event_categories where family_id=family limit 1;
  insert into public.events(id,family_id,owner_id,visibility,start_date,end_date)
    values(event_id,family,person,'private','2026-11-04','2026-11-04');
  insert into public.event_details(event_id,family_id,category_id,title,place,memo) values(event_id,family,category,'비밀 진료','비밀 장소','비밀 메모');
  perform set_config('request.jwt.claim.sub',worker::text,true);
  set local role authenticated;
  snapshot:=public.agent_read(jsonb_build_object('resource','memories','familyId',other_family));
  if snapshot::text not like '%매운 음식%' or snapshot::text like '%다른 가정 비밀%' then raise exception 'family isolation failed'; end if;
  snapshot:=public.agent_read('{"resource":"inventory"}');
  if snapshot->'items'->0->>'name'<>'우유' then raise exception 'inventory missing'; end if;
  snapshot:=public.agent_read('{"resource":"calendar"}');
  if jsonb_array_length(snapshot->'records')<>1 or snapshot::text like '%비밀%' then raise exception 'private calendar leak'; end if;
  if snapshot->'records'->0->'event_details'<>'null'::jsonb then raise exception 'private details returned'; end if;
  begin perform public.agent_read('{"resource":"sql"}'); raise exception 'arbitrary query allowed';
    exception when raise_exception then if sqlerrm<>'invalid_chat' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',person::text,true);
  begin perform public.agent_read('{"resource":"memories"}'); raise exception 'member used worker tool';
    exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
  perform public.chat_command('save-settings','{"memoryEnabled":false}');
  perform set_config('request.jwt.claim.sub',worker::text,true);
  snapshot:=public.agent_read('{"resource":"memories"}');
  if snapshot->>'enabled'<>'false' or snapshot->'memories'<>'[]'::jsonb then raise exception 'disabled memory returned'; end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if public.agent_read('{"resource":"inventory"}')->'items'<>'[]'::jsonb then raise exception 'other worker read inventory'; end if;
  reset role;
  update public.agent_workers set enabled=false where id=worker;
  perform set_config('request.jwt.claim.sub',worker::text,true);
  set local role authenticated;
  begin perform public.agent_read('{"resource":"memories"}'); raise exception 'disabled worker read';
    exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
end $$;
rollback;
