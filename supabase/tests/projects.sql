-- PRJ-01~04 / SCN-PRJ-1. Run only against a local database after migration.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  project uuid;
  other_project uuid;
  area uuid;
  second_area uuid;
  reorder_command jsonb;
  milestone uuid;
  task uuid;
  project_item jsonb := '{"title":"이사 준비","description":"","status":"active","modules":["decisions"]}';
  task_item jsonb;
  timestamp_before timestamptz;
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
  project := public.write_project(jsonb_build_object('action', 'save_project', 'item', project_item,
    'family_id', other_household));
  if not exists(select 1 from public.projects where id = project and family_id = household) then
    raise exception 'project_used_untrusted_family';
  end if;
  begin
    perform public.write_project(jsonb_build_object(
      'action', 'save_project', 'id', project,
      'item', project_item || jsonb_build_object('description', repeat('가', 1001))
    ));
    raise exception 'long_project_description_allowed';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;
  area := public.write_project(jsonb_build_object('action', 'save_area', 'projectId', project,
    'item', jsonb_build_object('name', '예약', 'sort_order', 1)));
  second_area := public.write_project(jsonb_build_object('action', 'save_area', 'projectId', project,
    'item', jsonb_build_object('name', '준비')));
  if not exists(select 1 from public.project_areas where id = second_area and sort_order = 2) then
    raise exception 'new_area_not_appended';
  end if;
  milestone := public.write_project(jsonb_build_object('action', 'save_milestone', 'projectId', project,
    'item', jsonb_build_object('title', '계약 일정', 'is_tentative', true, 'memo', '', 'area_id', area)));
  task_item := jsonb_build_object('title', '계약서 확인', 'assignee_kind', 'member', 'assignee_id', member_id,
    'status', 'todo', 'depends_note', '', 'memo', '', 'area_id', area);
  task := public.write_project(jsonb_build_object('action', 'save_task', 'projectId', project, 'item', task_item));

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  reorder_command := jsonb_build_object(
    'action', 'reorder_areas', 'projectId', project, 'areaIds', jsonb_build_array(second_area, area)
  );
  if public.write_project(reorder_command) <> project then
    raise exception 'area_reorder_returned_wrong_project';
  end if;
  perform public.write_project(jsonb_build_object(
    'action', 'save_area', 'projectId', project, 'id', area, 'item', jsonb_build_object('name', '예약 수정')
  ));
  if not exists(select 1 from public.project_areas where id = second_area and sort_order = 0)
    or not exists(select 1 from public.project_areas where id = area and sort_order = 1 and name = '예약 수정')
  then raise exception 'area_reorder_or_rename_failed'; end if;
  begin
    perform public.write_project(reorder_command || jsonb_build_object('areaIds', jsonb_build_array(area, area)));
    raise exception 'duplicate_area_allowed';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;
  if not exists(select 1 from public.project_areas where id = area and sort_order = 1) then
    raise exception 'invalid_area_reorder_partially_applied';
  end if;

  perform public.write_project(jsonb_build_object(
    'action', 'set_task_done', 'projectId', project, 'id', task, 'done', true
  ));
  select completed_at into strict timestamp_before from public.project_tasks
    where id = task and completed_by = member_id;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.write_project(jsonb_build_object(
    'action', 'set_task_done', 'projectId', project, 'id', task, 'done', true
  ));
  if not exists(select 1 from public.project_tasks where id = task and status = 'done'
    and completed_at = timestamp_before and completed_by = member_id) then
    raise exception 'task_completion_not_idempotent';
  end if;

  other_project := public.write_project(jsonb_build_object('action', 'save_project', 'item', project_item));
  if (select sort_order from public.projects where id = other_project)
    <> (select sort_order + 1 from public.projects where id = project) then
    raise exception 'projects_not_ordered_by_creation';
  end if;
  begin
    perform public.write_project(reorder_command || jsonb_build_object('areaIds', jsonb_build_array(
      area, public.write_project(jsonb_build_object(
        'action', 'save_area', 'projectId', other_project, 'item', jsonb_build_object('name', '다른 영역')
      ))
    )));
    raise exception 'other_project_area_reorder_allowed';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;
  begin
    perform public.write_project(jsonb_build_object(
      'action', 'save_task', 'projectId', other_project, 'item', task_item
    ));
    raise exception 'other_project_area_allowed';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;

  begin
    perform public.write_project(jsonb_build_object('action', 'save_task', 'projectId', project,
      'item', task_item || jsonb_build_object('assignee_id', outsider_id)));
    raise exception 'other_family_assignee_allowed';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;

  begin
    update public.projects set title = '직접 수정' where id = project;
    raise exception 'direct_project_write_allowed';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if exists(select 1 from public.projects where id = project)
    or exists(select 1 from public.project_areas where id = area)
    or exists(select 1 from public.project_milestones where id = milestone)
    or exists(select 1 from public.project_tasks where id = task) then
    raise exception 'other_family_project_data_exposed';
  end if;
  begin
    perform public.write_project(reorder_command);
    raise exception 'other_family_area_reorder_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;
  begin
    perform public.write_project(jsonb_build_object('action', 'delete_project', 'id', project));
    raise exception 'other_family_project_write_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;
  begin
    perform public.write_project(jsonb_build_object(
      'action', 'set_task_done', 'projectId', project, 'id', task, 'done', false
    ));
    raise exception 'other_family_task_write_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.write_project(jsonb_build_object('action', 'delete_area', 'projectId', project, 'id', area));
  if not exists(select 1 from public.project_tasks where id = task and project_id = project and area_id is null)
    or not exists(select 1 from public.project_milestones where id = milestone and area_id is null) then
    raise exception 'area_removal_did_not_preserve_children';
  end if;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform public.withdraw_account();
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if not exists(select 1 from public.project_tasks where id = task and assignee_id is null
    and assignee_kind = 'unassigned' and status = 'done' and completed_by is null) then
    raise exception 'withdrawal_did_not_preserve_task';
  end if;
  perform public.write_project(jsonb_build_object('action', 'delete_project', 'id', project));
  if exists(select 1 from public.project_tasks where id = task)
    or exists(select 1 from public.project_milestones where id = milestone) then
    raise exception 'project_removal_left_children';
  end if;
end;
$$;
rollback;
