-- CAL-14: rules and occurrence overrides retain ADR-0012's time/content separation.
alter table public.events
  add column recurrence text check (recurrence in ('daily', 'weekly', 'monthly', 'yearly')),
  add column recurrence_until date,
  add constraint events_recurrence_kind check (kind = 'event' or recurrence is null),
  add constraint events_recurrence_end check (recurrence_until is null or
    (recurrence is not null and recurrence_until >= start_date));

create table public.event_exceptions (
  event_id uuid not null,
  original_date date not null,
  family_id uuid not null,
  cancelled boolean not null default false,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  is_all_day boolean not null,
  primary key (event_id, original_date),
  unique (event_id, original_date, family_id),
  foreign key (event_id, family_id) references public.events(id, family_id) on delete cascade,
  check (end_date >= start_date),
  check (end_date > start_date or start_time is null or end_time is null or end_time > start_time),
  check (not is_all_day or (start_time is null and end_time is null))
);
create table public.event_exception_details (
  event_id uuid not null,
  original_date date not null,
  family_id uuid not null,
  title text not null check (length(btrim(title)) > 0),
  place text not null default '',
  memo text not null default '',
  category_id uuid not null,
  remind_before integer check (remind_before is null or remind_before in (10, 30, 60, 1440)),
  primary key (event_id, original_date),
  foreign key (event_id, original_date, family_id)
    references public.event_exceptions(event_id, original_date, family_id) on delete cascade on update cascade,
  foreign key (category_id, family_id) references public.event_categories(id, family_id)
);
alter table public.event_exceptions enable row level security;
alter table public.event_exception_details enable row level security;
revoke all on public.event_exceptions, public.event_exception_details from public, anon, authenticated;
grant select on public.event_exceptions, public.event_exception_details to authenticated;
create policy exception_times_read_family on public.event_exceptions for select to authenticated
  using (family_id = private.current_family_id());
create policy exception_details_read_authorized on public.event_exception_details for select to authenticated
  using (family_id = private.current_family_id() and exists (
    select 1 from public.events e where e.id = event_id
      and (e.visibility = 'shared' or e.owner_id = auth.uid())
  ));

create function private.is_event_occurrence(target public.events, occurrence date)
returns boolean language sql immutable set search_path = '' as $$
  select occurrence >= target.start_date and
    (target.recurrence_until is null or occurrence <= target.recurrence_until) and
    case target.recurrence
      when 'daily' then true
      when 'weekly' then (occurrence - target.start_date) % 7 = 0
      when 'monthly' then extract(day from occurrence) = extract(day from target.start_date)
      when 'yearly' then to_char(occurrence, 'MM-DD') = to_char(target.start_date, 'MM-DD')
      else false end;
$$;
revoke all on function private.is_event_occurrence(public.events, date) from public, anon, authenticated;

