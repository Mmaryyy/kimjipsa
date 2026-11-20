-- PRJ-05, PRJ-08, PRJ-09, PRJ-11 / SCN-PRJ-2.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  project uuid;
  decision uuid;
  reservation uuid;
  stop uuid;
  milestone uuid;
  entry record;
  linked_event uuid;
  category_id uuid;
  event_command jsonb;
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
    '{"title":"여행","description":"","status":"active","modules":["decisions","reservations","itinerary"]}'::jsonb));
  decision := public.write_project_module(jsonb_build_object('action', 'save_decision', 'projectId', project,
    'item', jsonb_build_object('question', '어디로 갈까요?', 'status', 'discussing', 'options', '', 'final_choice', '',
      'opinions', jsonb_build_array(jsonb_build_object('user_id', member_id, 'opinion', '파리')))));
  reservation := public.write_project_module(jsonb_build_object('action', 'save_reservation', 'projectId', project,
    'item', '{"title":"호텔","kind":"lodging","status":"booked","starts_on":"2027-04-28",
      "reference_no":"","links":[],"total_amount":10,"paid_amount":10,"memo":""}'::jsonb));
  stop := public.write_project_module(jsonb_build_object('action', 'save_itinerary', 'projectId', project,
    'item', '{"title":"도착","place":"공항","starts_on":"2027-04-28","links":[],"memo":""}'::jsonb));
  milestone := public.write_project(jsonb_build_object('action', 'save_milestone', 'projectId', project,
    'item', '{"title":"여행 시작","starts_on":"2027-04-28","memo":"","is_tentative":false}'::jsonb));

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if exists (select from public.project_decision_opinions where decision_id = decision)
    or exists (select from public.project_decisions where id = decision)
    or exists (select from public.project_reservations where id = reservation)
    or exists (select from public.project_itinerary where id = stop)
  then raise exception 'other_family_module_data_exposed'; end if;
  begin
    perform public.write_project_module(jsonb_build_object(
      'action', 'delete_decision', 'projectId', project, 'id', decision));
    raise exception 'other_family_module_write_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select id into strict category_id from public.event_categories where name = '기타';
  for entry in select * from (values
    (milestone, 'milestones', '여행 시작'), (reservation, 'reservations', '호텔'), (stop, 'itinerary', '도착')
  ) as sources(id, module, title) loop
    event_command := jsonb_build_object(
      'action', 'add_project_event', 'projectId', project, 'id', entry.id, 'source', entry.module);
    perform public.write_project_module(event_command);
    perform public.write_project_module(event_command);
    select event_id into strict linked_event from public.event_details where title = entry.title;
    if not exists (select from public.events where id = linked_event and visibility = 'shared')
      then raise exception 'project_event_not_shared'; end if;
    perform public.save_event(linked_event, entry.title, '', '', category_id, 'private',
      date '2027-04-28', date '2027-04-28', null, null, true);
    perform public.write_project_module(event_command);
    perform public.delete_event(linked_event);
    select ed.event_id into strict linked_event from public.event_details ed
      join public.events e on e.id = ed.event_id where ed.title = entry.title and e.visibility = 'shared';
    perform public.delete_event(linked_event);
  end loop;
  if not exists (select from public.project_milestones where id = milestone and event_id is null)
    or not exists (select from public.project_reservations where id = reservation and event_id is null)
    or not exists (select from public.project_itinerary where id = stop and event_id is null)
  then raise exception 'event_deletion_did_not_preserve_project_items'; end if;

  perform public.withdraw_account();
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if not exists (select from public.project_decision_opinions
    where decision_id = decision and user_id is null and opinion = '파리')
  then raise exception 'withdrawal_did_not_preserve_opinion'; end if;
end;
$$;
rollback;
