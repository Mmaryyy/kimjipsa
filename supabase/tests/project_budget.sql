-- PRJ-10 / r001-f2. Verify family isolation and that withdrawal preserves paid expenses.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  project uuid;
  expense uuid;
  command jsonb;
  invalid_item jsonb;
begin
  insert into auth.users(id) values (owner_id), (member_id), (outsider_id);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values
      (owner_id, 'google', owner_id::text, '테스트가', now(), now(), 'test'),
      (member_id, 'google', member_id::text, '테스트나', now(), now(), 'test'),
      (outsider_id, 'google', outsider_id::text, '다른집', now(), now(), 'test');
  insert into public.families(id, name) values (household, '프로젝트'), (other_household, '격리 확인');
  insert into public.memberships(user_id, family_id, role)
    values (owner_id, household, 'admin'), (member_id, household, 'member'), (outsider_id, other_household, 'admin');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  project := public.write_project(jsonb_build_object('action', 'save_project', 'item',
    '{"title":"여행","description":"","status":"active","modules":["budget"]}'::jsonb));
  command := jsonb_build_object('action', 'save_expense', 'projectId', project, 'budget_limit', 10000,
    'item', jsonb_build_object('title', '예약금', 'actual_amount', 3000, 'paid_on', '2026-11-25',
      'payer_id', member_id, 'links', '[]'::jsonb, 'memo', ''));
  expense := public.write_project_budget(command);

  begin
    perform public.write_project_budget(command || jsonb_build_object(
      'id', expense, 'item', (command->'item') - 'payer_id'
    ));
    raise exception 'existing_payer_cleared';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;

  for invalid_item in
    select value from (values
      ((command->'item') - 'paid_on'),
      ((command->'item') - 'payer_id'),
      ((command->'item') || jsonb_build_object('payer_id', outsider_id))
    ) as invalid(value)
  loop
    begin
      perform public.write_project_budget(command || jsonb_build_object(
        'item', invalid_item, 'budget_limit', 1
      ));
      raise exception 'invalid_expense_accepted';
    exception when raise_exception then
      if sqlerrm <> 'invalid_project' then raise; end if;
    end;
  end loop;
  if not exists (select from public.projects where id = project and budget_limit = 10000)
    then raise exception 'failed_expense_changed_budget_limit'; end if;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if exists (select from public.project_expenses where id = expense)
    then raise exception 'other_family_budget_data_exposed'; end if;
  begin
    perform public.write_project_budget(jsonb_build_object(
      'action', 'delete_expense', 'projectId', project, 'id', expense
    ));
    raise exception 'other_family_budget_write_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform public.withdraw_account();
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if not exists (select from public.project_expenses
    where id = expense and payer_id is null and actual_amount = 3000 and paid_on = date '2026-11-25'
  ) then raise exception 'withdrawal_did_not_preserve_paid_expense'; end if;
  perform public.write_project_budget(command || jsonb_build_object(
    'id', expense, 'item', ((command->'item') - 'payer_id') ||
      '{"memo":"수정"}'::jsonb
  ));
  if not exists (select from public.project_expenses
    where id = expense and payer_id is null and actual_amount = 3000
      and paid_on = date '2026-11-25' and memo = '수정'
  ) then raise exception 'departed_payer_expense_not_updated'; end if;

  perform public.save_amount_format('korean');
  if (select amount_format from public.users where id = owner_id) is distinct from 'korean'
    then raise exception 'amount_format_not_saved'; end if;
  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if (select amount_format from public.users where id = outsider_id) is distinct from 'won'
    then raise exception 'amount_format_changed_for_other_user'; end if;
end;
$$;
rollback;
