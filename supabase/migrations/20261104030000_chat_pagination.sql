-- BOT-01/10/11: newest-first pages, with the same household/private visibility.
begin;

create index chat_messages_shared_sequence
  on public.chat_messages(family_id, sequence desc) where visibility='shared';
create index chat_messages_private_sequence
  on public.chat_messages(family_id, viewer_id, sequence desc) where visibility='private';
create index agent_runs_input_message on public.agent_runs(input_message_id);

create function public.chat_page(input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  family uuid := private.current_family_id();
  viewer uuid := auth.uid();
  scope text := coalesce(input->>'visibility','shared');
  before_sequence bigint := (input->>'before')::bigint;
  assistant_name text;
  result jsonb;
begin
  if viewer is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  if scope not in ('shared','private') or before_sequence <= 0 or before_sequence > 9007199254740991
    then raise exception 'invalid_chat'; end if;
  select name into assistant_name from private.ai_settings where family_id=family;
  assistant_name := coalesce(assistant_name,'집사');

  with candidates as materialized (
    select m.* from public.chat_messages m
    where m.family_id=family and m.visibility=scope and (scope='shared' or m.viewer_id=viewer)
      and (before_sequence is null or m.sequence<before_sequence)
    order by m.sequence desc limit 51
  ), page as materialized (
    select * from candidates order by sequence desc limit 50
  ), page_runs as materialized (
    select r.* from public.agent_runs r join page m on m.id=r.input_message_id
    where r.family_id=family and r.kind='chat'
  )
  select jsonb_build_object(
    'familyId',family,'name',assistant_name,
    'workerOnline',exists(select 1 from public.agent_workers
      where family_id=family and enabled and last_seen_at>now()-interval '2 minutes'),
    'nextBefore',case when (select count(*) from candidates)>50 then (select min(sequence) from page) else null end,
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'sequence',m.sequence,'role',m.role,'text',m.text,'attachment_ids',m.attachment_ids,
      'created_at',m.created_at,'visibility',m.visibility,'sources',m.sources,
      'author',case when m.role='assistant' then '김'||assistant_name else coalesce(u.display_name,'탈퇴한 사용자') end
    ) order by m.sequence) from page m left join public.users u on u.id=m.author_id),'[]'),
    'runs',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'input_message_id',r.input_message_id,'status',r.status,
      'progress',r.progress,'version',r.version,'error_code',r.error_code
    )) from page_runs r),'[]'),
    'receipts',coalesce((select jsonb_agg(to_jsonb(r)) from public.receipt_imports r
      join page_runs j on j.id=r.run_id where r.family_id=family),'[]'),
    'proposals',coalesce((select jsonb_agg(to_jsonb(p)) from public.agent_proposals p
      join page_runs j on j.id=p.run_id where p.family_id=family),'[]'),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'expires_at',a.expires_at,'status',a.status))
      from public.chat_attachments a where a.family_id=family and a.visibility=scope
        and (scope='shared' or a.uploaded_by=viewer)
        and exists(select 1 from page m where a.id=any(m.attachment_ids))),'[]')
  ) into result;
  return result;
end $$;

revoke all on function public.chat_page(jsonb) from public, anon;
grant execute on function public.chat_page(jsonb) to authenticated;
commit;
