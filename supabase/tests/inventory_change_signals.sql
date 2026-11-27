-- ADR-0024 RT1, INV-01/11/12/17, CART-07, BOT-07, SCN-INV-1/6, SCN-CART-4, SCN-BOT-5.
-- Use a disposable local DB with Realtime initialized by a WebSocket connection.
begin;

create temp table seen_inventory_signals (id uuid primary key);

create function pg_temp.expect_inventory_signals(
  test_channels text[], expected_channels text[], expected_topic text
) returns void language plpgsql as $$
declare
  channels text[];
begin
  select array(select t from unnest(expected_channels) t order by t) into expected_channels;
  select array(select m.topic from realtime.messages m
    where m.topic = any(test_channels) and m.id not in (select id from seen_inventory_signals)
    order by m.topic) into channels;
  if channels is distinct from expected_channels then
    raise exception 'Expected channels %, got %', expected_channels, channels;
  end if;
  if exists (
    select 1 from realtime.messages m
      where m.topic = any(test_channels) and m.id not in (select id from seen_inventory_signals)
        and (m.event, m.extension, m.private, m.payload) is distinct from
          ('change', 'broadcast', true, jsonb_build_object('topic', expected_topic))
  ) then
    raise exception 'Expected a private broadcast with only topic %', expected_topic;
  end if;
  insert into seen_inventory_signals
    select m.id from realtime.messages m where m.topic = any(test_channels)
    on conflict do nothing;
end;
$$;

do $$
declare
  person uuid := gen_random_uuid();
  partner uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  worker uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  own_channel text := 'family:' || household::text || ':changes';
  other_channel text := 'family:' || other_household::text || ':changes';
  test_channels text[] := array[own_channel, other_channel];
  unit uuid;
  category uuid;
  location uuid;
  table_name text;
  stock uuid;
  entries jsonb;
  token uuid;
  job jsonb;
  proposal uuid;
  actions jsonb;
