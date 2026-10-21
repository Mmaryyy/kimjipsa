-- P5a: CAL-09, CAL-11 input, ACC-11, DEC-009 item 1. No push or scheduler.
alter table public.event_details add column remind_before integer default 30
  check (remind_before is null or remind_before in (10, 30, 60, 1440));
alter table public.users
  add column push_enabled boolean not null default true,
  add column morning_summary_time time not null default '10:00'
    check (extract(second from morning_summary_time) = 0);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('event_created', 'event_updated', 'event_deleted')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy notifications_read_self on public.notifications for select to authenticated
  using (user_id = auth.uid() and family_id = private.current_family_id());
create policy notifications_mark_self on public.notifications for update to authenticated
  using (user_id = auth.uid() and family_id = private.current_family_id())
  with check (user_id = auth.uid() and family_id = private.current_family_id());

-- Only called inside the event RPC transaction, after its permission checks.
create function private.notify_event_change(event_id uuid, family uuid, notification_kind text, event_title text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications(user_id, family_id, kind, payload)
    select m.user_id, family, notification_kind,
      jsonb_build_object('eventId', event_id, 'eventTitle', event_title,
        'actorName', (select display_name from public.users where id = auth.uid()))
    from public.memberships m where m.family_id = family and m.user_id <> auth.uid();
$$;
revoke all on function private.notify_event_change(uuid, uuid, text, text) from public, anon, authenticated;

-- Replace the old signature so default arguments do not create an ambiguous overload.
drop function public.save_event(uuid, text, text, text, uuid, text, date, date, time, time, boolean, text, text, text);
create function public.save_event(
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
  if event_visibility = 'shared' then
    perform private.notify_event_change(saved_id, family,
      case when event_id is null then 'event_created' else 'event_updated' end, btrim(event_title));
  else
    -- Previously shared content must not linger in a personal event's payload.
    update public.notifications set payload = payload - 'eventTitle'
      where family_id = family and payload->>'eventId' = saved_id::text;
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_event(
  uuid, text, text, text, uuid, text, date, date,
  time, time, boolean, text, text, text, integer
)
  from public, anon, authenticated;
grant execute on function public.save_event(
  uuid, text, text, text, uuid, text, date, date,
  time, time, boolean, text, text, text, integer
)
  to authenticated;


create or replace function public.delete_event(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.events;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  select * into target from public.events where id = event_id and family_id = family for update;
  if not found then raise exception 'event_not_found'; end if;
  if target.visibility = 'private' and target.owner_id is distinct from auth.uid()
    then raise exception 'event_forbidden'; end if;
  if target.visibility = 'shared' then
    perform private.notify_event_change(target.id, family, 'event_deleted',
      (select title from public.event_details where event_details.event_id = target.id));
  end if;
  update public.notifications set payload = payload || '{"eventDeleted": true}'::jsonb
    where family_id = family and payload->>'eventId' = event_id::text;
  delete from public.events where id = event_id;
end;
$$;

create function public.save_notification_settings(push_enabled boolean, morning_summary_time text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if push_enabled is null or morning_summary_time is null or length(morning_summary_time) <> 5 or
    morning_summary_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then raise exception 'invalid_notification_settings'; end if;
  update public.users set push_enabled = save_notification_settings.push_enabled,
    morning_summary_time = save_notification_settings.morning_summary_time::time
    where id = auth.uid();
  if not found then raise exception 'unauthorized'; end if;
end;
$$;
revoke all on function public.save_notification_settings(boolean, text) from public, anon, authenticated;
grant execute on function public.save_notification_settings(boolean, text) to authenticated;
