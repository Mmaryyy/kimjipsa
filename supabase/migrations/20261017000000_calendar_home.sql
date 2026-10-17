-- P4: CAL-06, CAL-07, CAL-13, CAL-16, ACC-12; DEC-009 item 2.
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('event', 'dday'));
alter table public.events add constraint events_dday_date_check
  check (kind <> 'dday' or (start_date = end_date and is_all_day));
alter table public.event_details
  add column dday_style text not null default 'normal' check (dday_style in ('normal', 'celebrate')),
  add column celebrate_message text not null default '';
alter table public.users
  add column home_view text not null default 'week' check (home_view in ('month', 'week', 'day')),
  add column upcoming_enabled boolean not null default true,
  add column upcoming_count integer not null default 5 check (upcoming_count in (3, 5, 10));

-- Replace the old signature so default arguments do not create an ambiguous overload.
drop function public.save_event(uuid, text, text, text, uuid, text, date, date, time, time, boolean);
create function public.save_event(
  event_id uuid, event_title text, event_place text, event_memo text,
  event_category_id uuid, event_visibility text, event_start_date date,
  event_end_date date, event_start_time time, event_end_time time, event_is_all_day boolean,
  event_kind text default 'event', event_dday_style text default 'normal',
  event_celebrate_message text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.events;
  saved_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  if event_kind is null or event_kind not in ('event', 'dday') or
     event_dday_style is null or event_dday_style not in ('normal', 'celebrate') or
     (event_kind = 'dday' and (event_start_date <> event_end_date or not event_is_all_day)) or
     (event_kind = 'event' and (event_dday_style <> 'normal' or coalesce(event_celebrate_message, '') <> ''))
     then raise exception 'invalid_event'; end if;
  if event_title is null or length(btrim(event_title)) = 0 or
     event_visibility is null or event_visibility not in ('shared', 'private') or
     event_start_date is null or event_end_date is null or event_end_date < event_start_date or
     (event_start_date = event_end_date and event_start_time is not null and event_end_time is not null
       and event_end_time <= event_start_time) or
     (event_is_all_day and (event_start_time is not null or event_end_time is not null)) or
     event_is_all_day is null then raise exception 'invalid_event'; end if;
  if not exists(select 1 from public.event_categories where id = event_category_id and family_id = family)
    then raise exception 'category_not_found'; end if;
  if event_id is null then
    insert into public.events(family_id, owner_id, visibility, start_date, end_date, start_time, end_time, is_all_day, kind)
      values (family, auth.uid(), event_visibility, event_start_date, event_end_date,
        event_start_time, event_end_time, event_is_all_day, event_kind)
      returning id into saved_id;
    insert into public.event_details(event_id, family_id, title, place, memo, category_id, dday_style, celebrate_message)
      values (saved_id, family, btrim(event_title), coalesce(event_place, ''),
        coalesce(event_memo, ''), event_category_id, event_dday_style, coalesce(event_celebrate_message, ''));
  else
    select * into target from public.events where id = event_id and family_id = family for update;
    if not found then raise exception 'event_not_found'; end if;
    if target.visibility = 'private' and target.owner_id is distinct from auth.uid()
      then raise exception 'event_forbidden'; end if;
    if event_visibility = 'private' and target.owner_id is distinct from auth.uid()
      then raise exception 'event_forbidden'; end if;
    update public.events set visibility = event_visibility, start_date = event_start_date,
      end_date = event_end_date, start_time = event_start_time, end_time = event_end_time,
      is_all_day = event_is_all_day, kind = event_kind where id = event_id;
    update public.event_details set title = btrim(event_title), place = coalesce(event_place, ''),
      memo = coalesce(event_memo, ''), category_id = event_category_id,
      dday_style = event_dday_style, celebrate_message = coalesce(event_celebrate_message, '')
      where event_details.event_id = save_event.event_id;
    saved_id := event_id;
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_event(uuid, text, text, text, uuid, text, date, date, time, time, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_event(uuid, text, text, text, uuid, text, date, date, time, time, boolean, text, text, text)
  to authenticated;

create function public.save_home_settings(home_view text, upcoming_enabled boolean, upcoming_count integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if home_view is null or home_view not in ('month', 'week', 'day') or
     upcoming_enabled is null or upcoming_count is null or upcoming_count not in (3, 5, 10)
     then raise exception 'invalid_home_settings'; end if;
  update public.users set home_view = save_home_settings.home_view,
    upcoming_enabled = save_home_settings.upcoming_enabled, upcoming_count = save_home_settings.upcoming_count
    where id = auth.uid();
  if not found then raise exception 'unauthorized'; end if;
end;
$$;

create table public.dday_card_dismissals (
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  year integer not null check (year between 1 and 9999),
  primary key (user_id, event_id, year)
);
alter table public.dday_card_dismissals enable row level security;
revoke all on public.dday_card_dismissals from public, anon, authenticated;
grant select on public.dday_card_dismissals to authenticated;
create policy dismissals_read_self on public.dday_card_dismissals for select to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.event_details d where d.event_id = dday_card_dismissals.event_id
  ));

create function public.dismiss_dday_card(event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not exists (
    select 1 from public.events e join public.event_details d on d.event_id = e.id
    where e.id = dismiss_dday_card.event_id and e.family_id = private.current_family_id()
      and (e.visibility = 'shared' or e.owner_id = auth.uid())
      and e.kind = 'dday' and d.dday_style = 'celebrate' and e.start_date <= today
      and extract(month from e.start_date) = extract(month from today)
      and extract(day from e.start_date) = extract(day from today)
  ) then raise exception 'event_not_found'; end if;
  insert into public.dday_card_dismissals(user_id, event_id, year)
    values (auth.uid(), dismiss_dday_card.event_id, extract(year from today)::integer) on conflict do nothing;
end;
$$;
revoke all on function public.save_home_settings(text, boolean, integer), public.dismiss_dday_card(uuid)
  from public, anon, authenticated;
grant execute on function public.save_home_settings(text, boolean, integer), public.dismiss_dday_card(uuid)
  to authenticated;
