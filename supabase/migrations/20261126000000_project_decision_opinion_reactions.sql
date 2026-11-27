-- PRJ-05 / g205: members can react to another member's opinion.
alter table public.project_decision_opinions add unique (id, family_id);

create table public.project_decision_opinion_reactions (
  family_id uuid not null references public.families(id) on delete cascade,
  opinion_id uuid not null,
  user_id uuid not null references public.memberships(user_id) on delete cascade,
  reaction text not null check (reaction in ('up', 'down')),
  primary key (opinion_id, user_id),
  constraint project_opinion_reactions_opinion_family_fkey foreign key (opinion_id, family_id)
    references public.project_decision_opinions(id, family_id) on delete cascade
);

create index project_opinion_reactions_user_idx on public.project_decision_opinion_reactions(user_id);

alter table public.project_decision_opinion_reactions enable row level security;
revoke all on public.project_decision_opinion_reactions from public, anon, authenticated;
grant select on public.project_decision_opinion_reactions to authenticated;
create policy project_opinion_reactions_read_family on public.project_decision_opinion_reactions
  for select to authenticated using (family_id = (select private.current_family_id()));

alter publication supabase_realtime add table public.project_decision_opinion_reactions;

create function private.clear_withdrawn_opinion_reactions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.project_decision_opinion_reactions
    where opinion_id = new.id and family_id = new.family_id;
  return new;
end;
$$;

revoke all on function private.clear_withdrawn_opinion_reactions() from public, anon, authenticated;

create trigger clear_withdrawn_opinion_reactions
  after update of user_id on public.project_decision_opinions
  for each row when (old.user_id is not null and new.user_id is null)
  execute function private.clear_withdrawn_opinion_reactions();

create function public.write_project_decision_opinion(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  family uuid := private.current_family_id();
  action text := payload->>'action';
  decision_id_input uuid := (payload->>'id')::uuid;
  project_id_input uuid := (payload->>'projectId')::uuid;
  opinion_id_input uuid;
  opinion_text text;
  reaction_value text;
begin
  if caller is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  -- Serialize with the module writer and account withdrawal.
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not exists (select from public.memberships where user_id = caller and family_id = family)
    then raise exception 'family_required'; end if;

  if not exists (
    select from public.project_decisions d
    join public.projects p on (p.id, p.family_id) = (d.project_id, d.family_id)
    where d.id = decision_id_input and p.id = project_id_input and d.family_id = family
      and 'decisions' = any(p.modules)
  ) then raise exception 'project_not_found'; end if;

  case action
    when 'save_decision_opinion' then
      if jsonb_typeof(payload->'item'->'opinion') is distinct from 'string'
        then raise exception 'invalid_project'; end if;
      opinion_text := btrim(payload->'item'->>'opinion');
      if length(opinion_text) > 1000 then raise exception 'invalid_project'; end if;
      if opinion_text = '' then
        delete from public.project_decision_opinions
          where family_id = family and decision_id = decision_id_input and user_id = caller;
      else
        insert into public.project_decision_opinions (family_id, decision_id, user_id, opinion)
          values (family, decision_id_input, caller, opinion_text)
          on conflict (decision_id, family_id, user_id) do update set opinion = excluded.opinion;
      end if;
    when 'set_decision_opinion_reaction' then
      opinion_id_input := (payload->>'opinionId')::uuid;
      reaction_value := payload->>'reaction';
      if not (payload ? 'reaction') or (reaction_value is not null and reaction_value not in ('up', 'down'))
        then raise exception 'invalid_project'; end if;
      if not exists (
        select from public.project_decision_opinions o
        join public.memberships m on (m.user_id, m.family_id) = (o.user_id, o.family_id)
        where o.id = opinion_id_input and o.decision_id = decision_id_input and o.family_id = family
          and o.user_id <> caller
      ) then raise exception 'invalid_project'; end if;
      if reaction_value is null then
        delete from public.project_decision_opinion_reactions
          where family_id = family and opinion_id = opinion_id_input and user_id = caller;
      else
        insert into public.project_decision_opinion_reactions (family_id, opinion_id, user_id, reaction)
          values (family, opinion_id_input, caller, reaction_value)
          on conflict (opinion_id, user_id) do update set reaction = excluded.reaction;
      end if;
    else raise exception 'invalid_project';
  end case;
  return decision_id_input;
end;
$$;

revoke all on function public.write_project_decision_opinion(jsonb) from public, anon, authenticated;
grant execute on function public.write_project_decision_opinion(jsonb) to authenticated;
