-- CART-01 SCN-CART-1: run only in a disposable local DB; fixtures roll back.
begin;
do $$
declare
  actor uuid:=gen_random_uuid();
  outsider uuid:=gen_random_uuid();
  worker uuid:=gen_random_uuid();
  other_worker uuid:=gen_random_uuid();
  family uuid:=gen_random_uuid();
  other_family uuid:=gen_random_uuid();
  category uuid;
  other_category uuid;
  fallback uuid;
  unit uuid;
  prepared jsonb;
  claimed jsonb;
  added jsonb;
  command jsonb;
  item_id uuid;
  attempt integer;
begin
  insert into auth.users(id) values(actor),(outsider),(worker),(other_worker);
  insert into public.users(
    id,provider,provider_user_id,display_name,terms_accepted_at,privacy_accepted_at,terms_version)
    values(actor,'google',actor::text,'요청자',now(),now(),'test'),
      (outsider,'google',outsider::text,'다른가정',now(),now(),'test');
  insert into public.families(id,name) values(family,'추천검증'),(other_family,'다른가정');
  insert into public.memberships(user_id,family_id,role) 
    values(actor,family,'admin'),(outsider,other_family,'admin');
  insert into public.agent_workers(id,family_id,last_seen_at) 
    values(worker,family,now()),(other_worker,other_family,now());
  select id into category from public.inventory_categories 
    where family_id=family and name<>'기타' order by id limit 1;
  select id into fallback from public.inventory_categories where family_id=family and name='기타';
  select id into other_category from public.inventory_categories where family_id=other_family limit 1;
  select id into unit from public.units where family_id=family limit 1;
  insert into public.inventory_items(family_id,name,mode,quantity,status,unit_id,category_id)
    values(family,'Milk Tea','quantity',1,'enough',unit,category),
      (other_family,'다른 가정 품목','status',0,'enough',null,other_category);
  insert into public.cart_items(family_id,name,quantity,category_id,purchased_at)
    values(family,'지난 구매',1,category,now()),(other_family,'비밀 구매',1,other_category,now());
  perform set_config('request.jwt.claim.sub',actor::text,true);
  prepared:=public.cart_category_command('prepare','{"name":" mILK tEA "}');
  assert prepared->>'id' is null and (prepared->>'categoryId')::uuid=category, 'inventory normalized match';
  prepared:=public.cart_category_command('prepare','{"name":"지난구매"}');
  assert prepared->>'id' is null and (prepared->>'categoryId')::uuid=category, 'purchase normalized match';
  assert not exists(select 1 from private.cart_category_requests), 'matching must not enqueue AI';

  insert into public.cart_items(family_id,name,quantity,category_id)
    values(family,'담긴 품목',1,category);
  prepared:=public.cart_category_command('prepare','{"name":" 담긴품목 "}');
  assert prepared->>'id' is null and not (prepared->>'pending')::boolean, 'duplicate skips AI';
  assert not exists(select 1 from private.cart_category_requests), 'duplicate must not enqueue';

  command:=jsonb_build_object('action','add','duplicate','ask','item',jsonb_build_object(
    'name','담긴 품목','quantity',1,'unit_id',null,'category_id',null,'memo','','link_url',''));
  added:=public.cart_category_command('add',jsonb_build_object(
    'categoryId',prepared->>'categoryId','command',command));
  assert added->'duplicate'->>'id' is not null, 'duplicate is returned immediately';
  prepared:=public.cart_category_command('prepare','{"name":"담긴 품목"}');
  assert prepared->>'id' is null, 'duplicate retry must not enqueue';

  for attempt in 0..6 loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    if attempt=4 then update public.agent_workers set last_seen_at=null where id=worker; end if;
    prepared:=public.cart_category_command('prepare',jsonb_build_object('name','새 품목 '||attempt));
    assert prepared->>'categoryId' is null;
    if attempt=4 then
      assert not (prepared->>'pending')::boolean, 'offline gateway must not wait';
      update private.cart_category_requests set created_at=now()-interval '6 minutes'
        where id=(prepared->>'id')::uuid;
    end if;
    command:=jsonb_build_object('action','add','duplicate','separate','item',jsonb_build_object(
      'name','새 품목 '||attempt,'quantity',1,'unit_id',unit,'category_id',null,'memo','','link_url',''));
    added:=public.cart_category_command('add',jsonb_build_object('id',prepared->>'id','command',command));
    item_id:=(added->'item'->>'id')::uuid;
    assert (added->'item'->>'category_id')::uuid=fallback,'fallback must be 기타';
    if attempt=2 then
      -- Changing away and back still counts as a user choice.
      update public.cart_items set category_id=category where id=item_id;
      update public.cart_items set category_id=fallback where id=item_id;
    end if;
    perform set_config('request.jwt.claim.sub',other_worker::text,true);
    assert public.cart_category_command('claim')='null'::jsonb,'other family worker cannot claim';
    perform set_config('request.jwt.claim.sub',worker::text,true);
    claimed:=public.cart_category_command('claim');
    if attempt in (2,4) then
      assert claimed='null'::jsonb, 'cancelled or expired requests must not call AI';
      if attempt=4 then
        assert (select status from private.cart_category_requests
          where id=(prepared->>'id')::uuid)='failed', 'expired queued request fails';
      end if;
      continue;
    end if;
    assert claimed->>'id'=prepared->>'id';
    assert not (claimed ? 'familyId') and not (claimed ? 'actorId'), 'minimal model context';
    assert jsonb_array_length(claimed->'categories')=
      (select count(*) from public.inventory_categories where family_id=family);
    if attempt=6 then
      perform set_config('request.jwt.claim.sub',outsider::text,true);
      begin
        perform public.cart_category_command('status',jsonb_build_object('id',prepared->>'id'));
        raise exception 'cross-family status allowed';
      exception when raise_exception then
        if sqlerrm<>'forbidden' then raise; end if;
      end;
      perform set_config('request.jwt.claim.sub',other_worker::text,true);
      begin
        perform public.cart_category_command('complete',claimed||jsonb_build_object('category','기타'));
        raise exception 'cross-family completion allowed';
      exception when raise_exception then
        if sqlerrm<>'lease_lost' then raise; end if;
      end;
      perform set_config('request.jwt.claim.sub',worker::text,true);
    end if;
    if attempt=5 then
      perform public.cart_category_command('fail',claimed);
    else
      perform public.cart_category_command('complete',claimed||jsonb_build_object('category',
        case when attempt=3 then '목록 밖 답'
          else (select name from public.inventory_categories where id=category) end));
    end if;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    assert (select category_id from public.cart_items where id=item_id)=
      case when attempt in (2,3,5) then fallback else category end,
      'AI success, late update, manual override, invalid output or failure';
  end loop;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  prepared:=public.cart_category_command('prepare','{"name":"담기 실패"}');
  perform set_config('request.jwt.claim.sub',worker::text,true);
  assert public.cart_category_command('claim')='null'::jsonb, 'unattached request must not call AI';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  update private.cart_category_requests set status='failed',created_at=now()-interval '2 hours'
    where id=(prepared->>'id')::uuid;
  added:=public.cart_category_command('status',jsonb_build_object('id',prepared->>'id'));
  assert not (added->>'pending')::boolean, 'status reads terminal result without cleanup';
  assert exists(select 1 from private.cart_category_requests where id=(prepared->>'id')::uuid),
    'status must not delete old requests';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  -- A same-name record from another family never counts as a match.
  prepared:=public.cart_category_command('prepare','{"name":"다른 가정 품목"}');
  assert prepared->>'categoryId' is null;
  prepared:=public.cart_category_command('prepare','{"name":"비밀 구매"}');
  assert prepared->>'categoryId' is null;
end $$;
rollback;
