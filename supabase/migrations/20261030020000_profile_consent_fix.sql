-- P10 ACC-02: renew consent through the caller-owned profile RPC.
create or replace function public.complete_profile(
  display_name text,
  terms_accepted boolean,
  privacy_accepted boolean
)
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
  if not (terms_accepted is false and privacy_accepted is false) and
    (terms_accepted is distinct from true or privacy_accepted is distinct from true) then
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
  if terms_accepted is false and privacy_accepted is false then
    update public.users set display_name = btrim(complete_profile.display_name)
      where id = caller;
    if not found then raise exception 'consent_required'; end if;
    return;
  end if;
  -- Keep the version in sync with src/shared/config/legal.constants.ts (covered by a test).
  -- Only a new version renews consent; display-name edits retain its timestamps.
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values (caller, identity_provider, identity_id, btrim(display_name),
      now(), now(), 'beta-2026-10-30')
    on conflict (id) do update set
      display_name = excluded.display_name,
      terms_accepted_at = case
        when public.users.terms_version is distinct from excluded.terms_version
        then excluded.terms_accepted_at else public.users.terms_accepted_at end,
      privacy_accepted_at = case
        when public.users.terms_version is distinct from excluded.terms_version
        then excluded.privacy_accepted_at else public.users.privacy_accepted_at end,
      terms_version = excluded.terms_version;
end;
$$;

revoke all on function public.complete_profile(text, boolean, boolean) from public, anon;
grant execute on function public.complete_profile(text, boolean, boolean) to authenticated;
