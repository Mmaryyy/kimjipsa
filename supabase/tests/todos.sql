-- CAL-18 / SCN-CAL-11. Use a local database. Fixtures roll back.
begin;

do $$
declare
  author_id uuid := gen_random_uuid();
  spouse_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  shared_id uuid;
  private_id uuid;
  shared_before public.todos;
  private_signal timestamptz;
begin
  insert into auth.users(id) values (author_id), (spouse_id), (outsider_id);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values
      (author_id, 'google', author_id::text, '작성자', now(), now(), 'test'),
      (spouse_id, 'google', spouse_id::text, '배우자', now(), now(), 'test'),
      (outsider_id, 'google', outsider_id::text, '다른가정', now(), now(), 'test');
  insert into public.families(id, name) values (household, '할 일 가정'), (other_household, '다른 가정');
  insert into public.memberships(user_id, family_id, role)
    values (author_id, household, 'admin'), (spouse_id, household, 'admin'),
      (outsider_id, other_household, 'admin');

  perform set_config('request.jwt.claim.sub', author_id::text, true);
  set local role authenticated;
  shared_id := public.write_todo(
    '{"action":"save","item":{"title":"택배 반품","due_on":"2026-11-20","visibility":"shared"}}'
  );
  select changed_at into strict private_signal from public.todo_changes where family_id = household;
  private_id := public.write_todo(
    '{"action":"save","item":{"title":"개인 할 일","due_on":null,"visibility":"private"}}'
  );
  if not exists (select 1 from public.todos where id = private_id) then
    raise exception 'SCN-CAL-11: owner could not read private todo';
  end if;
  if (select changed_at from public.todo_changes where family_id = household) is distinct from private_signal then
    raise exception 'SCN-CAL-11: private todo published a family signal';
  end if;

  perform set_config('request.jwt.claim.sub', spouse_id::text, true);
  if exists (select 1 from public.todos where id = private_id)
    or not exists (select 1 from public.todos where id = shared_id) then
    raise exception 'SCN-CAL-11: spouse visibility mismatch';
  end if;
  begin
    perform public.write_todo(jsonb_build_object('action', 'delete', 'id', private_id));
    raise exception 'SCN-CAL-11: spouse deleted a private todo';
  exception when raise_exception then
    if sqlerrm <> 'todo_not_found' then raise; end if;
  end;
  begin
    perform public.write_todo(jsonb_build_object('action', 'save', 'id', shared_id,
      'item', '{"title":"변경","visibility":"private"}'::jsonb));
    raise exception 'SCN-CAL-11: spouse made another owner todo private';
  exception when raise_exception then
    if sqlerrm <> 'todo_forbidden' then raise; end if;
  end;
  begin
    update public.todos set title = '직접 변경' where id = shared_id;
    raise exception 'SCN-CAL-11: direct writes were allowed';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if exists (select 1 from public.todos where family_id = household)
    or exists (select 1 from public.todo_changes where family_id = household) then
    raise exception 'SCN-CAL-11: other household read todo data';
  end if;
  begin
    perform public.write_todo(jsonb_build_object('action', 'set_done', 'id', shared_id, 'done', true));
    raise exception 'SCN-CAL-11: other household completed a todo';
  exception when raise_exception then
    if sqlerrm <> 'todo_not_found' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', author_id::text, true);
  perform public.write_todo(jsonb_build_object('action', 'set_done', 'id', shared_id, 'done', true));
  perform set_config('request.jwt.claim.sub', spouse_id::text, true);
  select * into strict shared_before from public.todos where id = shared_id;
  if shared_before.completed_at is null or shared_before.completed_by is distinct from author_id then
    raise exception 'SCN-CAL-11: shared completion was not visible';
  end if;
  perform public.write_todo(jsonb_build_object('action', 'delete', 'id', shared_id));
  if exists (select 1 from public.todos where id = shared_id) then
    raise exception 'SCN-CAL-11: deleted todo still visible';
  end if;
  perform public.write_todo(jsonb_build_object('action', 'undo', 'id', shared_id));
  if (select t from public.todos t where id = shared_id) is distinct from shared_before then
    raise exception 'SCN-CAL-11: undo did not restore the original todo';
  end if;

  perform set_config('request.jwt.claim.sub', author_id::text, true);
  perform public.withdraw_account();
  reset role;
  if exists (select 1 from public.todos where id = private_id) then
    raise exception 'SCN-CAL-11: private todo survived account withdrawal';
  end if;
  if not exists (select 1 from public.todos where id = shared_id and owner_id is null
    and completed_by is null and completed_at is not null) then
    raise exception 'SCN-CAL-11: shared todo did not survive account withdrawal as expected';
  end if;
end;
$$;

rollback;