-- Occurrence changes keep the selected date in app and push links.
create function private.notify_event_change(
  event_id uuid, family uuid, notification_kind text, event_title text, occurrence_date date
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications(user_id, family_id, kind, payload)
    select m.user_id, family, notification_kind,
      jsonb_strip_nulls(jsonb_build_object('eventId', event_id, 'eventTitle', event_title,
        'occurrenceDate', occurrence_date,
        'actorName', (select display_name from public.users where id = auth.uid())))
    from public.memberships m where m.family_id = family and m.user_id <> auth.uid();
$$;
revoke all on function private.notify_event_change(uuid,uuid,text,text,date) from public, anon, authenticated;

-- Use the established validation, owner checks and notification behavior inside one transaction.
alter function public.save_event(uuid,text,text,text,uuid,text,date,date,time,time,boolean,text,text,text,integer)
  set schema private;
alter function private.save_event(uuid,text,text,text,uuid,text,date,date,time,time,boolean,text,text,text,integer)
  rename to save_event_base;
drop function private.save_event_base(
  uuid,text,text,text,uuid,text,date,date,time,time,boolean,text,text,text,integer
);

create or replace function private.save_event_base(
  event_id uuid, event_title text, event_place text, event_memo text,
  event_category_id uuid, event_visibility text, event_start_date date,
  event_end_date date, event_start_time time, event_end_time time, event_is_all_day boolean,
  event_kind text default 'event', event_dday_style text default 'normal',
  event_celebrate_message text default '', event_remind_before integer default 30,
  event_occurrence_date date default null
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
      where event_details.event_id = save_event_base.event_id;
    update public.events set visibility = event_visibility, start_date = event_start_date,
      end_date = event_end_date, start_time = event_start_time, end_time = event_end_time,
      is_all_day = event_is_all_day, kind = event_kind where id = event_id;
    update public.event_details set title = btrim(event_title), place = coalesce(event_place, ''),
      memo = coalesce(event_memo, ''), category_id = event_category_id,
      dday_style = event_dday_style, celebrate_message = coalesce(event_celebrate_message, ''),
      remind_before = event_remind_before
      where event_details.event_id = save_event_base.event_id;
    saved_id := event_id;
  end if;
  if event_visibility = 'private' then
    -- Clear prior content before inserting the permitted, previously shared title.
    update public.notifications set payload = payload - 'eventTitle'
      where family_id = family and payload->>'eventId' = saved_id::text;
  end if;
  if event_id is not null and target.visibility <> event_visibility then
    perform private.notify_event_change(saved_id, family, 'event_participants_changed',
      case when target.visibility = 'shared' then previous_title else btrim(event_title) end,
      event_occurrence_date);
  elsif event_visibility = 'shared' then
    perform private.notify_event_change(saved_id, family,
      case when event_id is null then 'event_created' else 'event_updated' end,
      btrim(event_title), event_occurrence_date);
  end if;
  return saved_id;
end;
$$;
revoke all on function private.save_event_base(
  uuid,text,text,text,uuid,text,date,date,time,time,boolean,text,text,text,integer,date
) from public, anon, authenticated;

create function public.save_event(
  event_id uuid, event_title text, event_place text, event_memo text,
  event_category_id uuid, event_visibility text, event_start_date date,
  event_end_date date, event_start_time time, event_end_time time, event_is_all_day boolean,
  event_kind text default 'event', event_dday_style text default 'normal',
  event_celebrate_message text default '', event_remind_before integer default 30,
  event_recurrence text default null, occurrence_date date default null, edit_scope text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target public.events;
  saved_id uuid;
  write_id uuid := event_id;
  split boolean := false;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
  if event_recurrence is not null
    and (event_recurrence not in ('daily','weekly','monthly','yearly') or event_kind <> 'event')
    then raise exception 'invalid_event'; end if;
  if event_id is not null then
    select * into target from public.events where id = event_id and family_id = family for update;
    if not found then raise exception 'event_not_found'; end if;
    if (target.visibility = 'private' or event_visibility = 'private') and target.owner_id is distinct from auth.uid()
      then raise exception 'event_forbidden'; end if;
    if target.recurrence is not null then
      if edit_scope = 'following' and event_recurrence is not null and target.recurrence_until < event_start_date
        then raise exception 'invalid_event'; end if;
      if occurrence_date is null or not private.is_event_occurrence(target, occurrence_date) or
        edit_scope is null or edit_scope not in ('single','following') then raise exception 'invalid_event'; end if;
      -- Visibility is always a series-wide operation; its contents and dates stay on the selected scope.
      if target.visibility <> event_visibility then
        perform private.save_event_base(target.id,
          (select title from public.event_details where event_details.event_id = target.id),
          (select place from public.event_details where event_details.event_id = target.id),
          (select memo from public.event_details where event_details.event_id = target.id),
          (select category_id from public.event_details where event_details.event_id = target.id),
          event_visibility, target.start_date, target.end_date, target.start_time, target.end_time,
          target.is_all_day, target.kind, 'normal', '',
          (select remind_before from public.event_details where event_details.event_id = target.id));
      end if;
      if edit_scope = 'single' then
        if event_kind <> 'event' or event_recurrence is distinct from target.recurrence
          then raise exception 'invalid_event'; end if;
        -- Validate all inputs with the existing RPC, then store only the override rows.
        saved_id := private.save_event_base(null, event_title, event_place, event_memo,
          event_category_id, 'private', event_start_date, event_end_date, event_start_time,
          event_end_time, event_is_all_day, event_kind, event_dday_style,
          event_celebrate_message, event_remind_before);
        insert into public.event_exceptions values (target.id, occurrence_date, family, false,
          event_start_date, event_end_date, event_start_time, event_end_time, event_is_all_day)
          on conflict on constraint event_exceptions_pkey do update set cancelled = false,
            start_date = excluded.start_date, end_date = excluded.end_date,
            start_time = excluded.start_time, end_time = excluded.end_time, is_all_day = excluded.is_all_day;
        insert into public.event_exception_details values (target.id, occurrence_date, family,
          btrim(event_title), coalesce(event_place,''), coalesce(event_memo,''), event_category_id, event_remind_before)
          on conflict on constraint event_exception_details_pkey do update set title = excluded.title,
            place = excluded.place,
            memo = excluded.memo, category_id = excluded.category_id, remind_before = excluded.remind_before;
        delete from public.events where id = saved_id;
        update public.events set recurrence = recurrence where id = target.id;
        if event_visibility = 'shared' then
          perform private.notify_event_change(target.id, family, 'event_updated', btrim(event_title), occurrence_date);
        end if;
        return target.id;
      end if;
      -- The selected override must not hide the newly saved series values.
      delete from public.event_exceptions
        where event_exceptions.event_id = target.id and original_date = occurrence_date;
      split := occurrence_date <> target.start_date;
      if split then
        update public.events set recurrence_until = occurrence_date - 1 where id = target.id;
        write_id := null;
      else
        -- A changed anchor cannot retain the old end bound.
        update public.events set recurrence = null, recurrence_until = null where id = target.id;
      end if;
    elsif occurrence_date is not null then raise exception 'invalid_event';
    end if;
  elsif occurrence_date is not null then raise exception 'invalid_event';
  end if;
  saved_id := private.save_event_base(write_id, event_title, event_place, event_memo,
    event_category_id, event_visibility, event_start_date, event_end_date, event_start_time,
    event_end_time, event_is_all_day, event_kind, event_dday_style,
    event_celebrate_message, event_remind_before,
    case when target.recurrence is not null or event_recurrence is not null then event_start_date end);
  update public.events set recurrence = event_recurrence,
    recurrence_until = case when event_recurrence is null then null else target.recurrence_until end
    where id = saved_id;
  if split then
    update public.events set owner_id = target.owner_id where id = saved_id;
    -- Preserve explicit future exceptions at their original dates; only matching rule dates are expanded.
    update public.event_exceptions set event_id = saved_id
      where event_exceptions.event_id = target.id and original_date > occurrence_date;
  end if;
  return saved_id;
end;
$$;
revoke all on function public.save_event(
  uuid,text,text,text,uuid,text,date,date,time,time,boolean,text,text,text,integer,text,date,text
)
  from public, anon, authenticated;
grant execute on function public.save_event(
  uuid,text,text,text,uuid,text,date,date,time,time,boolean,text,text,text,integer,text,date,text
)
  to authenticated;

alter function public.delete_event(uuid) set schema private;
alter function private.delete_event(uuid) rename to delete_event_base;
revoke all on function private.delete_event_base(uuid) from public, anon, authenticated;
create function public.delete_event(event_id uuid, occurrence_date date default null, edit_scope text default null)
returns void language plpgsql security definer set search_path = '' as $$
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
  if target.recurrence is null then
    if occurrence_date is not null then raise exception 'invalid_event'; end if;
    perform private.delete_event_base(event_id);
    return;
  end if;
  if occurrence_date is null or not private.is_event_occurrence(target, occurrence_date) or
    edit_scope is null or edit_scope not in ('single','following') then raise exception 'invalid_event'; end if;
  if edit_scope = 'following' and occurrence_date = target.start_date then
    perform private.delete_event_base(event_id);
    return;
  end if;
  if edit_scope = 'following' then
    update public.events set recurrence_until = occurrence_date - 1 where id = target.id;
    delete from public.event_exceptions where event_exceptions.event_id = target.id
      and original_date >= occurrence_date;
  else
    insert into public.event_exceptions values (target.id, occurrence_date, family, true,
      occurrence_date, occurrence_date + (target.end_date - target.start_date),
      target.start_time, target.end_time, target.is_all_day)
      on conflict on constraint event_exceptions_pkey do update set cancelled = true;
    delete from public.event_exception_details where event_exception_details.event_id = target.id
      and original_date = occurrence_date;
    update public.events set recurrence = recurrence where id = target.id;
  end if;
  if target.visibility = 'shared' then
    perform private.notify_event_change(target.id, family, 'event_deleted',
      (select title from public.event_details where event_details.event_id = target.id), occurrence_date);
  end if;
end;
$$;
revoke all on function public.delete_event(uuid,date,text) from public, anon, authenticated;
grant execute on function public.delete_event(uuid,date,text) to authenticated;

create function private.reassign_exception_category() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.event_exception_details set category_id = fallback.id
    from public.event_categories fallback
    where fallback.family_id = old.family_id and fallback.name = '기타'
      and fallback.id <> old.id and event_exception_details.category_id = old.id;
  return old;
end;
$$;
revoke all on function private.reassign_exception_category() from public, anon, authenticated;
create trigger reassign_exception_category before delete on public.event_categories
  for each row execute function private.reassign_exception_category();

create function private.notification_occurrence_valid(event_id uuid, original_date text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.events e where e.id = event_id and
    ((e.recurrence is null and original_date is null) or (original_date is not null and
      private.is_event_occurrence(e, original_date::date) and not exists (
        select 1 from public.event_exceptions x where x.event_id = e.id and
          x.original_date = notification_occurrence_valid.original_date::date and x.cancelled
      ))));
$$;
revoke all on function private.notification_occurrence_valid(uuid,text) from public, anon, authenticated;

create or replace function public.notification_worker(worker_secret text, operation text, input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  expected text;
  notification_id uuid;
  target_user uuid;
  target_family uuid;
  target_event public.events;
  notification_kind text;
  dedupe text;
  result jsonb;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'cron_secret';
  if expected is null or expected = '' or worker_secret is distinct from expected
    then raise exception 'unauthorized'; end if;
  if operation = 'snapshot' then
    return jsonb_build_object(
      'now', now(),
      'users', coalesce((select jsonb_agg(jsonb_build_object(
        'id', u.id, 'familyId', m.family_id, 'morningTime', u.morning_summary_time
      )) from public.users u join public.memberships m on m.user_id = u.id), '[]'),
      'events', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'familyId', e.family_id, 'ownerId', e.owner_id,
        'visibility', e.visibility, 'kind', e.kind, 'startDate', e.start_date, 'endDate', e.end_date,
        'recurrence', e.recurrence, 'recurrenceUntil', e.recurrence_until,
        'exceptions', coalesce((select jsonb_agg(jsonb_build_object(
          'originalDate', x.original_date, 'cancelled', x.cancelled,
          'startDate', x.start_date, 'endDate', x.end_date, 'startTime', x.start_time,
          'isAllDay', x.is_all_day, 'title', xd.title, 'remindBefore', xd.remind_before
        )) from public.event_exceptions x left join public.event_exception_details xd
          on xd.event_id = x.event_id and xd.original_date = x.original_date where x.event_id = e.id
          and (x.original_date between (now() at time zone 'Asia/Seoul')::date - 2
              and (now() at time zone 'Asia/Seoul')::date + 2
            or x.start_date between (now() at time zone 'Asia/Seoul')::date - 2
              and (now() at time zone 'Asia/Seoul')::date + 2)), '[]'),
        'title', d.title, 'startTime', e.start_time, 'isAllDay', e.is_all_day, 'remindBefore', d.remind_before
      )) from public.events e join public.event_details d on d.event_id = e.id
        where (e.recurrence is not null and (e.recurrence_until is null
          or e.recurrence_until >= (now() at time zone 'Asia/Seoul')::date - 1))
          or e.kind = 'dday' or (e.end_date >= ((now() - interval '5 minutes') at time zone 'Asia/Seoul')::date
          and e.start_date <= (now() at time zone 'Asia/Seoul')::date + 1)), '[]')
    );
  elsif operation = 'schedule' then
    target_user := (input->>'userId')::uuid;
    target_family := (input->>'familyId')::uuid;
    notification_kind := input->>'kind';
    if not exists(select 1 from public.memberships where user_id = target_user and family_id = target_family)
      then return 'null'::jsonb; end if;
    if notification_kind = 'event_reminder' then
      select * into target_event from public.events where id = (input->'payload'->>'eventId')::uuid
        and family_id = target_family and (visibility = 'shared' or owner_id = target_user) for share;
      if not found or not private.notification_occurrence_valid(target_event.id, input->'payload'->>'occurrenceDate')
        then return 'null'::jsonb; end if;
    elsif notification_kind = 'morning_summary' then
      if exists (
        select 1 from jsonb_array_elements_text(input->'payload'->'eventIds') item
        where not exists(select 1 from public.events e where e.id = item::uuid
          and e.family_id = target_family and (e.visibility = 'shared' or e.owner_id = target_user))
      ) then return 'null'::jsonb; end if;
    else raise exception 'invalid_kind'; end if;
    if notification_kind = 'morning_summary' and exists (
      select 1 from jsonb_array_elements(coalesce(input->'payload'->'occurrences', '[]')) item
      where not private.notification_occurrence_valid((item->>'eventId')::uuid, item->>'originalDate')
    ) then return 'null'::jsonb; end if;
    dedupe := input->>'key';
    -- Serialize competing minute ticks before inserting either row.
    perform pg_advisory_xact_lock(hashtextextended(dedupe, 5));
    if exists(select 1 from private.notification_schedule_log where dedupe_key = dedupe)
      then return 'null'::jsonb; end if;
    insert into public.notifications(user_id, family_id, kind, payload)
      values (target_user, target_family, notification_kind, input->'payload') returning id into notification_id;
    insert into private.notification_schedule_log(dedupe_key, notification_id) values (dedupe, notification_id);
    return to_jsonb(notification_id);
  elsif operation = 'claim_push' then
    -- Claim each device before network I/O; retain successful claims on retries.
    with candidates as (
      select n.id from public.notifications n join public.users u on u.id = n.user_id
      where u.push_enabled and n.created_at > now() - interval '5 minutes'
        and (n.kind <> 'event_reminder' or exists(select 1 from public.events e
          where e.id = (n.payload->>'eventId')::uuid and e.family_id = n.family_id
            and (e.visibility = 'shared' or e.owner_id = n.user_id)
            and private.notification_occurrence_valid(e.id, n.payload->>'occurrenceDate')))
        and (n.kind <> 'morning_summary' or not exists(
          select 1 from jsonb_array_elements_text(n.payload->'eventIds') item
          where not exists(select 1 from public.events e where e.id = item::uuid
            and e.family_id = n.family_id and (e.visibility = 'shared' or e.owner_id = n.user_id))))
        and (n.kind <> 'morning_summary' or not exists (
          select 1 from jsonb_array_elements(coalesce(n.payload->'occurrences', '[]')) item
          where not private.notification_occurrence_valid((item->>'eventId')::uuid, item->>'originalDate')
        ))
        and exists(select 1 from public.push_subscriptions s where s.user_id = n.user_id
          and not exists(select 1 from private.notification_push_log l
            where l.notification_id = n.id and l.endpoint = s.endpoint))
        and exists(select 1 from public.memberships m where m.user_id = n.user_id and m.family_id = n.family_id)
      order by n.created_at limit 20
    ), claimed as (
      insert into private.notification_push_log(notification_id, endpoint)
      select c.id, s.endpoint from candidates c
        join public.notifications n on n.id = c.id
        join public.push_subscriptions s on s.user_id = n.user_id
      on conflict do nothing
      returning notification_push_log.notification_id, notification_push_log.endpoint
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'user_id', n.user_id, 'family_id', n.family_id,
      'kind', n.kind, 'payload', n.payload, 'read_at', n.read_at, 'created_at', n.created_at,
      'subscriptions', (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', s.keys))
        from public.push_subscriptions s join claimed c
          on c.notification_id = n.id and c.endpoint = s.endpoint
        where s.user_id = n.user_id)
    )), '[]') into result from public.notifications n
      where exists(select 1 from claimed c where c.notification_id = n.id);
    return result;
  elsif operation = 'release_push' then
    delete from private.notification_push_log
      where notification_push_log.notification_id = (input->>'notificationId')::uuid
        and endpoint = input->>'endpoint';
    return 'null'::jsonb;
  elsif operation = 'delete_subscription' then
    delete from public.push_subscriptions where endpoint = input->>'endpoint'
      and user_id = (input->>'userId')::uuid;
    return 'null'::jsonb;
  end if;
  raise exception 'invalid_operation';
end;
$$;
