-- PRJ-12/13: project deadlines and a per-user home setting.
begin;

alter table public.users add column project_deadlines_enabled boolean not null default true;

create function public.save_home_settings(
  home_view text, upcoming_enabled boolean, upcoming_count integer, project_deadlines_enabled boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if project_deadlines_enabled is null then raise exception 'invalid_home_settings'; end if;
  perform public.save_home_settings(home_view, upcoming_enabled, upcoming_count);
  update public.users set project_deadlines_enabled = save_home_settings.project_deadlines_enabled
    where id = auth.uid();
end;
$$;
revoke all on function public.save_home_settings(text, boolean, integer, boolean) from public, anon;
grant execute on function public.save_home_settings(text, boolean, integer, boolean) to authenticated;

create function private.project_deadlines(family uuid, first_day date, last_day date)
returns table (
  id uuid, "familyId" uuid, "projectId" uuid, "projectTitle" text, title text,
  kind text, date date, "assigneeKind" text, "assigneeId" uuid
) language sql stable set search_path = '' as $$
  select t.id, p.family_id, p.id, p.title, t.title, 'task', t.due_on, t.assignee_kind, t.assignee_id
  from public.projects p join public.project_tasks t on t.project_id = p.id and t.family_id = p.family_id
  where (family is null or p.family_id = family) and p.status = 'active'
    and t.status <> 'done' and t.due_on between first_day and last_day
  union all
  select d.id, p.family_id, p.id, p.title, d.question, 'decision', d.due_on, null, null
  from public.projects p join public.project_decisions d on d.project_id = p.id and d.family_id = p.family_id
  where (family is null or p.family_id = family) and p.status = 'active' and 'decisions' = any(p.modules)
    and d.status = 'discussing' and d.due_on between first_day and last_day
  union all
  select r.id, p.family_id, p.id, p.title, r.title, cutoff.kind, cutoff.date, null, null
  from public.projects p join public.project_reservations r on r.project_id = p.id and r.family_id = p.family_id
  cross join lateral (values
    ('reservation_cancel', r.cancel_deadline),
    ('reservation_payment', case when coalesce(r.total_amount, 0) > coalesce(r.paid_amount, 0)
      then r.payment_deadline end)
  ) cutoff(kind, date)
  where (family is null or p.family_id = family) and p.status = 'active' and 'reservations' = any(p.modules)
    and r.status <> 'cancelled' and cutoff.date between first_day and last_day;
$$;
revoke all on function private.project_deadlines(uuid, date, date) from public, anon, authenticated;

create function public.home_project_deadlines()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if family is null then raise exception 'family_required'; end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(d) order by d.date, d.kind, d.id), '[]')
    from (select * from private.project_deadlines(family, today, today + 6)
      order by date, kind, id limit 5) d
  );
end;
$$;
revoke all on function public.home_project_deadlines() from public, anon;
grant execute on function public.home_project_deadlines() to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('event_created', 'event_updated', 'event_deleted', 'event_participants_changed',
    'event_reminder', 'morning_summary', 'project_task_due', 'project_decision_due', 'project_reservation_due')
);

create function private.project_deadline_recipient(kind text, assignee_kind text, assignee uuid, recipient uuid)
returns boolean language sql immutable set search_path = '' as $$
  select kind <> 'task' or assignee_kind = 'together'
    or (assignee_kind = 'member' and assignee = recipient);
$$;
revoke all on function private.project_deadline_recipient(text, text, uuid, uuid) from public, anon, authenticated;

create function private.project_morning_summary(family uuid, recipient uuid, day date)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('projectDeadlineTitle', (array_agg(d.title order by d.kind, d.id))[1],
    'projectCount', count(*))
  from private.project_deadlines(family, day, day) d
  where private.project_deadline_recipient(d.kind, d."assigneeKind", d."assigneeId", recipient)
  having count(*) > 0;
$$;
revoke all on function private.project_morning_summary(uuid, uuid, date) from public, anon, authenticated;

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
  project_payload jsonb;
  deadline record;
  today date := (now() at time zone 'Asia/Seoul')::date;
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
      'deadlines', (select coalesce(jsonb_agg(to_jsonb(d) order by d.date, d.kind, d.id), '[]')
        from private.project_deadlines(null, today - 1, today + 1) d),
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
    elsif notification_kind in ('project_task_due', 'project_decision_due', 'project_reservation_due') then
      select d.* into deadline
      from private.project_deadlines(target_family, (input->'payload'->>'date')::date,
        (input->'payload'->>'date')::date) d
      where d.id = (input->'payload'->>'projectItemId')::uuid
        and d.kind = input->'payload'->>'deadlineKind'
        and private.project_deadline_recipient(d.kind, d."assigneeKind", d."assigneeId", target_user);
      if not found then return 'null'::jsonb; end if;
      project_payload := jsonb_build_object(
        'projectItemId', deadline.id, 'projectId', deadline."projectId", 'projectTitle', deadline."projectTitle",
        'deadlineKind', deadline.kind, 'projectDeadlineTitle', deadline.title, 'date', deadline.date
      );
    elsif notification_kind = 'morning_summary' then
      project_payload := private.project_morning_summary(target_family, target_user, (input->'payload'->>'date')::date);
      if coalesce(jsonb_array_length(input->'payload'->'eventIds'), 0) = 0 and project_payload is null
        then return 'null'::jsonb; end if;
      project_payload := (input->'payload' - 'projectDeadlineTitle' - 'projectCount')
        || coalesce(project_payload, '{}');
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
      values (target_user, target_family, notification_kind, coalesce(project_payload, input->'payload'))
      returning id into notification_id;
    insert into private.notification_schedule_log(dedupe_key, notification_id) values (dedupe, notification_id);
    return to_jsonb(notification_id);
  elsif operation = 'claim_push' then
    -- Refresh project content at claim time and retain successful device claims on retries.
    with candidates as (
      select n.id, case
        when n.kind = 'morning_summary' then
          (n.payload - 'projectDeadlineTitle' - 'projectCount') || coalesce(
            private.project_morning_summary(n.family_id, n.user_id, (n.payload->>'date')::date), '{}')
        when d.id is not null then n.payload || jsonb_build_object(
          'projectTitle', d."projectTitle", 'projectDeadlineTitle', d.title)
        else n.payload
      end as payload
      from public.notifications n join public.users u on u.id = n.user_id
      left join lateral (
        select d.id, d."projectTitle", d.title
        from private.project_deadlines(n.family_id, (n.payload->>'date')::date, (n.payload->>'date')::date) d
        where n.kind in ('project_task_due', 'project_decision_due', 'project_reservation_due')
          and d.id = (n.payload->>'projectItemId')::uuid and d.kind = n.payload->>'deadlineKind'
          and private.project_deadline_recipient(d.kind, d."assigneeKind", d."assigneeId", n.user_id)
      ) d on true
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
        and (n.kind not in ('project_task_due', 'project_decision_due', 'project_reservation_due')
          or d.id is not null)
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
      'kind', n.kind, 'payload', candidate.payload, 'read_at', n.read_at, 'created_at', n.created_at,
      'subscriptions', (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', s.keys))
        from public.push_subscriptions s join claimed c
          on c.notification_id = n.id and c.endpoint = s.endpoint
        where s.user_id = n.user_id)
    )), '[]') into result
      from candidates candidate join public.notifications n on n.id = candidate.id
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

commit;
