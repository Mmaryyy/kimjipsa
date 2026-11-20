-- PJ3: PRJ-05, PRJ-08, PRJ-09, PRJ-11.
create table public.project_decisions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  question text not null check (length(btrim(question)) between 1 and 100),
  status text not null check (status in ('discussing', 'decided', 'on_hold')),
  due_on date,
  options text not null check (length(options) <= 1000),
  final_choice text not null check (length(final_choice) <= 1000),
  unique (id, family_id),
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade
);

create table public.project_decision_opinions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  decision_id uuid not null,
  user_id uuid references public.users(id) on delete set null,
  opinion text not null check (length(opinion) between 1 and 1000),
  unique (decision_id, family_id, user_id),
  foreign key (decision_id, family_id) references public.project_decisions(id, family_id) on delete cascade
);

create function private.valid_project_links(links text[]) returns boolean
language sql immutable set search_path = '' as $$
  select not exists (
    select from unnest(links) as link
    where link is null or length(link) > 2048 or link !~* '^https?://[^/[:space:]]+[^[:space:]]*$'
  );
$$;

create table public.project_reservations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  area_id uuid,
  title text not null check (length(btrim(title)) between 1 and 100),
  kind text not null check (kind in ('lodging', 'transport', 'restaurant', 'activity', 'other')),
  status text not null check (status in ('reviewing', 'planned', 'booked', 'cancelled')),
  starts_on date,
  ends_on date,
  reference_no text not null check (length(reference_no) <= 100),
  links text[] not null check (private.valid_project_links(links)),
  cancel_deadline date,
  payment_deadline date,
  total_amount numeric check (total_amount between 0 and 9007199254740991),
  paid_amount numeric check (paid_amount between 0 and total_amount),
  memo text not null check (length(memo) <= 1000),
  event_id uuid,
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade,
  foreign key (area_id, project_id, family_id)
    references public.project_areas(id, project_id, family_id) on delete set null (area_id),
  foreign key (event_id, family_id) references public.events(id, family_id) on delete set null (event_id),
  check (ends_on is null or (starts_on is not null and ends_on >= starts_on)),
  check (paid_amount is null or total_amount is not null)
);

create table public.project_itinerary (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  starts_on date not null,
  ends_on date,
  place text not null check (length(place) <= 1000),
  title text not null check (length(btrim(title)) between 1 and 100),
  links text[] not null check (private.valid_project_links(links)),
  memo text not null check (length(memo) <= 1000),
  event_id uuid,
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade,
  foreign key (event_id, family_id) references public.events(id, family_id) on delete set null (event_id),
  check (ends_on >= starts_on)
);

create index project_decisions_family_project_idx on public.project_decisions(family_id, project_id);
create index project_decision_opinions_family_idx on public.project_decision_opinions(family_id, id);
create index project_decision_opinions_user_idx on public.project_decision_opinions(user_id);
create index project_reservations_family_project_idx on public.project_reservations(family_id, project_id);
create index project_reservations_event_idx on public.project_reservations(event_id) where event_id is not null;
create index project_itinerary_family_project_idx on public.project_itinerary(family_id, project_id);
create index project_itinerary_event_idx on public.project_itinerary(event_id) where event_id is not null;

alter table public.project_decisions enable row level security;
alter table public.project_decision_opinions enable row level security;
alter table public.project_reservations enable row level security;
alter table public.project_itinerary enable row level security;
revoke all on public.project_decisions, public.project_decision_opinions,
  public.project_reservations, public.project_itinerary from public, anon, authenticated;
grant select on public.project_decisions, public.project_decision_opinions,
  public.project_reservations, public.project_itinerary to authenticated;

create policy project_decisions_read_family on public.project_decisions for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_decision_opinions_read_family on public.project_decision_opinions for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_reservations_read_family on public.project_reservations for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy project_itinerary_read_family on public.project_itinerary for select to authenticated
  using (family_id = (select private.current_family_id()));

alter publication supabase_realtime add table
  public.project_decisions, public.project_decision_opinions, public.project_reservations, public.project_itinerary;

create or replace function private.unlink_private_project_milestones() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.project_milestones set event_id = null where event_id = new.id and family_id = new.family_id;
  update public.project_reservations set event_id = null where event_id = new.id and family_id = new.family_id;
  update public.project_itinerary set event_id = null where event_id = new.id and family_id = new.family_id;
  return new;
