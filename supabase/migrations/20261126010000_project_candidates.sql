-- PRJ-06 / g205: one recipient assignment per list and one vote per member.
alter table public.project_list_items add unique (id, list_id, family_id);

create table public.project_candidate_recipients (
  family_id uuid not null references public.families(id) on delete cascade,
  list_id uuid not null,
  candidate_id uuid not null,
  person_id uuid not null,
  primary key (list_id, person_id),
  constraint project_candidate_recipients_candidate_fkey foreign key (candidate_id, list_id, family_id)
    references public.project_list_items(id, list_id, family_id) on delete cascade,
  constraint project_candidate_recipients_person_fkey foreign key (person_id, family_id)
    references public.project_list_items(id, family_id) on delete cascade
);

create table public.project_candidate_votes (
  family_id uuid not null references public.families(id) on delete cascade,
  candidate_id uuid not null,
  user_id uuid not null,
  vote text not null check (vote in ('up', 'down')),
  primary key (candidate_id, user_id),
  constraint project_candidate_votes_candidate_fkey foreign key (candidate_id, family_id)
    references public.project_list_items(id, family_id) on delete cascade,
  foreign key (user_id, family_id) references public.memberships(user_id, family_id) on delete cascade
);

create index project_candidate_recipients_candidate_idx on public.project_candidate_recipients(candidate_id);
create index project_candidate_recipients_person_idx on public.project_candidate_recipients(person_id);
create index project_candidate_votes_member_idx on public.project_candidate_votes(user_id, family_id);

alter table public.project_candidate_recipients enable row level security;
alter table public.project_candidate_votes enable row level security;
revoke all on public.project_candidate_recipients, public.project_candidate_votes from public, anon, authenticated;
grant select on public.project_candidate_recipients, public.project_candidate_votes to authenticated;
create policy project_candidate_recipients_read on public.project_candidate_recipients
  for select to authenticated using (family_id = (select private.current_family_id()));
create policy project_candidate_votes_read on public.project_candidate_votes
  for select to authenticated using (family_id = (select private.current_family_id()));
alter publication supabase_realtime add table public.project_candidate_recipients, public.project_candidate_votes;

create function private.clear_ineligible_project_recipients() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'project_lists' then
    delete from public.project_candidate_recipients r
      where r.list_id = new.id and r.family_id = new.family_id
        and not exists (
          select from public.project_list_items p where p.id = r.person_id
            and p.family_id = r.family_id and p.list_id = new.quantity_list_id
            and new.quantity_tag_key::text = any(p.tags)
        );
  else
    delete from public.project_candidate_recipients r using public.project_lists l
      where r.person_id = new.id and r.family_id = new.family_id
        and (l.id, l.family_id) = (r.list_id, r.family_id)
        and not coalesce(l.quantity_tag_key::text = any(new.tags), false);
  end if;
  return new;
end;
$$;

revoke all on function private.clear_ineligible_project_recipients() from public, anon, authenticated;
create trigger clear_project_recipients_on_source_change
  after update of quantity_list_id, quantity_tag_key on public.project_lists
  for each row when (
    old.quantity_list_id is distinct from new.quantity_list_id
    or old.quantity_tag_key is distinct from new.quantity_tag_key
  ) execute function private.clear_ineligible_project_recipients();
create trigger clear_project_recipients_on_tag_change
  after update of tags on public.project_list_items
  for each row when (old.tags is distinct from new.tags)
  execute function private.clear_ineligible_project_recipients();

create function public.write_project_candidate(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  family uuid := private.current_family_id();
  operation text := payload->>'action';
  project_id_input uuid := (payload->>'projectId')::uuid;
  list_id_input uuid := (payload->>'listId')::uuid;
  target uuid := (payload->>'id')::uuid;
  person uuid;
  candidate_status text;
  vote_value text;
  candidate_list public.project_lists;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  -- Use the same lock as list writes and account withdrawal.
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not exists (select from public.memberships where user_id = actor and family_id = family)
    then raise exception 'family_required'; end if;

  select l.* into candidate_list from public.project_lists l
    join public.projects p on (p.id, p.family_id) = (l.project_id, l.family_id)
    where l.id = list_id_input and l.family_id = family and l.kind = 'candidates'
      and p.id = project_id_input and 'lists' = any(p.modules);
  if not found then raise exception 'project_not_found'; end if;

  if target is not null then
    select i.status into candidate_status from public.project_list_items i
      where i.id = target and i.list_id = list_id_input and i.family_id = family;
    if not found then raise exception 'project_not_found'; end if;
  end if;
  if operation = 'save_list_item' then
    if jsonb_typeof(payload->'item') is distinct from 'object' then raise exception 'invalid_project'; end if;
    return public.write_project_list(jsonb_set(
      payload, '{item,status}', to_jsonb(coalesce(candidate_status, 'candidate'))
    ));
  end if;
  if target is null then raise exception 'project_not_found'; end if;

  case operation
    when 'set_candidate_recipient' then
      person := (payload->>'personId')::uuid;
      if jsonb_typeof(payload->'assigned') is distinct from 'boolean' or not exists (
        select from public.project_list_items p where p.id = person
          and p.family_id = family and p.list_id = candidate_list.quantity_list_id
          and candidate_list.quantity_tag_key::text = any(p.tags)
      ) then raise exception 'invalid_project'; end if;
      if (payload->>'assigned')::boolean then
        insert into public.project_candidate_recipients (family_id, list_id, candidate_id, person_id)
          values (family, list_id_input, target, person)
          on conflict (list_id, person_id) do update set candidate_id = excluded.candidate_id;
      else
        delete from public.project_candidate_recipients
          where family_id = family and list_id = list_id_input and candidate_id = target and person_id = person;
      end if;
    when 'set_candidate_vote' then
      vote_value := payload->>'vote';
      if not (payload ? 'vote') or (vote_value is not null and vote_value not in ('up', 'down'))
        then raise exception 'invalid_project'; end if;
      if vote_value is null then
        delete from public.project_candidate_votes
          where family_id = family and candidate_id = target and user_id = actor;
      else
        insert into public.project_candidate_votes (family_id, candidate_id, user_id, vote)
          values (family, target, actor, vote_value)
          on conflict (candidate_id, user_id) do update set vote = excluded.vote;
      end if;
    when 'set_candidate_status' then
      candidate_status := payload->>'status';
      if candidate_status is null or candidate_status not in ('candidate', 'selected', 'excluded')
        then raise exception 'invalid_project'; end if;
      update public.project_list_items set status = candidate_status
        where id = target and list_id = list_id_input and family_id = family;
    else raise exception 'invalid_project';
  end case;
  return target;
end;
$$;

revoke all on function public.write_project_candidate(jsonb) from public, anon, authenticated;
grant execute on function public.write_project_candidate(jsonb) to authenticated;
