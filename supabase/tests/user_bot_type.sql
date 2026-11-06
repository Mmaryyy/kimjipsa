-- BOT-18: local-only, all fixtures are rolled back.
begin;
insert into auth.users(id) values
  ('b0110000-0000-4000-8000-000000000001'),
  ('b0110000-0000-4000-8000-000000000002');
insert into public.users(id, provider, provider_user_id, display_name, terms_accepted_at, privacy_accepted_at, terms_version)
values
  ('b0110000-0000-4000-8000-000000000001', 'google', 'bot-type-first', '첫째', now(), now(), 'test'),
  ('b0110000-0000-4000-8000-000000000002', 'google', 'bot-type-second', '둘째', now(), now(), 'test');
insert into public.user_bot_settings(user_id)
values ('b0110000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0110000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select bot_type from public.user_bot_settings) <> 'butler' then
    raise exception 'default_type_failed';
  end if;
  update public.user_bot_settings set bot_type = 'nobi';
  if (select bot_type from public.user_bot_settings) <> 'nobi' then
    raise exception 'save_type_failed';
  end if;
  begin
    insert into public.user_bot_settings(user_id, bot_type)
      values ('b0110000-0000-4000-8000-000000000002', 'nobi');
    raise exception 'other_user_insert_allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', 'b0110000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists(select 1 from public.user_bot_settings) then
    raise exception 'other_user_visible';
  end if;
  update public.user_bot_settings set bot_type = 'butler';
  if found then raise exception 'other_user_update_allowed'; end if;
end;
$$;
rollback;