begin
  insert into auth.users(id) values (person), (partner), (outsider), (worker);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values (person, 'google', person::text, '작성자', now(), now(), 'test'),
      (partner, 'google', partner::text, '배우자', now(), now(), 'test'),
      (outsider, 'google', outsider::text, '외부인', now(), now(), 'test');
  insert into public.families(id, name) values (household, '신호 확인'), (other_household, '다른 가정');
  insert into public.memberships(user_id, family_id, role)
    values (person, household, 'admin'), (partner, household, 'member'), (outsider, other_household, 'admin');
  insert into public.agent_workers(id, family_id) values (worker, household);
  insert into seen_inventory_signals
    select m.id from realtime.messages m where m.topic = any(test_channels);
  select id into unit from public.units where family_id = household limit 1;
  select id into category from public.inventory_categories where family_id = household limit 1;
  select id into location from public.locations where family_id = household and enabled limit 1;

  insert into public.inventory_items(family_id, name, mode)
    values (household, '수정 대상 하나', 'status'), (household, '수정 대상 둘', 'status');
  perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory');
  update public.inventory_items set family_id = other_household
    where family_id = household and name like '수정 대상%';
  perform pg_temp.expect_inventory_signals(test_channels, test_channels, 'inventory');
  delete from public.inventory_items where family_id = other_household;
  perform pg_temp.expect_inventory_signals(test_channels, array[other_channel], 'inventory');
  delete from public.inventory_items where false;
  perform pg_temp.expect_inventory_signals(test_channels, '{}', 'inventory');

  foreach table_name in array array['inventory_categories', 'units', 'locations'] loop
    execute format('insert into public.%I(family_id, name) values ($1, $2), ($1, $3)', table_name)
      using household, '신호 검증 하나', '신호 검증 둘';
    perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory-meta');
    execute format('update public.%I set sort_order = 100 where family_id = $1 and name like $2', table_name)
      using household, '신호 검증%';
    perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory-meta');
    execute format('delete from public.%I where family_id = $1 and name like $2', table_name)
      using household, '신호 검증%';
    perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory-meta');
  end loop;

  -- Use the same topic and role settings as the Realtime authorization probe.
  insert into realtime.messages (topic, extension, event, private, payload)
    values (own_channel || ':extra', 'broadcast', 'change', true, '{"topic":"inventory"}');
  perform set_config('realtime.topic', own_channel, true);
  perform set_config('request.jwt.claim.sub', partner::text, true);
  set local role authenticated;
  if not exists (select 1 from realtime.messages where topic = own_channel) then
    raise exception 'A member cannot receive the family channel';
  end if;
  if exists (select 1 from realtime.messages where topic = other_channel) then
    raise exception 'The family policy exposed rows from another channel';
  end if;
  begin
    insert into realtime.messages (topic, extension, event, private, payload)
      values (own_channel, 'broadcast', 'change', true, '{"topic":"inventory"}');
    raise exception 'A member can publish a change signal';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('realtime.topic', own_channel || ':extra', true);
  if exists (select 1 from realtime.messages where topic = own_channel || ':extra') then
    raise exception 'A partial topic match was accepted';
  end if;
  perform set_config('realtime.topic', own_channel, true);
  perform set_config('request.jwt.claim.sub', outsider::text, true);
  if exists (select 1 from realtime.messages where topic = own_channel) then
    raise exception 'Another family can receive the channel';
  end if;
  reset role;

  -- One checkout mixes INSERT and UPDATE across the full 500-entry limit.
  insert into public.inventory_items(family_id, name, quantity, unit_id)
    values (household, '구매 1', 2, unit) returning id into stock;
  perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory');
  insert into public.cart_items(family_id, name, quantity, unit_id, is_checked, checked_by)
    select household, '구매 ' || n, 1, unit, true, person from generate_series(1, 500) n;
  select jsonb_agg(jsonb_build_object(
    'id', id, 'quantity', 1, 'unit_id', unit, 'category_id', category, 'location_id', location
  ) order by name) into entries from public.cart_items where family_id = household;

  perform set_config('request.jwt.claim.sub', person::text, true);
  set local role authenticated;
  begin
    perform public.write_cart(jsonb_build_object('action', 'restock',
      'entries', jsonb_set(entries, '{499,id}', to_jsonb(gen_random_uuid()))));
    raise exception 'Invalid checkout succeeded';
  exception when raise_exception then
    if sqlerrm <> 'cart_changed' then raise; end if;
  end;
  reset role;
  perform pg_temp.expect_inventory_signals(test_channels, '{}', 'inventory');

  set local role authenticated;
  token := (public.write_cart(jsonb_build_object('action', 'restock', 'entries', entries))->>'undoToken')::uuid;
  reset role;
  if (select count(*) from public.inventory_items where family_id = household) <> 500
    or (select quantity from public.inventory_items where id = stock) is distinct from 3::numeric then
    raise exception 'Checkout did not update all 500 entries';
  end if;
  perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory');

  set local role authenticated;
  perform public.undo_cart_restock(token);
  reset role;
  perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory');

  -- A normal write after the batch still publishes.
  set local role authenticated;
  perform public.write_inventory(jsonb_build_object('action', 'adjust', 'id', stock, 'delta', 1));
  reset role;
  perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory');

  -- Receipt and agent item saving share this entry point.
  select jsonb_agg(jsonb_build_object(
    'name', '영수증 재고 ' || n, 'quantity', 1, 'unit_id', unit,
    'category_id', category, 'location_id', location
  )) into entries from generate_series(1, 2) n;
  perform private.apply_agent_items(household, entries);
  if (select count(*) from public.inventory_items where family_id = household and name like '영수증 재고 %') <> 2 then
    raise exception 'The receipt batch did not save both items';
  end if;
  perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory');

  actions := (
    select jsonb_agg(jsonb_build_object('domain', 'inventory', 'expected', '{}'::jsonb,
      'payload', jsonb_build_object('action', 'save', 'item', jsonb_build_object(
        'name', '집사 재고 ' || n, 'mode', 'quantity', 'quantity', 1, 'unit_id', unit,
        'category_id', category, 'location_id', location
      )))) from generate_series(1, 2) n
  );
  perform public.chat_command('send', jsonb_build_object(
    'text', '재고 두 개 등록', 'clientRequestId', gen_random_uuid()
  ));
  perform set_config('request.jwt.claim.sub', worker::text, true);
  job := public.agent_command('claim');
  perform public.agent_command('complete', jsonb_build_object('jobId', job->>'id', 'leaseToken', job->>'leaseToken',
    'kind', 'action_proposal', 'text', '재고 두 개 추가', 'actions', actions));
  select id into proposal from public.agent_proposals where run_id = (job->>'id')::uuid;
  perform pg_temp.expect_inventory_signals(test_channels, '{}', 'inventory');
  perform set_config('request.jwt.claim.sub', person::text, true);
  set local role authenticated;
  perform public.chat_command('confirm-actions', jsonb_build_object(
    'id', proposal, 'version', 1, 'selected', '[0,1]'::jsonb
  ));
  reset role;
  if (select count(*) from public.inventory_items where family_id = household and name like '집사 재고 %') <> 2 then
    raise exception 'The chat confirmation did not save both items';
  end if;
  perform pg_temp.expect_inventory_signals(test_channels, array[own_channel], 'inventory');
end;
$$;

rollback;