end;
$$;

create function public.write_project_module(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  family uuid := private.current_family_id();
  action text := payload->>'action';
  item jsonb := payload->'item';
  parent_id uuid;
  target_id uuid;
  module text;
  result_id uuid;
  field text;
  decision public.project_decisions;
  reservation public.project_reservations;
  stop public.project_itinerary;
  member_opinion public.project_decision_opinions;
  opinion_item jsonb;
  linked_id uuid;
  event_title text;
  event_place text;
  event_memo text;
  event_start date;
  event_end date;
  category_id uuid;
begin
  if caller is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not exists (select from public.memberships where user_id = caller and family_id = family)
    then raise exception 'family_required'; end if;

  parent_id := (payload->>'projectId')::uuid;
  target_id := (payload->>'id')::uuid;
  module := case action
    when 'save_decision' then 'decisions'
    when 'delete_decision' then 'decisions'
    when 'save_reservation' then 'reservations'
    when 'delete_reservation' then 'reservations'
    when 'save_itinerary' then 'itinerary'
    when 'delete_itinerary' then 'itinerary'
    when 'add_project_event' then payload->>'source'
  end;
  if module is null or module not in ('decisions', 'reservations', 'itinerary', 'milestones')
    then raise exception 'invalid_project'; end if;
  if not exists (
    select from public.projects where id = parent_id and family_id = family
      and (module = 'milestones' or module = any(modules))
  ) then raise exception 'project_not_found'; end if;

  if action in ('save_decision', 'save_reservation', 'save_itinerary') then
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'invalid_project'; end if;
    foreach field in array (case action
      when 'save_decision' then array['question', 'status', 'options', 'final_choice']
      when 'save_reservation' then array['title', 'kind', 'status', 'reference_no', 'memo']
      else array['title', 'place', 'memo']
    end) loop
      if jsonb_typeof(item->field) is distinct from 'string' then raise exception 'invalid_project'; end if;
    end loop;
    if action <> 'save_decision' then
      if jsonb_typeof(item->'links') is distinct from 'array' then raise exception 'invalid_project'; end if;
      if exists (select from jsonb_array_elements(item->'links') as link where jsonb_typeof(link) <> 'string')
        then raise exception 'invalid_project'; end if;
    end if;
    foreach field in array array['due_on', 'starts_on', 'ends_on', 'cancel_deadline', 'payment_deadline'] loop
      if item->>field is not null and (
        jsonb_typeof(item->field) <> 'string' or item->>field !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      ) then raise exception 'invalid_project'; end if;
    end loop;
  end if;

  case action
    when 'save_decision' then
      decision := jsonb_populate_record(null::public.project_decisions, item);
      if target_id is null then
        insert into public.project_decisions (family_id, project_id, question, status, due_on, options, final_choice)
          values (family, parent_id, btrim(decision.question), decision.status, decision.due_on,
            decision.options, decision.final_choice) returning id into result_id;
      else
        update public.project_decisions set question = btrim(decision.question), status = decision.status,
          due_on = decision.due_on, options = decision.options, final_choice = decision.final_choice
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
      end if;
      if result_id is null then raise exception 'project_not_found'; end if;
      if jsonb_typeof(item->'opinions') is distinct from 'array' then raise exception 'invalid_project'; end if;
      for opinion_item in select value from jsonb_array_elements(item->'opinions') loop
        if jsonb_typeof(opinion_item->'opinion') is distinct from 'string'
          or length(opinion_item->>'opinion') > 1000
          or jsonb_typeof(opinion_item->'user_id') is distinct from 'string'
          then raise exception 'invalid_project'; end if;
        member_opinion := jsonb_populate_record(null::public.project_decision_opinions, opinion_item);
        if not exists (
          select from public.memberships where family_id = family and user_id = member_opinion.user_id
        ) then raise exception 'invalid_project'; end if;
        if btrim(member_opinion.opinion) = '' then
          delete from public.project_decision_opinions
            where family_id = family and decision_id = result_id and user_id = member_opinion.user_id;
        else
          insert into public.project_decision_opinions (family_id, decision_id, user_id, opinion)
            values (family, result_id, member_opinion.user_id, btrim(member_opinion.opinion))
            on conflict (decision_id, family_id, user_id) do update set opinion = excluded.opinion;
        end if;
      end loop;
    when 'delete_decision' then
      delete from public.project_decisions where id = target_id and project_id = parent_id and family_id = family
        returning id into result_id;
    when 'save_reservation' then
      foreach field in array array['total_amount', 'paid_amount'] loop
        if item->>field is not null and jsonb_typeof(item->field) <> 'number'
          then raise exception 'invalid_project'; end if;
      end loop;
      reservation := jsonb_populate_record(null::public.project_reservations, item);
      if target_id is null then
        insert into public.project_reservations (family_id, project_id, area_id, title, kind, status, starts_on,
          ends_on, reference_no, links, cancel_deadline, payment_deadline, total_amount, paid_amount, memo)
          values (family, parent_id, reservation.area_id, btrim(reservation.title), reservation.kind,
            reservation.status, reservation.starts_on, reservation.ends_on, reservation.reference_no,
            reservation.links, reservation.cancel_deadline, reservation.payment_deadline, reservation.total_amount,
            reservation.paid_amount, reservation.memo) returning id into result_id;
      else
        update public.project_reservations set area_id = reservation.area_id, title = btrim(reservation.title),
          kind = reservation.kind, status = reservation.status, starts_on = reservation.starts_on,
          ends_on = reservation.ends_on, reference_no = reservation.reference_no, links = reservation.links,
          cancel_deadline = reservation.cancel_deadline, payment_deadline = reservation.payment_deadline,
          total_amount = reservation.total_amount, paid_amount = reservation.paid_amount, memo = reservation.memo
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
      end if;
    when 'delete_reservation' then
      delete from public.project_reservations where id = target_id and project_id = parent_id and family_id = family
        returning id into result_id;
    when 'save_itinerary' then
      stop := jsonb_populate_record(null::public.project_itinerary, item);
      if target_id is null then
        insert into public.project_itinerary (family_id, project_id, starts_on, ends_on, place, title, links, memo)
          values (family, parent_id, stop.starts_on, stop.ends_on, stop.place, btrim(stop.title), stop.links, stop.memo)
          returning id into result_id;
      else
        update public.project_itinerary set starts_on = stop.starts_on, ends_on = stop.ends_on,
          place = stop.place, title = btrim(stop.title), links = stop.links, memo = stop.memo
          where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
      end if;
    when 'delete_itinerary' then
      delete from public.project_itinerary where id = target_id and project_id = parent_id and family_id = family
        returning id into result_id;
    when 'add_project_event' then
      -- Match account withdrawal's lock order and serialize with schedule visibility/deletion.
      perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
      case module
        when 'milestones' then
          select title, memo, starts_on, ends_on, event_id into event_title, event_memo, event_start, event_end, linked_id
            from public.project_milestones where id = target_id and project_id = parent_id and family_id = family;
        when 'reservations' then
          select title, memo, starts_on, ends_on, event_id into event_title, event_memo, event_start, event_end, linked_id
            from public.project_reservations where id = target_id and project_id = parent_id and family_id = family;
        when 'itinerary' then
          select title, memo, place, starts_on, ends_on, event_id
            into event_title, event_memo, event_place, event_start, event_end, linked_id
            from public.project_itinerary where id = target_id and project_id = parent_id and family_id = family;
        else raise exception 'invalid_project';
      end case;
      if event_title is null then raise exception 'project_not_found'; end if;
      if linked_id is not null then return target_id; end if;
      if event_start is null then raise exception 'invalid_project'; end if;
      select id into category_id from public.event_categories where family_id = family and name = '기타';
      linked_id := public.save_event(null, event_title, coalesce(event_place, ''), event_memo, category_id,
        'shared', event_start, coalesce(event_end, event_start), null, null, true);
      case module
        when 'milestones' then
          update public.project_milestones set event_id = linked_id
            where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
        when 'reservations' then
          update public.project_reservations set event_id = linked_id
            where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
        when 'itinerary' then
          update public.project_itinerary set event_id = linked_id
            where id = target_id and project_id = parent_id and family_id = family returning id into result_id;
      end case;
    else raise exception 'invalid_project';
  end case;
  if result_id is null then raise exception 'project_not_found'; end if;
  return result_id;
exception
  when data_exception or foreign_key_violation or check_violation or not_null_violation then
    raise exception 'invalid_project';
end;
$$;
revoke all on function public.write_project_module(jsonb) from public, anon, authenticated;
grant execute on function public.write_project_module(jsonb) to authenticated;
