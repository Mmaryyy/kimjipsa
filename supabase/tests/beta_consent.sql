-- ACC-02 SCN-ACC-1: run only on a local database; all fixtures roll back.
begin;
do $$
declare
  caller uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  original_time timestamptz := '2026-10-16T00:00:00Z';
  accepted_time timestamptz;
begin
  insert into auth.users(id) values (caller), (other_user);
  insert into auth.identities(user_id, provider, provider_id, identity_data)
    values (caller, 'google', caller::text, jsonb_build_object('sub', caller::text));
  insert into public.users(id, provider, provider_user_id, display_name,
    terms_accepted_at, privacy_accepted_at, terms_version)
    values (caller, 'google', caller::text, '동의전', original_time, original_time, 'draft-2026-10-16'),
      (other_user, 'google', other_user::text, '다른사람', original_time, original_time, 'draft-2026-10-16');
  perform set_config('request.jwt.claim.sub', caller::text, true);
  set local role authenticated;
  begin
    perform public.complete_profile('동의전', false, true);
    raise exception 'SCN-ACC-1: consent was not required';
  exception when raise_exception then
    if sqlerrm <> 'consent_required' then raise; end if;
  end;
  perform public.complete_profile('이름만', false, false);
  reset role;
  if not exists(select 1 from public.users where id = caller
    and display_name = '이름만' and terms_version = 'draft-2026-10-16'
    and terms_accepted_at = original_time) then
    raise exception 'SCN-ACC-1: name edit renewed consent';
  end if;
  set local role authenticated;
  perform public.complete_profile('동의후', true, true);
  reset role;
  select terms_accepted_at into accepted_time from public.users where id = caller;
  if not exists(select 1 from public.users where id = caller
    and terms_version = 'beta-2026-11-11'
    and terms_accepted_at > original_time and privacy_accepted_at = terms_accepted_at) then
    raise exception 'SCN-ACC-1: consent was not renewed';
  end if;
  set local role authenticated;
  perform public.complete_profile('이름수정', false, false);
  reset role;
  if not exists(select 1 from public.users where id = caller
    and display_name = '이름수정' and terms_accepted_at = accepted_time
    and privacy_accepted_at = accepted_time) then
    raise exception 'SCN-ACC-1: profile edit changed consent';
  end if;
  if not exists(select 1 from public.users where id = other_user
    and terms_version = 'draft-2026-10-16' and terms_accepted_at = original_time) then
    raise exception 'SCN-ACC-1: another user was changed';
  end if;
  -- Emulate the nullable legacy schema without changing a fresh database contract.
  alter table public.users
    alter column terms_accepted_at drop not null,
    alter column privacy_accepted_at drop not null,
    alter column terms_version drop not null;
  update public.users set terms_accepted_at = null, privacy_accepted_at = null,
    terms_version = null where id = caller;
  set local role authenticated;
  perform public.complete_profile('기존회원', true, true);
  reset role;
  if not exists(select 1 from public.users where id = caller
    and terms_version = 'beta-2026-11-11' and terms_accepted_at is not null
    and privacy_accepted_at = terms_accepted_at) then
    raise exception 'SCN-ACC-1: legacy consent was not recorded';
  end if;
end;
$$;
rollback;
