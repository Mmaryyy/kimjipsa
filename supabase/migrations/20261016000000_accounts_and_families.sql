-- P2: ACC-01~07. All writes go through authenticated, atomic RPCs.
create schema if not exists private;
revoke all on schema private from public;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('kakao', 'google')),
  provider_user_id text not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 6),
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  terms_version text not null,
  unique (provider, provider_user_id)
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 10)
);

create table public.memberships (
  user_id uuid primary key references public.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null check (role in ('admin', 'member', 'child'))
);
create index memberships_family_id_idx on public.memberships(family_id);

create table public.invites (
  token uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references public.users(id),
  expires_at timestamptz not null default (now() + interval '3 days'),
  accepted_by uuid references public.users(id),
  accepted_at timestamptz,
  check ((accepted_by is null) = (accepted_at is null))
);
create index invites_family_id_idx on public.invites(family_id);

alter table public.users enable row level security;
alter table public.families enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
revoke all on public.users, public.families, public.memberships, public.invites
  from public, anon, authenticated;
grant select on public.users, public.families, public.memberships, public.invites to authenticated;

-- Definer avoids recursive membership RLS; the caller cannot choose another user.
create function private.current_family_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select family_id from public.memberships where user_id = auth.uid() $$;
create function private.is_family_admin(target_family uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.memberships
  where user_id = auth.uid() and family_id = target_family and role = 'admin') $$;
revoke all on function private.current_family_id(), private.is_family_admin(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.current_family_id(), private.is_family_admin(uuid) to authenticated;

create policy users_read_self on public.users for select to authenticated using (id = auth.uid());
create policy families_read_own on public.families for select to authenticated
  using (id = private.current_family_id());
create policy memberships_read_own_family on public.memberships for select to authenticated
  using (family_id = private.current_family_id());
create policy invites_read_admin on public.invites for select to authenticated
  using (private.is_family_admin(family_id));

create function public.complete_profile(display_name text, terms_accepted boolean, privacy_accepted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  identity_provider text;
  identity_id text;
  identity_count integer;
begin
  if caller is null then
    raise exception 'unauthorized';
  end if;
  if display_name is null or length(btrim(display_name)) = 0 then
    raise exception 'display_name_required';
  end if;
  if length(btrim(display_name)) > 6 then
    raise exception 'display_name_too_long';
  end if;
  if terms_accepted is distinct from true or privacy_accepted is distinct from true then
    raise exception 'consent_required';
  end if;
  -- Never silently accept auto-linked identities or a Kakao email (ADR-0009).
  select count(*) into identity_count from auth.identities where user_id = caller;
  select provider, provider_id into identity_provider, identity_id
    from auth.identities where user_id = caller limit 1;
  if identity_count <> 1 or identity_provider not in ('kakao', 'google') then
    raise exception 'identity_policy_violation';
  end if;
  if identity_provider = 'kakao' and exists(
    select 1 from auth.users where id = caller and nullif(email, '') is not null
  ) then
    raise exception 'identity_policy_violation';
  end if;
  -- The server-owned version identifies the current P2 legal drafts.
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values (caller, identity_provider, identity_id, btrim(display_name),
      now(), now(), 'draft-2026-10-16')
    on conflict (id) do update set display_name = excluded.display_name;
end;
$$;

create function public.create_family(family_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  family uuid;
begin
  if caller is null then
    raise exception 'unauthorized';
  end if;
  -- Serializes create/join for the same user, including requests using different invites.
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  if not exists(select 1 from public.users where id = caller) then
    raise exception 'profile_required';
  end if;
  if exists(select 1 from public.memberships where user_id = caller) then
    raise exception 'already_in_family';
  end if;
  if family_name is null or length(btrim(family_name)) = 0 then
    raise exception 'family_name_required';
  end if;
  if length(btrim(family_name)) > 10 then
    raise exception 'family_name_too_long';
  end if;
  insert into public.families(name) values (btrim(family_name)) returning id into family;
  insert into public.memberships(user_id, family_id, role) values (caller, family, 'admin');
  -- P3 owns event categories and seeds its first category from families.name.
  return family;
end;
$$;

create function public.create_invite() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family uuid;
  invitation public.invites;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  select family_id into family from public.memberships where user_id = auth.uid() and role = 'admin';
  if family is null then
    raise exception 'forbidden';
  end if;
  insert into public.invites(family_id, created_by) values (family, auth.uid()) returning * into invitation;
  return jsonb_build_object('token', invitation.token, 'expires_at', invitation.expires_at);
end;
$$;

-- Possession of the unguessable token reveals only status and the valid invitation's family name.
create function public.preview_invite(invite_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  invitation public.invites;
begin
  select * into invitation from public.invites where token = invite_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if invitation.accepted_by is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object('status', 'valid', 'familyName',
    (select name from public.families where id = invitation.family_id));
end;
$$;

create function public.accept_invite(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  invitation public.invites;
begin
  if caller is null then
    raise exception 'unauthorized';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  if not exists(select 1 from public.users where id = caller) then
    raise exception 'profile_required';
  end if;
  if exists(select 1 from public.memberships where user_id = caller) then
    raise exception 'already_in_family';
  end if;
  select * into invitation from public.invites where token = invite_token for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if invitation.accepted_by is not null then
    raise exception 'invite_used';
  end if;
  if invitation.expires_at <= clock_timestamp() then
    raise exception 'invite_expired';
  end if;
  insert into public.memberships(user_id, family_id, role) values (caller, invitation.family_id, 'admin');
  update public.invites set accepted_by = caller, accepted_at = now() where token = invite_token;
  return invitation.family_id;
end;
$$;

create function public.family_members() returns table(user_id uuid, display_name text, role text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.display_name, m.role from public.memberships m
    join public.users u on u.id = m.user_id
    where m.family_id = private.current_family_id()
$$;

revoke all on function public.complete_profile(text, boolean, boolean), public.create_family(text),
  public.create_invite(), public.preview_invite(uuid), public.accept_invite(uuid), public.family_members()
  from public, anon, authenticated;
grant execute on function public.complete_profile(text, boolean, boolean), public.create_family(text),
  public.create_invite(), public.accept_invite(uuid), public.family_members() to authenticated;
grant execute on function public.preview_invite(uuid) to anon, authenticated;
