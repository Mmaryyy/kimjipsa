-- PJ5: PRJ-10.
create unique index memberships_user_family_idx on public.memberships(user_id, family_id);

create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  project_id uuid not null,
  area_id uuid,
  title text not null check (length(btrim(title)) between 1 and 100),
  estimated_amount numeric check (
    estimated_amount between 0 and 9007199254740991 and estimated_amount = trunc(estimated_amount)
  ),
  planned_on date,
  actual_amount numeric check (
    actual_amount between 0 and 9007199254740991 and actual_amount = trunc(actual_amount)
  ),
  paid_on date,
  payer_id uuid,
  links text[] not null check (private.valid_project_links(links)),
  memo text not null check (length(memo) <= 1000),
  foreign key (project_id, family_id) references public.projects(id, family_id) on delete cascade,
  foreign key (area_id, project_id, family_id)
    references public.project_areas(id, project_id, family_id) on delete set null (area_id),
  foreign key (payer_id, family_id)
    references public.memberships(user_id, family_id) on delete set null (payer_id),
  check (actual_amount is null or paid_on is not null)
);

create index project_expenses_family_project_idx on public.project_expenses(family_id, project_id);
create index project_expenses_payer_idx on public.project_expenses(payer_id) where payer_id is not null;

alter table public.project_expenses enable row level security;
revoke all on public.project_expenses from public, anon, authenticated;
grant select on public.project_expenses to authenticated;

create policy project_expenses_read_family on public.project_expenses for select to authenticated
  using (family_id = (select private.current_family_id()));

alter publication supabase_realtime add table public.project_expenses;

create function public.write_project_budget(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  family uuid := private.current_family_id();
  action text := payload->>'action';
  item jsonb := payload->'item';
  parent_id uuid;
  target_id uuid;
  expense public.project_expenses;
  previous public.project_expenses;
  expense_id uuid;
  cap jsonb := payload->'budget_limit';
  cap_amount numeric;
  field text;
begin
  if caller is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not exists (select from public.memberships where user_id = caller and family_id = family)
    then raise exception 'family_required'; end if;

  parent_id := (payload->>'projectId')::uuid;
  target_id := (payload->>'id')::uuid;
  if not exists (
    select from public.projects where id = parent_id and family_id = family and 'budget' = any(modules)
  ) then raise exception 'project_not_found'; end if;

  if cap is not null then
    if action not in ('save_expense', 'set_budget_limit') or jsonb_typeof(cap) not in ('null', 'number')
      then raise exception 'invalid_project'; end if;
    cap_amount := (payload->>'budget_limit')::numeric;
    if cap_amount < 0 or cap_amount > 9007199254740991 or cap_amount <> trunc(cap_amount)
      then raise exception 'invalid_project'; end if;
    update public.projects set budget_limit = cap_amount where id = parent_id and family_id = family;
  end if;

  case action
    when 'set_budget_limit' then
      if cap is null then raise exception 'invalid_project'; end if;
      return parent_id;
    when 'save_expense' then
      if jsonb_typeof(item) is distinct from 'object' then raise exception 'invalid_project'; end if;
      foreach field in array array['title', 'memo'] loop
        if jsonb_typeof(item->field) is distinct from 'string' then raise exception 'invalid_project'; end if;
      end loop;
      foreach field in array array['estimated_amount', 'actual_amount'] loop
        if item->>field is not null and jsonb_typeof(item->field) <> 'number'
          then raise exception 'invalid_project'; end if;
      end loop;
      foreach field in array array['planned_on', 'paid_on'] loop
        if item->>field is not null and (
          jsonb_typeof(item->field) <> 'string' or item->>field !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        ) then raise exception 'invalid_project'; end if;
      end loop;
      if jsonb_typeof(item->'links') is distinct from 'array' then raise exception 'invalid_project'; end if;
      if exists (select from jsonb_array_elements(item->'links') as link where jsonb_typeof(link) <> 'string')
        then raise exception 'invalid_project'; end if;
      expense := jsonb_populate_record(null::public.project_expenses, item);
      if expense.actual_amount is not null and expense.paid_on is null
        then raise exception 'invalid_project'; end if;
      if expense.actual_amount is not null and expense.payer_id is null then
        if target_id is null then raise exception 'invalid_project'; end if;
        select * into previous from public.project_expenses
          where id = target_id and project_id = parent_id and family_id = family for update;
        if not found then raise exception 'project_not_found'; end if;
        if previous.actual_amount is null or previous.payer_id is not null
          then raise exception 'invalid_project'; end if;
      end if;

      if target_id is null then
        insert into public.project_expenses (family_id, project_id, area_id, title, estimated_amount,
          planned_on, actual_amount, paid_on, payer_id, links, memo)
          values (family, parent_id, expense.area_id, btrim(expense.title), expense.estimated_amount,
            expense.planned_on, expense.actual_amount, expense.paid_on, expense.payer_id,
            expense.links, expense.memo) returning id into expense_id;
      else
        update public.project_expenses set area_id = expense.area_id, title = btrim(expense.title),
          estimated_amount = expense.estimated_amount, planned_on = expense.planned_on,
          actual_amount = expense.actual_amount, paid_on = expense.paid_on, payer_id = expense.payer_id,
          links = expense.links, memo = expense.memo
          where id = target_id and project_id = parent_id and family_id = family returning id into expense_id;
      end if;
    when 'delete_expense' then
      delete from public.project_expenses where id = target_id and project_id = parent_id and family_id = family
        returning id into expense_id;
    else raise exception 'invalid_project';
  end case;

  if expense_id is null then raise exception 'project_not_found'; end if;
  return expense_id;
exception
  when data_exception or integrity_constraint_violation then raise exception 'invalid_project';
end;
$$;
revoke all on function public.write_project_budget(jsonb) from public, anon, authenticated;
grant execute on function public.write_project_budget(jsonb) to authenticated;

alter table public.users add column amount_format text not null default 'won'
  check (amount_format in ('won', 'number', 'korean', 'symbol'));

create function public.save_amount_format(amount_format text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if amount_format is null or amount_format not in ('won', 'number', 'korean', 'symbol')
    then raise exception 'invalid_amount_format'; end if;
  update public.users set amount_format = save_amount_format.amount_format where id = auth.uid();
  if not found then raise exception 'unauthorized'; end if;
end;
$$;
revoke all on function public.save_amount_format(text) from public, anon, authenticated;
grant execute on function public.save_amount_format(text) to authenticated;
