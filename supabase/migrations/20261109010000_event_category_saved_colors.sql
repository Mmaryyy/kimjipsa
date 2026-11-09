create table public.event_category_saved_colors (
  family_id uuid not null references public.families(id) on delete cascade,
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  saved_at timestamptz not null default clock_timestamp(),
  primary key (family_id, color)
);
alter table public.event_category_saved_colors enable row level security;
revoke all on public.event_category_saved_colors from public, anon, authenticated;
grant select on public.event_category_saved_colors to authenticated;
create policy saved_category_colors_read on public.event_category_saved_colors
  for select to authenticated using (family_id = (select private.current_family_id()));

create function private.remember_event_category_color() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.color ~ '^#[0-9a-f]{6}$' then
    insert into public.event_category_saved_colors(family_id, color, saved_at)
      values (new.family_id, new.color, clock_timestamp())
      on conflict (family_id, color) do update set saved_at = excluded.saved_at;
  end if;
  return new;
end;
$$;
revoke all on function private.remember_event_category_color() from public, anon, authenticated;
create trigger remember_event_category_color
  after insert or update of color on public.event_categories
  for each row execute function private.remember_event_category_color();

insert into public.event_category_saved_colors(family_id, color)
  select distinct family_id, color from public.event_categories where color ~ '^#[0-9a-f]{6}$';
