-- PRJ-06 / g205: assignment, voting, manual status and family isolation.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  tag uuid := gen_random_uuid();
  project uuid;
  roster uuid;
  candidates uuid;
  person uuid;
  ineligible uuid;
  first_candidate uuid;
  next_candidate uuid;
  command jsonb;
  person_item jsonb := '{"title":"가족","status":null,"price":null,"links":[],"values":{},"done_tags":[],"memo":""}';
  candidate_item jsonb :=
    '{"title":"차","status":"candidate","price":12000,"links":[],"values":{},"tags":[],"done_tags":[],"memo":""}';
begin
  insert into auth.users(id) values (owner_id), (member_id), (outsider_id);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values
      (owner_id, 'google', owner_id::text, '테스트가', now(), now(), 'test'),
      (member_id, 'google', member_id::text, '테스트나', now(), now(), 'test'),
      (outsider_id, 'google', outsider_id::text, '테스트다', now(), now(), 'test');
  insert into public.families(id, name) values (household, '내 가정'), (other_household, '다른 가정');
  insert into public.memberships(user_id, family_id, role)
    values (owner_id, household, 'admin'), (member_id, household, 'member'),
      (outsider_id, other_household, 'admin');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  project := public.write_project(jsonb_build_object('action', 'save_project', 'item',
    '{"title":"결혼 준비","description":"","status":"active","modules":["lists"]}'::jsonb));
  roster := public.write_project_list(jsonb_build_object('action', 'save_list', 'projectId', project,
    'item', jsonb_build_object('name', '가족 명단', 'kind', 'people', 'columns', '[]'::jsonb,
      'tags', jsonb_build_array(jsonb_build_object('key', tag, 'label', '답례품')))));
  candidates := public.write_project_list(jsonb_build_object('action', 'save_list', 'projectId', project,
    'item', jsonb_build_object('name', '후보 목록', 'kind', 'candidates', 'columns', '[]'::jsonb,
      'tags', '[]'::jsonb, 'quantity_list_id', roster, 'quantity_tag_key', tag)));
  command := jsonb_build_object('action', 'save_list_item', 'projectId', project, 'listId', roster);
  person := public.write_project_list(command || jsonb_build_object('item',
    person_item || jsonb_build_object('tags', jsonb_build_array(tag))));
  ineligible := public.write_project_list(command || jsonb_build_object('item', person_item || '{"tags":[]}'));

  command := command || jsonb_build_object('listId', candidates, 'item', candidate_item || '{"status":"excluded"}');
  first_candidate := public.write_project_candidate(command);
  next_candidate := public.write_project_candidate(command);
  assert (select status = 'candidate' from public.project_list_items where id = first_candidate),
    '등록 상태는 투표를 따르는 후보여야 한다';
  command := jsonb_build_object('projectId', project, 'listId', candidates, 'id', first_candidate);

  begin
    perform public.write_project_candidate(command || jsonb_build_object(
      'action', 'set_candidate_recipient', 'personId', ineligible, 'assigned', true));
    raise exception '태그 없는 사람을 배정했다';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;
  perform public.write_project_candidate(command || jsonb_build_object(
    'action', 'set_candidate_recipient', 'personId', person, 'assigned', true));
  perform public.write_project_candidate(command || jsonb_build_object(
    'action', 'set_candidate_recipient', 'personId', person, 'assigned', true, 'id', next_candidate));
  perform public.write_project_candidate(command || jsonb_build_object(
    'action', 'set_candidate_recipient', 'personId', person, 'assigned', false));
  assert (select count(*) = 1 and bool_and(candidate_id = next_candidate)
    from public.project_candidate_recipients where person_id = person),
    '배정 이동은 원자적이며 이전 후보에서 뒤늦게 해제할 수 없어야 한다';

  perform public.write_project_candidate(command || '{"action":"set_candidate_vote","vote":"up"}');
  perform public.write_project_candidate(command || '{"action":"set_candidate_status","status":"selected"}');
  perform public.write_project_candidate(command || jsonb_build_object('action', 'save_list_item', 'item', candidate_item));
  assert (select status = 'selected' from public.project_list_items where id = first_candidate),
    '상세 정보 편집은 직접 정한 상태를 보존해야 한다';
  perform public.write_project_candidate(command || '{"action":"set_candidate_status","status":"candidate"}');
  assert (select status = 'candidate' from public.project_list_items where id = first_candidate),
    '직접 정한 상태를 지울 수 있어야 한다';

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform public.write_project_candidate(command || '{"action":"set_candidate_vote","vote":"down"}');
  perform public.write_project_candidate(command || '{"action":"set_candidate_vote","vote":"up"}');
  assert (select count(*) = 2 and bool_and(vote = 'up') from public.project_candidate_votes),
    '구성원별 투표를 교체할 수 있어야 한다';
  perform public.write_project_candidate(command || '{"action":"set_candidate_vote","vote":null}');
  assert (select count(*) = 1 from public.project_candidate_votes), '자기 투표만 취소해야 한다';
  perform public.write_project_candidate(command || '{"action":"set_candidate_vote","vote":"up"}');

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  assert not exists (select from public.project_candidate_recipients), '다른 가정 배정 조회가 허용됐다';
  assert not exists (select from public.project_candidate_votes), '다른 가정 투표 조회가 허용됐다';
  begin
    perform public.write_project_candidate(command || '{"action":"set_candidate_vote","vote":"up"}');
    raise exception '다른 가정 투표가 허용됐다';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;
  begin
    delete from public.project_candidate_votes where candidate_id = first_candidate;
    raise exception '테이블 직접 쓰기가 허용됐다';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.write_project_list(jsonb_build_object(
    'action', 'save_list_item', 'projectId', project, 'listId', roster, 'id', person,
    'item', person_item || '{"tags":[]}'));
  assert not exists (select from public.project_candidate_recipients), '대상 태그를 뗀 배정이 남았다';
  perform public.write_project_list(jsonb_build_object(
    'action', 'save_list_item', 'projectId', project, 'listId', roster, 'id', person,
    'item', person_item || jsonb_build_object('tags', jsonb_build_array(tag))));
  perform public.write_project_candidate(command || jsonb_build_object(
    'action', 'set_candidate_recipient', 'personId', person, 'assigned', true));
  perform public.write_project_list(jsonb_build_object(
    'action', 'delete_list_item', 'projectId', project, 'listId', roster, 'id', person));
  assert not exists (select from public.project_candidate_recipients), '삭제한 사람의 배정이 남았다';

  reset role;
  delete from public.memberships where user_id = member_id;
  assert not exists (select from public.project_candidate_votes where user_id = member_id),
    '탈퇴한 구성원의 투표가 남았다';
end $$;
rollback;
