-- PRJ-06 and PRJ-07 / SCN-PRJ-3.
-- Migration: 20261125010000_project_lists.sql.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  household uuid := gen_random_uuid();
  other_household uuid := gen_random_uuid();
  tag uuid := gen_random_uuid();
  region uuid := gen_random_uuid();
  project uuid;
  roster uuid;
  candidates uuid;
  person uuid;
  candidate uuid;
  photo uuid;
  original text;
  thumb text;
  roster_input jsonb;
  photo_input jsonb;
  error_detail text;
begin
  insert into auth.users(id) values (owner_id), (outsider_id);
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values
      (owner_id, 'google', owner_id::text, '테스트가', now(), now(), 'test'),
      (outsider_id, 'google', outsider_id::text, '테스트나', now(), now(), 'test');
  insert into public.families(id, name) values (household, '내 가정'), (other_household, '다른 가정');
  insert into public.memberships(user_id, family_id, role)
    values (owner_id, household, 'admin'), (outsider_id, other_household, 'admin');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  project := public.write_project(jsonb_build_object('action', 'save_project', 'item',
    '{"title":"결혼 준비","description":"","status":"active","modules":["lists"]}'::jsonb));
  roster_input := jsonb_build_object('name', '가족 명단', 'kind', 'people',
    'columns', jsonb_build_array(jsonb_build_object('key', region, 'label', '지역',
      'type', 'select', 'options', jsonb_build_array('광주'))),
    'tags', jsonb_build_array(jsonb_build_object('key', tag, 'label', '답례품')));
  roster := public.write_project_list(jsonb_build_object('action', 'save_list', 'projectId', project,
    'item', roster_input));
  candidates := public.write_project_list(jsonb_build_object('action', 'save_list', 'projectId', project,
    'item', jsonb_build_object('name', '후보 목록', 'kind', 'candidates', 'columns', '[]'::jsonb,
      'tags', '[]'::jsonb, 'quantity_list_id', roster, 'quantity_tag_key', tag)));
  person := public.write_project_list(jsonb_build_object('action', 'save_list_item', 'projectId', project,
    'listId', roster, 'item', '{"title":"사람","values":{},"links":[],"memo":"","done_tags":[]}'::jsonb
      || jsonb_build_object('tags', jsonb_build_array(tag), 'values', jsonb_build_object(region::text, '광주'))));
  candidate := public.write_project_list(jsonb_build_object('action', 'save_list_item', 'projectId', project,
    'listId', candidates, 'item', '{"title":"선물","status":"candidate","values":{},"links":[],"memo":"",
      "price":0,"tags":[],"done_tags":[]}'::jsonb));
  perform public.write_project_list(jsonb_build_object('action', 'set_list_tag_done', 'projectId', project,
    'listId', roster, 'id', person, 'tagKey', tag, 'done', true));
  if not exists (select from public.project_list_items where id = person and tag::text = any(done_tags))
    then raise exception 'tag_not_completed'; end if;

  begin
    perform public.write_project_list(jsonb_build_object('action', 'save_list', 'projectId', project,
      'id', roster, 'item', jsonb_set(roster_input, '{columns,0,options}', '["광주광역시"]')));
    raise exception 'used_project_option_was_renamed';
  exception when raise_exception then
    get stacked diagnostics error_detail = pg_exception_detail;
    if sqlerrm <> 'project_columns_in_use' or error_detail is distinct from '‘사람’' then raise; end if;
  end;

  photo_input := jsonb_build_object('projectId', project, 'listId', candidates, 'id', candidate);
  photo := public.write_project_list(photo_input || '{"action":"reserve_list_photo"}');
  photo_input := photo_input || jsonb_build_object('photoId', photo);
  original := household || '/' || candidate || '/' || photo || '.jpg';
  thumb := household || '/' || candidate || '/' || photo || '-thumb.jpg';
  if exists (select from public.project_photos where id = photo)
    then raise exception 'pending_photo_metadata_visible'; end if;
  insert into storage.objects(bucket_id, name) values ('project-photos', original);
  if exists (select from storage.objects where bucket_id = 'project-photos' and name = original)
    then raise exception 'pending_photo_object_visible'; end if;
  begin
    perform public.write_project_list(photo_input || '{"action":"finalize_list_photo"}');
    raise exception 'photo_finalized_without_thumbnail';
  exception when raise_exception then
    if sqlerrm <> 'photo_upload_failed' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if exists (select from public.project_photos where id = photo)
    or exists (select from storage.objects where bucket_id = 'project-photos' and name = original)
    then raise exception 'other_family_photo_read_allowed'; end if;
  begin
    insert into storage.objects(bucket_id, name) values ('project-photos', thumb);
    raise exception 'other_family_photo_upload_allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.write_project_list(photo_input || '{"action":"finalize_list_photo"}');
    raise exception 'other_family_photo_finalize_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into storage.objects(bucket_id, name) values ('project-photos', thumb);
  perform public.write_project_list(photo_input || '{"action":"finalize_list_photo"}');
  if not exists (select from public.project_photos where id = photo and is_ready)
    or (select count(*) from storage.objects where bucket_id = 'project-photos' and name in (original, thumb)) <> 2
    then raise exception 'confirmed_photo_hidden'; end if;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  if exists (select from public.project_photos where id = photo)
    or exists (select from storage.objects where bucket_id = 'project-photos' and name in (original, thumb))
    then raise exception 'other_family_confirmed_photo_read_allowed'; end if;
  begin
    perform public.write_project_list(jsonb_build_object('action', 'delete_list_photo', 'projectId', project,
      'listId', candidates, 'id', candidate, 'photoId', photo));
    raise exception 'other_family_photo_deletion_allowed';
  exception when raise_exception then
    if sqlerrm <> 'project_not_found' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.write_project_list(jsonb_build_object('action', 'save_list', 'projectId', project, 'id', roster,
    'item', roster_input || '{"tags":[]}'::jsonb));
  if not exists (select from public.project_lists where id = candidates
      and quantity_list_id is null and quantity_tag_key is null)
    or not exists (select from public.project_list_items where id = person and tags = '{}' and done_tags = '{}')
    then raise exception 'removed_tag_references_remain'; end if;

  perform public.write_project_list(jsonb_build_object('action', 'delete_list',
    'projectId', project, 'id', candidates));
  if exists (select from public.project_photos where id = photo)
    then raise exception 'list_deletion_left_photo_metadata'; end if;
  reset role;
  if (select count(*) from private.agent_file_deletions
    where path in ('project-photos:' || original, 'project-photos:' || thumb)) <> 2
    then raise exception 'photo_deletion_queue_incomplete'; end if;
end;
$$;
rollback;
