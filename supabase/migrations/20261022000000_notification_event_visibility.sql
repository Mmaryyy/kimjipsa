-- CAL-09: visibility changes use only titles the recipient was allowed to see.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('event_created', 'event_updated', 'event_deleted', 'event_participants_changed',
    'event_reminder', 'morning_summary')
);

create or replace function public.save_event(
  event_id uuid, event_title text, event_place text, event_memo text,
  event_category_id uuid, event_visibility text, event_start_date date,
  event_end_date date, event_start_time time, event_end_time time, event_is_all_day boolean,
  event_kind text default 'event', event_dday_style text default 'normal',
  event_celebrate_message text default '', event_remind_before integer default 30
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.events;
  saved_id uuid;
  previous_title text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  if event_remind_before is not null and event_remind_before not in (10, 30, 60, 1440)
    then raise exception 'invalid_event'; end if;
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
    insert into public.events(
      family_id, owner_id, visibility, start_date, end_date,
      start_time, end_time, is_all_day, kind
    )
      values (family, auth.uid(), event_visibility, event_start_date, event_end_date,
        event_start_time, event_end_time, event_is_all_day, event_kind)
      returning id into saved_id;
    insert into public.event_details(
      event_id, family_id, title, place, memo, category_id,
      dday_style, celebrate_message, remind_before
    )
      values (saved_id, family, btrim(event_title), coalesce(event_place, ''),
        coalesce(event_memo, ''), event_category_id, event_dday_style,
        coalesce(event_celebrate_message, ''), event_remind_before);
  else
    select * into target from public.events where id = event_id and family_id = family for update;
    if not found then raise exception 'event_not_found'; end if;
    if target.visibility = 'private' and target.owner_id is distinct from auth.uid()
      then raise exception 'event_forbidden'; end if;
    if event_visibility = 'private' and target.owner_id is distinct from auth.uid()
      then raise exception 'event_forbidden'; end if;
    select title into previous_title from public.event_details
      where event_details.event_id = save_event.event_id;
    update public.events set visibility = event_visibility, start_date = event_start_date,
      end_date = event_end_date, start_time = event_start_time, end_time = event_end_time,
      is_all_day = event_is_all_day, kind = event_kind where id = event_id;
    update public.event_details set title = btrim(event_title), place = coalesce(event_place, ''),
      memo = coalesce(event_memo, ''), category_id = event_category_id,
      dday_style = event_dday_style, celebrate_message = coalesce(event_celebrate_message, ''),
      remind_before = event_remind_before
      where event_details.event_id = save_event.event_id;
    saved_id := event_id;
  end if;
  if event_visibility = 'private' then
    -- Clear prior content before inserting the permitted, previously shared title.
    update public.notifications set payload = payload - 'eventTitle'
      where family_id = family and payload->>'eventId' = saved_id::text;
  end if;
  if event_id is not null and target.visibility <> event_visibility then
    perform private.notify_event_change(saved_id, family, 'event_participants_changed',
      case when target.visibility = 'shared' then previous_title else btrim(event_title) end);
  elsif event_visibility = 'shared' then
    perform private.notify_event_change(saved_id, family,
      case when event_id is null then 'event_created' else 'event_updated' end, btrim(event_title));
  end if;
  return saved_id;
end;
$$;

