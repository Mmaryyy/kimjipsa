-- INV-11 / CART-11 / SCN-BOT-6: disposable PostgreSQL only.
begin;
do $$
declare
  member_id uuid := gen_random_uuid();
  worker_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  food_id uuid;
  drink_id uuid;
  other_id uuid;
  foreign_id uuid;
  unit_id uuid;
  location_id uuid;
  cart_id uuid;
  renamed_id uuid;
  direct_id uuid;
  request_id uuid;
  cart_revision text;
  stock jsonb;
  cart jsonb;
  draft jsonb;
  suggestion jsonb;
begin
  insert into auth.users(id) values (member_id), (worker_id);
  insert into public.users(id, provider, provider_user_id, display_name, terms_accepted_at,
    privacy_accepted_at, terms_version)
    values (member_id, 'google', member_id::text, '작성자', now(), now(), 'test');
  insert into public.families(id, name) values (household, '검증 가정'), (other_household, '다른 가정');
  insert into public.memberships(user_id, family_id, role) values (member_id, household, 'admin');
  insert into public.agent_workers(id, family_id) values (worker_id, household);
  select id into strict food_id from public.inventory_categories where family_id = household and name = '유제품·계란';
  select id into strict drink_id from public.inventory_categories where family_id = household and name = '음료';
  select id into strict other_id from public.inventory_categories where family_id = household and name = '기타';
  select id into strict foreign_id from public.inventory_categories where family_id = other_household and name = '기타';
  select id into strict unit_id from public.units where family_id = household and name = '개';
  select id into strict location_id from public.locations where family_id = household and name = '냉장실';

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  cart := jsonb_build_object('domain', 'cart', 'expected', '{}', 'payload', jsonb_build_object(
    'action', 'add', 'duplicate', 'separate', 'item', jsonb_build_object(
      'name', '우유', 'quantity', 1, 'unit_id', unit_id, 'category_id', drink_id
    )
  ));
  stock := jsonb_build_object('domain', 'inventory', 'expected', '{}', 'payload', jsonb_build_object(
    'action', 'save', 'id', null, 'item', jsonb_build_object(
      'name', '우유', 'mode', 'quantity', 'quantity', 2, 'status', 'enough',
      'unit_id', unit_id, 'location_id', location_id, 'category_id', food_id
    )
  ));
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(stock, cart));
  assert draft->0->>'label' like '%(유제품·계란)', 'inventory confirmation lost category';
  assert draft->1->>'label' like '%(음료)', 'cart confirmation lost category';
  assert draft->1->'payload'->'item'->>'category_id' = drink_id::text, 'valid category changed';
  perform private.execute_agent_actions(household, member_id, 'private', draft);
  assert exists (
    select 1 from public.cart_items where family_id = household and name = '우유' and category_id = drink_id
  ), 'same-name stock replaced a valid cart selection';

  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(
    jsonb_set(stock, '{payload,item,category_id}', 'null'),
    jsonb_set(stock, '{payload,item,category_id}', to_jsonb(foreign_id)),
    jsonb_set(stock, '{payload,item,category_id}', '"유제품·계란"'),
    cart
  ));
  assert (select count(*) from jsonb_array_elements(draft) a
    where a->>'domain' = 'inventory' and a#>>'{payload,item,category_id}' = other_id::text
      and a->>'label' like '%(기타)') = 3, 'invalid stock categories lost their confirmation fallback';
  perform private.execute_agent_actions(household, member_id, 'private', jsonb_build_array(
    jsonb_set(draft->0, '{payload,item,name}', '"검증 저지방 우유"')
  ));
  assert exists (select 1 from public.inventory_items
    where family_id = household and name = '검증 저지방 우유' and category_id = other_id),
    'confirming a fallback did not save the stock category';
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(
    jsonb_set(draft->0, '{payload,item,category_id}', to_jsonb(drink_id))
  ));
  assert draft->0->>'label' like '%(음료)?', 'editing fallback did not update the stock label';

  stock := jsonb_set(stock, '{payload,item,name}', '"두유"');
  perform private.execute_agent_actions(household, member_id, 'private',
    private.prepare_agent_actions(household, member_id, jsonb_build_array(stock)));
  cart := jsonb_set(cart, '{payload,item,name}', '"두유"');
  cart := cart #- '{payload,item,category_id}';
  perform private.execute_agent_actions(household, member_id, 'private',
    private.prepare_agent_actions(household, member_id, jsonb_build_array(cart)));
  assert exists (
    select 1 from public.cart_items where family_id = household and name = '두유' and category_id = food_id
  ), 'missing category skipped the exact-name stock match';

  select c.id, md5(to_jsonb(c)::text) into strict renamed_id, cart_revision from public.cart_items c
    where c.family_id = household and c.name = '두유';
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(
    cart || jsonb_build_object(
      'expected', jsonb_build_object(renamed_id, cart_revision),
      'payload', jsonb_build_object('action', 'save', 'id', renamed_id, 'item',
        cart->'payload'->'item' || '{"name":"우유","category_id":null}')
    )
  ));
  assert draft->0->>'label' like '%(유제품·계란)?', 'rename confirmation lost the original category';
  perform private.execute_agent_actions(household, member_id, 'private', jsonb_build_array(
    jsonb_set(draft->0, '{payload,item,category_id}', 'null')
  ));
  assert (select name = '우유' and category_id = food_id from public.cart_items where id = renamed_id),
    'rename with a null category used another same-name item';
  assert not exists (select 1 from private.cart_category_requests where item_id = renamed_id),
    'rename queued an unnecessary recommendation';
  select md5(to_jsonb(c)::text) into strict cart_revision from public.cart_items c where c.id = renamed_id;
  perform private.execute_agent_actions(household, member_id, 'private',
    private.prepare_agent_actions(household, member_id, jsonb_build_array(jsonb_build_object(
      'domain', 'cart', 'expected', jsonb_build_object(renamed_id, cart_revision),
      'payload', jsonb_build_object('action', 'delete', 'id', renamed_id)
    ))));
  assert not exists (select 1 from public.cart_items where id = renamed_id), 'cart delete regressed';

  cart := jsonb_set(cart, '{payload,item,category_id}', to_jsonb(foreign_id));
  cart := jsonb_set(cart, '{payload,item,name}', '"검증 품목"');
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(cart));
  assert draft->0->'payload'->'item'->'category_id' = 'null'::jsonb, 'foreign category crossed into draft';
  perform private.execute_agent_actions(household, member_id, 'private', draft);
  select c.id, md5(to_jsonb(c)::text) into strict cart_id, cart_revision from public.cart_items c
    where c.family_id = household and c.name = '검증 품목' and c.category_id = other_id;

  select id into strict request_id from private.cart_category_requests where item_id = cart_id;
  -- Quantity edits keep the original job, with or without an explicit unchanged category.
  cart := cart || jsonb_build_object(
    'expected', jsonb_build_object(cart_id, cart_revision),
    'payload', jsonb_build_object('action', 'save', 'id', cart_id, 'item',
      cart->'payload'->'item' || jsonb_build_object('category_id', other_id, 'quantity', 2))
  );
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(cart));
  perform private.execute_agent_actions(household, member_id, 'private', draft);
  select md5(to_jsonb(c)::text) into strict cart_revision from public.cart_items c where c.id = cart_id;
  cart := jsonb_set(cart, array['expected', cart_id::text], to_jsonb(cart_revision));
  cart := jsonb_set(cart, '{payload,item,category_id}', 'null');
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(cart));
  perform private.execute_agent_actions(household, member_id, 'private', draft);
  assert (select count(*) from private.cart_category_requests where item_id = cart_id) = 1
    and exists (select 1 from private.cart_category_requests
      where id = request_id and item_id = cart_id and status = 'queued'),
    'unchanged category cancelled or duplicated its original recommendation';

  select md5(to_jsonb(c)::text) into strict cart_revision from public.cart_items c where c.id = cart_id;
  cart := jsonb_set(cart, array['expected', cart_id::text], to_jsonb(cart_revision));
  cart := jsonb_set(cart, '{payload,item,category_id}', to_jsonb(food_id));
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(cart));
  perform private.execute_agent_actions(household, member_id, 'private', draft);
  assert not exists (
    select 1 from private.cart_category_requests where item_id = cart_id
  ), 'pending recommendation can overwrite an explicit edit';

  -- An uncategorized edit still queues a recommendation and uses 기타 while it is pending.
  update public.cart_items set category_id = null where id = cart_id;
  select md5(to_jsonb(c)::text) into strict cart_revision from public.cart_items c where c.id = cart_id;
  cart := jsonb_set(cart, array['expected', cart_id::text], to_jsonb(cart_revision));
  cart := jsonb_set(cart, '{payload,item,category_id}', 'null');
  draft := private.prepare_agent_actions(household, member_id, jsonb_build_array(cart));
  perform private.execute_agent_actions(household, member_id, 'private', draft);
  assert (select category_id from public.cart_items where id = cart_id) = other_id, 'save lost fallback';
  assert exists (
    select 1 from private.cart_category_requests where item_id = cart_id and status = 'queued'
  ), 'uncategorized edit did not queue a recommendation';

  perform set_config('request.jwt.claim.sub', worker_id::text, true);
  suggestion := public.cart_category_command('claim');
  assert suggestion->>'name' = '검증 품목', 'worker did not claim the edit recommendation';
  perform public.cart_category_command('complete', suggestion || '{"category":"음료"}');
  assert (select category_id from public.cart_items where id = cart_id) = drink_id, 'edit lost late recommendation';
  perform set_config('request.jwt.claim.sub', member_id::text, true);

  -- P10.11 direct add still prefers an exact active match, with the old prepare/add contract.
  suggestion := public.cart_category_command('prepare', '{"name":"우유"}');
  assert suggestion->>'categoryId' = drink_id::text, 'direct addition lost its exact match';
  perform public.cart_category_command('add', jsonb_build_object(
    'categoryId', suggestion->'categoryId', 'command', jsonb_build_object(
      'action', 'add', 'duplicate', 'separate',
      'item', jsonb_build_object('name', '우유', 'quantity', 1, 'unit_id', unit_id, 'category_id', food_id)
    )));
  assert (select count(*) from public.cart_items
    where family_id = household and name = '우유' and category_id = drink_id) = 2, 'direct add changed';

  suggestion := public.cart_category_command('prepare', '{"name":"검증 생수"}');
  request_id := (suggestion->>'id')::uuid;
  draft := public.cart_category_command('add', jsonb_build_object(
    'id', request_id, 'command', jsonb_build_object(
      'action', 'add', 'duplicate', 'separate',
      'item', jsonb_build_object('name', '검증 생수', 'quantity', 1, 'unit_id', unit_id)
    )));
  direct_id := (draft->'item'->>'id')::uuid;
  assert draft->'item'->>'category_id' = other_id::text and exists (
    select 1 from private.cart_category_requests where id = request_id and item_id = direct_id
  ), 'direct add lost its prepared job or fallback';
  perform set_config('request.jwt.claim.sub', worker_id::text, true);
  suggestion := public.cart_category_command('claim');
  assert suggestion->>'id' = request_id::text, 'direct add job was not claimable';
  perform public.cart_category_command('complete', suggestion || '{"category":"음료"}');
  assert (select category_id from public.cart_items where id = direct_id) = drink_id, 'direct add lost recommendation';
  perform set_config('request.jwt.claim.sub', member_id::text, true);

  select md5(to_jsonb(c)::text) into strict cart_revision from public.cart_items c where c.id = direct_id;
  perform private.execute_agent_actions(household, member_id, 'private',
    private.prepare_agent_actions(household, member_id, jsonb_build_array(jsonb_build_object(
      'domain', 'cart', 'expected', jsonb_build_object(direct_id, cart_revision),
      'payload', jsonb_build_object('action', 'check', 'id', direct_id, 'checked', true)
    ))));
  assert (select is_checked from public.cart_items where id = direct_id), 'cart check regressed';
  select md5(to_jsonb(c)::text) into strict cart_revision from public.cart_items c where c.id = direct_id;
  perform private.execute_agent_actions(household, member_id, 'private',
    private.prepare_agent_actions(household, member_id, jsonb_build_array(jsonb_build_object(
      'domain', 'cart', 'expected', jsonb_build_object(direct_id, cart_revision),
      'payload', jsonb_build_object('action', 'restock', 'entries', jsonb_build_array(jsonb_build_object(
        'id', direct_id, 'quantity', 1, 'unit_id', unit_id, 'category_id', drink_id, 'location_id', location_id
      )))
    ))));
  assert exists (
    select 1 from public.cart_items c join public.inventory_items i on i.id = c.inventory_item_id
      where c.id = direct_id and c.purchased_at is not null and i.category_id = drink_id and i.quantity = 1
  ), 'cart restock regressed';
end $$;
rollback;
