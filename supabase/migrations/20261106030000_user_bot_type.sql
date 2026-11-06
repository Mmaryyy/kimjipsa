-- BOT-18: personal appearance preferences never use household visibility.
create table public.user_bot_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  bot_type text not null default 'butler' check (bot_type in ('butler', 'nobi'))
);
alter table public.user_bot_settings enable row level security;
revoke all on public.user_bot_settings from anon, authenticated;
grant select, insert, update on public.user_bot_settings to authenticated;
create policy user_bot_settings_self on public.user_bot_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
