-- P8: ACC-15 / SCN-ACC-6. Caller-scoped, atomic account withdrawal.
alter table public.invites alter column created_by drop not null;
alter table public.invites drop constraint invites_created_by_fkey;
alter table public.invites add constraint invites_created_by_fkey
  foreign key (created_by) references public.users(id) on delete set null;
alter table public.invites drop constraint invites_accepted_by_fkey;
alter table public.invites add constraint invites_accepted_by_fkey
  foreign key (accepted_by) references public.users(id) on delete set null;
-- A used invite stays used after its recipient withdraws.
alter table public.invites drop constraint invites_check;
alter table public.invites add constraint invites_check
  check (accepted_by is null or accepted_at is not null);
alter table public.events drop constraint events_owner_id_fkey;
alter table public.events add constraint events_owner_id_fkey
  foreign key (owner_id) references public.users(id) on delete set null;
alter table public.cart_items drop constraint cart_items_added_by_fkey;
alter table public.cart_items add constraint cart_items_added_by_fkey
  foreign key (added_by) references public.users(id) on delete set null;
alter table public.cart_items drop constraint cart_items_checked_by_fkey;
alter table public.cart_items add constraint cart_items_checked_by_fkey
  foreign key (checked_by) references public.users(id) on delete set null;

create function public.change_member_role(member_id uuid, member_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target_role text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not private.is_family_admin(family) then raise exception 'role_forbidden'; end if;
  if member_role is null or member_role not in ('admin', 'member', 'child')
    then raise exception 'invalid_role'; end if;
  select role into target_role from public.memberships
    where user_id = member_id and family_id = family;
  if not found then raise exception 'member_not_found'; end if;
  if target_role = 'admin' and member_id <> auth.uid()
    then raise exception 'role_forbidden'; end if;
  if target_role = 'admin' and member_role <> 'admin' and not exists (
    select 1 from public.memberships where family_id = family and role = 'admin' and user_id <> auth.uid()
  ) then raise exception 'last_admin'; end if;
  update public.memberships set role = member_role where user_id = member_id and family_id = family;
end;
$$;

create function public.withdraw_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  family uuid;
begin
  if caller is null then raise exception 'unauthorized'; end if;
  -- Same per-user lock as create/join; no caller ID can be supplied by a client.
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  select family_id into family from public.memberships where user_id = caller;
  if family is not null then
    perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
    perform pg_advisory_xact_lock(hashtextextended(family::text, 3));
    perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
    if exists(select 1 from public.memberships where family_id = family and user_id <> caller)
      and not exists(select 1 from public.memberships
        where family_id = family and user_id <> caller and role = 'admin')
      then raise exception 'last_admin'; end if;
  end if;
  delete from public.events where owner_id = caller and visibility = 'private';
  delete from public.invites where created_by = caller and accepted_at is null;
  delete from public.memberships where user_id = caller;
  if family is not null and not exists(select 1 from public.memberships where family_id = family) then
    -- Delete cart first because unit references use RESTRICT.
    delete from public.cart_items where family_id = family;
    delete from public.inventory_items where family_id = family;
    delete from public.families where id = family;
  end if;
  -- Cascades remove profile, push subscriptions, notifications and auth sessions.
  -- Shared event/cart author FKs become null. Conversations/memories belong to P13.
  delete from auth.users where id = caller;
end;
$$;
revoke all on function public.change_member_role(uuid, text), public.withdraw_account()
  from public, anon, authenticated;
grant execute on function public.change_member_role(uuid, text), public.withdraw_account() to authenticated;

create or replace function public.create_invite() returns jsonb
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
  perform pg_advisory_xact_lock(hashtextextended(family::text, 8));
  if not private.is_family_admin(family) then raise exception 'forbidden'; end if;
  insert into public.invites(family_id, created_by) values (family, auth.uid()) returning * into invitation;
  return jsonb_build_object('token', invitation.token, 'expires_at', invitation.expires_at);
end;
$$;

create or replace function public.preview_invite(invite_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  invitation public.invites;
begin
  select * into invitation from public.invites where token = invite_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if invitation.accepted_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object('status', 'valid', 'familyName',
    (select name from public.families where id = invitation.family_id));
end;
$$;

create or replace function public.accept_invite(invite_token uuid) returns uuid
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
  -- Lock the family before the invite, matching withdrawal and role changes.
  select * into invitation from public.invites where token = invite_token;
  if not found then raise exception 'invite_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(invitation.family_id::text, 8));
  select * into invitation from public.invites where token = invite_token for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if invitation.accepted_at is not null then
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

