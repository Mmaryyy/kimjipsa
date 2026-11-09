-- CAL-08: local-only fixtures and writes are rolled back.
begin;
insert into auth.users(id) values ('c0110000-0000-4000-8000-000000000001');
insert into public.users(id, provider, provider_user_id, display_name, terms_accepted_at, privacy_accepted_at, terms_version)
values ('c0110000-0000-4000-8000-000000000001', 'google', 'category-colors', '색상', now(), now(), 'test');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0110000-0000-4000-8000-000000000001', true);
select public.create_family('색상 확인');
do $$
declare
  color_value text;
  saved uuid;
begin
  foreach color_value in array array['blue', 'sky', 'cream', 'sand', 'sage', 'gray', '#ff0000'] loop
    saved := public.save_event_category(null, '색상 ' || color_value, color_value, 0);
    if (select color from public.event_categories where id = saved) <> color_value then
      raise exception 'category_color_save_failed';
    end if;
  end loop;
  foreach color_value in array array['red', 'teal', '#12345', '#gggggg', '#ABCDEF'] loop
    begin
      perform public.save_event_category(null, '잘못된 색', color_value, 0);
      raise exception 'invalid_color_accepted';
    exception when raise_exception then
      if sqlerrm <> 'invalid_category' then raise; end if;
    end;
    begin
      update public.event_categories set color = color_value where id = saved;
      raise exception 'invalid_color_check_accepted';
    exception when check_violation then null;
    end;
  end loop;
end;
$$;
rollback;
