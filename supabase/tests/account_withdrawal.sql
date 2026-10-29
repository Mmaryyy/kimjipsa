-- ACC-15 / SCN-ACC-6. Run only against a local database after all migrations.
-- Every fixture and account deletion is rolled back.
begin;
do $$
declare
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  joiner uuid := gen_random_uuid();
  child_user uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  category uuid;
  shared_event uuid := gen_random_uuid();
  private_event uuid := gen_random_uuid();
  cart uuid := gen_random_uuid();
  unit uuid;
  unused_invite uuid := gen_random_uuid();
  used_invite uuid := gen_random_uuid();
  other_invite uuid := gen_random_uuid();
begin
  insert into auth.users(id) values (first_user), (second_user), (outsider), (joiner), (child_user);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values
      (first_user, 'google', first_user::text, '테스트가', now(), now(), 'test'),
      (second_user, 'google', second_user::text, '테스트나', now(), now(), 'test'),
      (outsider, 'google', outsider::text, '다른가정', now(), now(), 'test'),
      (joiner, 'google', joiner::text, '초대검증', now(), now(), 'test'),
      (child_user, 'google', child_user::text, '자녀검증', now(), now(), 'test');
  insert into public.families(id, name) values (household, '탈퇴검증'), (other_household, '격리검증');
  insert into public.memberships(user_id, family_id, role)
    values (first_user, household, 'admin'), (second_user, household, 'member'),
      (outsider, other_household, 'admin'), (child_user, household, 'child');
  select id into category from public.event_categories where family_id = household limit 1;
  select id into unit from public.units where family_id = household limit 1;
  insert into public.events(id, family_id, owner_id, visibility, start_date, end_date)
    values (shared_event, household, first_user, 'shared', current_date, current_date),
      (private_event, household, first_user, 'private', current_date, current_date);
  insert into public.event_details(event_id, family_id, title, category_id)
    values (shared_event, household, '남는 일정', category), (private_event, household, '개인 일정', category);
  insert into public.cart_items(id, family_id, name, quantity, unit_id, added_by, checked_by, is_checked)
    values (cart, household, '남는 품목', 1, unit, first_user, first_user, true);
  insert into public.inventory_items(family_id, name, mode, quantity, status, unit_id)
    values (household, '남는 재고', 'quantity', 1, 'enough', unit);
  insert into public.invites(token, family_id, created_by, accepted_by, accepted_at)
    values (unused_invite, household, first_user, null, null),
      (used_invite, household, first_user, second_user, now()),
      (other_invite, household, second_user, first_user, now());

  insert into public.notifications(user_id, family_id, kind, payload)
    values (first_user, household, 'event_created', '{}'::jsonb);
  insert into public.push_subscriptions(user_id, endpoint, keys)
    values (first_user, 'https://web.push.apple.com/withdrawal-test',
      jsonb_build_object('p256dh', repeat('a', 87), 'auth', repeat('a', 22)));
  insert into public.dday_card_dismissals(user_id, event_id, year)
    values (first_user, shared_event, 2026);
  insert into auth.sessions(id, user_id) values (gen_random_uuid(), first_user);

  -- A child cannot change roles and can leave while an admin remains.
  perform set_config('request.jwt.claim.sub', child_user::text, true);
  begin
    begin
      set local role authenticated;
      perform public.change_member_role(second_user, 'admin');
      reset role;
    exception when others then
      reset role;
      raise;
    end;
    raise exception 'SCN-ACC-6: child changed another role';
  exception when raise_exception then
    if sqlerrm <> 'role_forbidden' then raise; end if;
  end;
  begin
    set local role authenticated;
    perform public.withdraw_account();
    reset role;
  exception when others then
    reset role;
    raise;
  end;
  if exists(select 1 from auth.users where id = child_user)
    or exists(select 1 from public.memberships where user_id = child_user) then
    raise exception 'SCN-ACC-6: child withdrawal failed';
  end if;

  perform set_config('request.jwt.claim.sub', first_user::text, true);
  begin
    begin
      set local role authenticated;
      perform public.withdraw_account();
      reset role;
    exception when others then
      reset role;
      raise;
    end;
    raise exception 'SCN-ACC-6: last admin withdrawal was allowed';
  exception when raise_exception then
    if sqlerrm <> 'last_admin' then raise; end if;
  end;
  if not exists(select 1 from public.events where id = private_event) then
    raise exception 'SCN-ACC-6: rejected withdrawal changed data';
  end if;
  begin
    begin
      set local role authenticated;
      perform public.change_member_role(first_user, 'member');
      reset role;
    exception when others then
      reset role;
      raise;
    end;
    raise exception 'SCN-ACC-6: last admin demotion was allowed';
  exception when raise_exception then
    if sqlerrm <> 'last_admin' then raise; end if;
  end;
  begin
    begin
      set local role authenticated;
      perform public.change_member_role(outsider, 'child');
      reset role;
    exception when others then
      reset role;
      raise;
    end;
    raise exception 'SCN-ACC-6: another family role was changed';
  exception when raise_exception then
    if sqlerrm <> 'member_not_found' then raise; end if;
  end;
  begin
    set local role authenticated;
    perform public.change_member_role(second_user, 'admin');
    reset role;
  exception when others then
    reset role;
    raise;
  end;
  begin
    begin
      set local role authenticated;
      perform public.change_member_role(second_user, 'member');
      reset role;
    exception when others then
      reset role;
      raise;
    end;
    raise exception 'SCN-ACC-6: another admin was demoted';
  exception when raise_exception then
    if sqlerrm <> 'role_forbidden' then raise; end if;
  end;
  begin
    set local role authenticated;
    perform public.change_member_role(first_user, 'member');
    reset role;
  exception when others then
    reset role;
    raise;
  end;
  begin
    begin
      set local role authenticated;
      perform public.change_member_role(second_user, 'child');
      reset role;
    exception when others then
      reset role;
      raise;
    end;
    raise exception 'SCN-ACC-6: member changed another role';
  exception when raise_exception then
    if sqlerrm <> 'role_forbidden' then raise; end if;
  end;
  begin
    set local role authenticated;
    perform public.withdraw_account();
    reset role;
  exception when others then
    reset role;
    raise;
  end;
  if exists(select 1 from auth.users where id = first_user)
    or exists(select 1 from public.users where id = first_user)
    or exists(select 1 from public.events where id = private_event)
    or exists(select 1 from public.event_details where event_id = private_event)
    or exists(select 1 from public.notifications where user_id = first_user)
    or exists(select 1 from public.push_subscriptions where user_id = first_user)
    or exists(select 1 from public.dday_card_dismissals where user_id = first_user)
    or exists(select 1 from auth.sessions where user_id = first_user) then
    raise exception 'SCN-ACC-6: personal data survived';
  end if;
  if not exists(select 1 from public.events where id = shared_event and owner_id is null)
    or not exists(select 1 from public.event_details where event_id = shared_event and title = '남는 일정')
    or not exists(select 1 from public.cart_items
      where id = cart
        and added_by is null
        and checked_by is null
        and is_checked)
    or not exists(select 1 from public.inventory_items where family_id = household)
    or not exists(select 1 from public.memberships where user_id = second_user and role = 'admin') then
    raise exception 'SCN-ACC-6: shared data or remaining admin was lost';
  end if;
  if exists(select 1 from public.invites where token = unused_invite)
    or not exists(select 1 from public.invites
      where token = used_invite
        and created_by is null
        and accepted_at is not null)
    or not exists(select 1 from public.invites
      where token = other_invite
        and accepted_by is null
        and accepted_at is not null)
    or public.preview_invite(other_invite)->>'status' <> 'used' then
    raise exception 'SCN-ACC-6: invitation cleanup failed';
  end if;
  perform set_config('request.jwt.claim.sub', joiner::text, true);
  begin
    begin
      set local role authenticated;
      perform public.accept_invite(other_invite);
      reset role;
    exception when others then
      reset role;
      raise;
    end;
    raise exception 'SCN-ACC-6: used invitation was accepted again';
  exception when raise_exception then
    if sqlerrm <> 'invite_used' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', second_user::text, true);
  begin
    set local role authenticated;
    perform public.withdraw_account();
    reset role;
  exception when others then
    reset role;
    raise;
  end;
  if exists(select 1 from public.families where id = household)
    or exists(select 1 from public.events where family_id = household)
    or exists(select 1 from public.cart_items where family_id = household)
    or exists(select 1 from public.inventory_items where family_id = household)
    or exists(select 1 from public.invites where family_id = household)
    or not exists(select 1 from public.families where id = other_household) then
    raise exception 'SCN-ACC-6: last member cleanup or family isolation failed';
  end if;
  if has_function_privilege('anon', 'public.withdraw_account()', 'execute')
    or has_function_privilege('anon', 'public.change_member_role(uuid,text)', 'execute') then
    raise exception 'SCN-ACC-6: anonymous write permission exists';
  end if;
end;
$$;
rollback;
