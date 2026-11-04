-- BOT-07/08/10/11, INV-17: disposable DB only. All data rolls back.
begin;
do $$
declare
  person uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid();
  family uuid:=gen_random_uuid(); other_family uuid:=gen_random_uuid(); request_id uuid:=gen_random_uuid(); stock uuid:=gen_random_uuid();
  unit uuid; job jsonb; result jsonb; receipt uuid; items jsonb; snapshot jsonb;
begin
  insert into auth.users(id) values(person),(partner),(outsider),(worker);
  insert into public.users(id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version) values
    (person,'google',person::text,'등록자',now(),now(),'test'),(partner,'google',partner::text,'배우자',now(),now(),'test'),(outsider,'google',outsider::text,'외부',now(),now(),'test');
  insert into public.families(id,name) values(family,'연동검증'),(other_family,'다른가정');
  insert into public.memberships(user_id,family_id,role) values(person,family,'admin'),(partner,family,'member'),(outsider,other_family,'admin');
  insert into public.agent_workers(id,family_id) values(worker,family);
  -- No model key is registered in the app or DB.
  insert into private.ai_settings(family_id) values(family);
  select id into unit from public.units where family_id=family limit 1;
  insert into public.inventory_items(id,family_id,name,unit_id,quantity) values(stock,family,'우유',unit,1);
  items:=jsonb_build_array(jsonb_build_object('name','우유','quantity',2,'unit_id',unit,'inventory_item_id',stock,'selected',true));
  perform set_config('request.jwt.claim.sub',person::text,true);
  set local role authenticated;
  result:=public.chat_command('send',jsonb_build_object('text','우유 2개 추가','attachmentIds','[]'::jsonb,'clientRequestId',request_id));
  if result is distinct from public.chat_command('send',jsonb_build_object('text','우유 2개 추가','clientRequestId',request_id)) then raise exception 'send not idempotent'; end if;
  begin
    perform public.agent_command('claim');raise exception 'member claimed work';
  exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',worker::text,true);
  if (public.agent_command('config')->>'connectionMode') is distinct from 'local' then raise exception 'local gateway config missing'; end if;
  if public.agent_command('config') ?| array['apiKey','encryptedKey','provider','model'] then raise exception 'cloud exposed model configuration'; end if;
  job:=public.agent_command('claim');
  if job='null'::jsonb then raise exception 'keyless worker did not claim'; end if;
  if public.agent_command('claim')<>'null'::jsonb then raise exception 'parallel family execution'; end if;
  perform public.agent_command('complete',jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken','kind','receipt','text','확인해 주세요','items',items));
  begin
    perform public.agent_command('complete',jsonb_build_object('jobId',job->>'id','leaseToken',job->>'leaseToken','kind','add','text','추가','items',items));
    raise exception 'expired lease accepted';
  exception when raise_exception then if sqlerrm<>'lease_lost' then raise; end if; end;
  reset role;
  select id into receipt from public.receipt_imports where run_id=(job->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  set local role authenticated;
  snapshot:=public.chat_command('list');
  if jsonb_array_length(snapshot->'messages')<>0 then raise exception 'cross family messages'; end if;
  begin
    perform public.chat_command('confirm',jsonb_build_object('id',receipt,'version',1,'items',items));raise exception 'outsider applied receipt';
  exception when raise_exception then if sqlerrm<>'not_found' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',person::text,true);
  result:=public.chat_command('confirm',jsonb_build_object('id',receipt,'version',1,'items',items));
  perform set_config('request.jwt.claim.sub',partner::text,true);
  begin
    perform public.chat_command('confirm',jsonb_build_object('id',receipt,'version',1,'items',items)); raise exception 'partner read private receipt';
  exception when raise_exception then if sqlerrm<>'not_found' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',person::text,true);
  if result is distinct from public.chat_command('confirm',jsonb_build_object('id',receipt,'version',1,'items',items)) then raise exception 'confirm replay changed'; end if;
  reset role;
  if (select quantity from public.inventory_items where id=stock)<>3 then raise exception 'duplicate stock addition'; end if;
  -- A later invalid item must roll back every earlier write in the batch.
  begin
    perform private.apply_agent_items(family,items||jsonb_build_array(jsonb_build_object('name','잘못된 단위','quantity',1,'unit_id',gen_random_uuid())));
    raise exception 'invalid batch accepted';
  exception when raise_exception then if sqlerrm<>'invalid_inventory' then raise; end if; end;
  if (select quantity from public.inventory_items where id=stock)<>3 then raise exception 'partial receipt applied'; end if;
end $$;
rollback;
