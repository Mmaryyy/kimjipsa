-- CART-05 SCN-CART-6: disposable local database only; all fixtures roll back.
begin;
do $$
declare
  actor uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  family uuid := gen_random_uuid();
  other_family uuid := gen_random_uuid();
  category uuid;
  other_category uuid;
  unit uuid;
  other_unit uuid;
  payload jsonb;
  failed boolean;
begin
  insert into auth.users(id) values(actor),(outsider);
  insert into public.users(id,provider,provider_user_id,display_name,
    terms_accepted_at,privacy_accepted_at,terms_version)
    values(actor,'google',actor::text,'요청자',now(),now(),'test'),
      (outsider,'google',outsider::text,'다른가정',now(),now(),'test');
  insert into public.families(id,name) values(family,'자주사는품목'),(other_family,'다른가정');
  insert into public.memberships(user_id,family_id,role)
    values(actor,family,'admin'),(outsider,other_family,'admin');
  select id into category from public.inventory_categories where family_id=family limit 1;
  select id into other_category from public.inventory_categories where family_id=other_family limit 1;
  select id into unit from public.units where family_id=family limit 1;
  select id into other_unit from public.units where family_id=other_family limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  payload := jsonb_build_object('name',' Milk Tea ', 'category_id',category,
    'unit_id',unit,'memo','저장한 메모','link_url','https://example.com/item','hidden',false);
  perform public.save_frequent_cart_override(payload);
  assert (select memo='저장한 메모' and link_url='https://example.com/item'
    from public.frequent_cart_overrides where family_id=family and normalized_name='milktea');
  perform public.save_frequent_cart_override(payload || '{"name":"MILKTEA","hidden":true}');
  assert (select count(*)=1 and bool_and(hidden) from public.frequent_cart_overrides where family_id=family);
  perform public.save_frequent_cart_override(payload);
  assert not (select hidden from public.frequent_cart_overrides where family_id=family);
  perform public.save_frequent_cart_override('{"name":"milktea","hidden":true}');
  assert (select hidden and memo='저장한 메모' and category_id=category and unit_id=unit
    from public.frequent_cart_overrides where family_id=family and normalized_name='milktea'),
    'hidden-only update preserves saved values';
  perform public.save_frequent_cart_override('{"name":"생수","hidden":true}');
  assert (select memo is null and link_url is null and category_id is null and unit_id is null
    from public.frequent_cart_overrides where family_id=family and normalized_name='생수'),
    'hidden-only insert leaves value overrides unset';
  delete from public.frequent_cart_overrides where family_id=family and normalized_name='생수';
  failed := false;
  begin
    perform public.save_frequent_cart_override(payload || '{"link_url":"javascript:alert(1)"}');
  exception when others then failed := sqlerrm='invalid_cart'; end;
  assert failed, 'reject invalid link';
  failed := false;
  begin
    perform public.save_frequent_cart_override(payload || jsonb_build_object('category_id',other_category));
  exception when others then failed := sqlerrm='invalid_cart'; end;
  assert failed, 'reject foreign category';
  failed := false;
  begin
    perform public.save_frequent_cart_override(payload || jsonb_build_object('unit_id',other_unit));
  exception when others then failed := sqlerrm='invalid_cart'; end;
  assert failed, 'reject foreign unit';

  execute 'set local role authenticated';
  assert (select count(*)=1 from public.frequent_cart_overrides), 'same family can read';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  assert (select count(*)=0 from public.frequent_cart_overrides), 'other family cannot read';
  failed := false;
  begin
    update public.frequent_cart_overrides set hidden=true where family_id=family;
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'direct writes forbidden';
  failed := false;
  begin
    perform public.save_frequent_cart_override(payload || jsonb_build_object('family_id',family));
  exception when others then failed := sqlerrm='invalid_cart'; end;
  assert failed, 'RPC cannot use other family lists or supplied family id';
  perform public.save_frequent_cart_override(payload || jsonb_build_object(
    'family_id',family,'category_id',other_category,'unit_id',other_unit,'memo','다른 가정'));
  assert (select count(*)=1 from public.frequent_cart_overrides), 'RPC writes requester family only';
  execute 'reset role';
  assert (select memo='저장한 메모' from public.frequent_cart_overrides where family_id=family),
    'other family cannot overwrite original';
end;
$$;
rollback;
