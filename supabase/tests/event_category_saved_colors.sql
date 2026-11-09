-- CAL-08: local-only history, isolation and rollback checks.
begin;
insert into auth.users(id) values
  ('c0110000-0000-4000-8000-000000000011'),
  ('c0110000-0000-4000-8000-000000000012');
insert into public.users(
  id, provider, provider_user_id, display_name, terms_accepted_at, privacy_accepted_at, terms_version
)
values
  ('c0110000-0000-4000-8000-000000000011', 'google', 'saved-colors-1', '색상', now(), now(), 'test'),
  ('c0110000-0000-4000-8000-000000000012', 'google', 'saved-colors-2', '다른집', now(), now(), 'test');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0110000-0000-4000-8000-000000000011', true);
select public.create_family('저장 색 확인');
do $$
declare
  saved uuid;
  previous_saved_at timestamptz;
begin
  saved := public.save_event_category(null, '직접 색', '#ab1234', 0);
  select saved_at into strict previous_saved_at from public.event_category_saved_colors where color = '#ab1234';
  perform public.save_event_category(saved, '직접 색', 'blue', 0);
  if not exists (select 1 from public.event_category_saved_colors where color = '#ab1234') then
    raise exception 'history_lost_after_preset';
  end if;
  perform public.save_event_category(saved, '직접 색', '#ab1234', 0);
  if (select saved_at from public.event_category_saved_colors where color = '#ab1234') <= previous_saved_at then
    raise exception 'history_recency_not_updated';
  end if;
  perform public.delete_event_category(saved);
  if (select count(*) from public.event_category_saved_colors where color = '#ab1234') <> 1 then
    raise exception 'history_lost_after_delete';
  end if;
  begin
    insert into public.event_category_saved_colors(family_id, color)
      values (private.current_family_id(), '#ff0000');
    raise exception 'direct_history_write_allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', 'c0110000-0000-4000-8000-000000000012', true);
select public.create_family('다른 가정');
do $$
begin
  if exists (select 1 from public.event_category_saved_colors) then
    raise exception 'other_family_history_exposed';
  end if;
end;
$$;
rollback;
