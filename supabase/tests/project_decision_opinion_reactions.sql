-- PRJ-05 / SCN-PRJ-2: opinion reactions, family isolation, and withdrawal.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  author_id uuid := gen_random_uuid();
  reactor_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  project uuid;
  decision uuid;
  other_decision uuid;
  author_opinion uuid;
  owner_opinion uuid;
  decision_item jsonb := '{"question":"시간을 정할까요?","status":"discussing","options":"","final_choice":"","opinions":[]}';
  opinion_command jsonb;
  reaction_command jsonb;
begin
  insert into auth.users(id) values (owner_id), (author_id), (reactor_id), (outsider_id);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    select id, 'google', id::text, '테스트', now(), now(), 'test'
    from unnest(array[owner_id, author_id, reactor_id, outsider_id]) as u(id);
  insert into public.families(id, name)
    values (household, '프로젝트'), (other_household, '격리 확인');
  insert into public.memberships(user_id, family_id, role)
    values (owner_id, household, 'admin'), (author_id, household, 'member'),
      (reactor_id, household, 'member'), (outsider_id, other_household, 'admin');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  project := public.write_project(jsonb_build_object('action', 'save_project', 'item',
    '{"title":"여행","description":"","status":"active","modules":["decisions"]}'::jsonb));
  decision := public.write_project_module(jsonb_build_object(
    'action', 'save_decision', 'projectId', project, 'item', decision_item));
  other_decision := public.write_project_module(jsonb_build_object(
    'action', 'save_decision', 'projectId', project, 'item', decision_item));
  opinion_command := jsonb_build_object('action', 'save_decision_opinion', 'projectId', project, 'id', decision,
    'item', '{"opinion":"점심이 좋아요"}'::jsonb);
  perform public.write_project_decision_opinion(opinion_command);
  select id into strict owner_opinion from public.project_decision_opinions
    where decision_id = decision and user_id = owner_id;

  perform set_config('request.jwt.claim.sub', author_id::text, true);
  perform public.write_project_decision_opinion(opinion_command);
  select id into strict author_opinion from public.project_decision_opinions
    where decision_id = decision and user_id = author_id;
  reaction_command := jsonb_build_object('action', 'set_decision_opinion_reaction', 'projectId', project,
    'id', decision, 'opinionId', author_opinion, 'reaction', 'up');
  begin
    perform public.write_project_decision_opinion(reaction_command);
    raise exception 'self_reaction_allowed';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', reactor_id::text, true);
  begin
    perform public.write_project_decision_opinion(reaction_command || jsonb_build_object('id', other_decision));
    raise exception 'wrong_decision_reaction_allowed';
  exception when raise_exception then
    if sqlerrm <> 'invalid_project' then raise; end if;
  end;
  begin
    insert into public.project_decision_opinion_reactions (family_id, opinion_id, user_id, reaction)
      values (household, author_opinion, reactor_id, 'up');
    raise exception 'direct_reaction_write_allowed';
  exception when insufficient_privilege then null;
  end;

  perform public.write_project_decision_opinion(reaction_command);
  perform public.write_project_decision_opinion(reaction_command || '{"reaction":"down"}');
  if (select reaction from public.project_decision_opinion_reactions
    where opinion_id = author_opinion and user_id = reactor_id) is distinct from 'down'
    then raise exception 'reaction_did_not_switch'; end if;
  perform public.write_project_decision_opinion(reaction_command || '{"reaction":null}');
  if exists (select from public.project_decision_opinion_reactions where opinion_id = author_opinion)
    then raise exception 'reaction_did_not_clear'; end if;
  perform public.write_project_decision_opinion(reaction_command);
  perform public.write_project_decision_opinion(reaction_command || jsonb_build_object('opinionId', owner_opinion));

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if exists (select from public.project_decision_opinion_reactions)
    then raise exception 'other_family_reaction_exposed'; end if;
  begin
    perform public.write_project_decision_opinion(reaction_command);
    raise exception 'other_family_reaction_write_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', author_id::text, true);
  perform public.write_project_decision_opinion(opinion_command || '{"item":{"opinion":"저녁도 괜찮아요"}}');
  if not exists (select from public.project_decision_opinion_reactions where opinion_id = author_opinion)
    then raise exception 'opinion_edit_removed_reaction'; end if;
  perform public.write_project_decision_opinion(opinion_command || '{"item":{"opinion":""}}');
  if exists (select from public.project_decision_opinion_reactions where opinion_id = author_opinion)
    then raise exception 'deleted_opinion_kept_reaction'; end if;
  perform public.write_project_decision_opinion(opinion_command);
  select id into strict author_opinion from public.project_decision_opinions
    where decision_id = decision and user_id = author_id;

  perform set_config('request.jwt.claim.sub', reactor_id::text, true);
  perform public.write_project_decision_opinion(reaction_command || jsonb_build_object('opinionId', author_opinion));
  perform public.withdraw_account();
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if exists (select from public.project_decision_opinion_reactions where user_id = reactor_id)
    then raise exception 'withdrawn_reactor_kept_reactions'; end if;

  perform public.write_project_decision_opinion(reaction_command || jsonb_build_object('opinionId', author_opinion));
  perform set_config('request.jwt.claim.sub', author_id::text, true);
  perform public.withdraw_account();
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if not exists (select from public.project_decision_opinions where id = author_opinion and user_id is null)
    or exists (select from public.project_decision_opinion_reactions where opinion_id = author_opinion)
    then raise exception 'withdrawn_author_cleanup_incorrect'; end if;
end;
$$;
rollback;
