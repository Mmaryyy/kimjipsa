-- P5b: CAL-09..11, ACC-11. Extensions are enabled by the operator first.
create table public.push_subscriptions (
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text primary key check (length(endpoint) <= 2048 and endpoint ~
    ('^https://(' ||
      'fcm[.]googleapis[.]com|android[.]googleapis[.]com|' ||
      'updates[.]push[.]services[.]mozilla[.]com|' ||
      '([a-z0-9-]+[.])+push[.]apple[.]com|' ||
      '([a-z0-9-]+[.])+notify[.]windows[.]com)/')),
  keys jsonb not null check (jsonb_typeof(keys) = 'object' and keys ? 'p256dh' and keys ? 'auth'
    and jsonb_typeof(keys->'p256dh') = 'string' and jsonb_typeof(keys->'auth') = 'string'
    and keys->>'p256dh' ~ '^[A-Za-z0-9_-]{87}=?$'
    and keys->>'auth' ~ '^[A-Za-z0-9_-]{22}={0,2}$'),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy push_subscriptions_self on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('event_created', 'event_updated', 'event_deleted', 'event_reminder', 'morning_summary')
);
create table private.notification_schedule_log (
  dedupe_key text primary key,
  notification_id uuid unique not null references public.notifications(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table private.notification_push_log (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now(),
  primary key (notification_id, endpoint)
);
revoke all on private.notification_schedule_log, private.notification_push_log from public, anon, authenticated;

-- No general service-role credential is needed by the application. Only this
-- narrowly scoped worker API accepts the Vault secret, never a browser session.
create function public.notification_worker(worker_secret text, operation text, input jsonb default '{}')
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
        'title', d.title, 'startTime', e.start_time, 'isAllDay', e.is_all_day, 'remindBefore', d.remind_before
      )) from public.events e join public.event_details d on d.event_id = e.id
        where e.kind = 'dday' or (e.end_date >= ((now() - interval '5 minutes') at time zone 'Asia/Seoul')::date
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
      if not found then return 'null'::jsonb; end if;
    elsif notification_kind = 'morning_summary' then
      if exists (
        select 1 from jsonb_array_elements_text(input->'payload'->'eventIds') item
        where not exists(select 1 from public.events e where e.id = item::uuid
          and e.family_id = target_family and (e.visibility = 'shared' or e.owner_id = target_user))
      ) then return 'null'::jsonb; end if;
    else raise exception 'invalid_kind'; end if;
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
            and (e.visibility = 'shared' or e.owner_id = n.user_id)))
        and (n.kind <> 'morning_summary' or not exists(
          select 1 from jsonb_array_elements_text(n.payload->'eventIds') item
          where not exists(select 1 from public.events e where e.id = item::uuid
            and e.family_id = n.family_id and (e.visibility = 'shared' or e.owner_id = n.user_id))))
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
revoke all on function public.notification_worker(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.notification_worker(text, text, jsonb) to anon;

-- Vault app_url is the deployed application origin, set by the operator.
select cron.schedule('kimjipsa-notifications', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/notifications',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$job$);
