-- CART-01: a private, requester-scoped queue separate from chat and household memory.
begin;
create table private.cart_category_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  categories jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  category_id uuid references public.inventory_categories(id) on delete set null,
  item_id uuid references public.cart_items(id) on delete cascade,
  worker_id uuid references public.agent_workers(id) on delete set null,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now()
);
revoke all on private.cart_category_requests from public, anon, authenticated;
alter table private.cart_category_requests enable row level security;
create index cart_category_pending on private.cart_category_requests(family_id, created_at)
  where status='queued';

-- Cancel even if the user changes the category and later puts it back.
create function private.cancel_cart_category_suggestion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.category_id is distinct from old.category_id or new.name is distinct from old.name
    or new.purchased_at is distinct from old.purchased_at then
    update private.cart_category_requests set item_id=null
      where item_id=old.id;
  end if;
  return new;
end $$;
create trigger cancel_cart_category_suggestion after update on public.cart_items
  for each row execute function private.cancel_cart_category_suggestion();
revoke all on function private.cancel_cart_category_suggestion() from public, anon, authenticated;

create function public.cart_category_command(operation text, input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  family uuid;
  actor uuid:=auth.uid();
  worker public.agent_workers;
  job private.cart_category_requests;
  category uuid;
  categories jsonb;
  result jsonb;
  payload jsonb;
  online boolean;
  target uuid:=(input->>'id')::uuid;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if operation in ('claim','complete','fail') then
    select * into worker from public.agent_workers where id=actor and enabled;
    if not found then raise exception 'forbidden'; end if;
    family:=worker.family_id;
  else
    family:=private.current_family_id();
    if family is null then raise exception 'family_required'; end if;
  end if;
  if operation='status' then
    select * into job from private.cart_category_requests where id=target and family_id=family and actor_id=actor;
    if not found then raise exception 'forbidden'; end if;
    return jsonb_build_object('id',job.id,'categoryId',job.category_id,'pending',job.status in ('queued','running'));
  end if;
  -- Same lock as write_cart, including category edits and checkout.
  perform pg_advisory_xact_lock(hashtextextended(family::text,6));
  delete from private.cart_category_requests where family_id=family
    and status in ('completed','failed') and created_at<now()-interval '1 hour';

  if operation='prepare' then
    if input->>'name' is null or char_length(input->>'name') not between 1 and 100
      or private.normalize_cart_name(input->>'name')='' then raise exception 'invalid_cart'; end if;
    select c.category_id into category from public.cart_items c
      where c.family_id=family and c.purchased_at is null
        and private.normalize_cart_name(c.name)=private.normalize_cart_name(input->>'name')
      order by c.created_at,c.id limit 1;
    if found then
      return jsonb_build_object('id',null,'categoryId',category,'pending',false);
    end if;
    select i.category_id into category from public.inventory_items i
      join public.inventory_categories c on c.id=i.category_id and c.family_id=family
      where i.family_id=family and private.normalize_cart_name(i.name)=private.normalize_cart_name(input->>'name')
      order by i.id limit 1;
    if category is null then
      select c.category_id into category from public.cart_items c
        join public.inventory_categories k on k.id=c.category_id and k.family_id=family
        where c.family_id=family and c.purchased_at is not null
          and private.normalize_cart_name(c.name)=private.normalize_cart_name(input->>'name')
        order by c.purchased_at desc,c.created_at desc,c.id limit 1;
    end if;
    if category is not null then
      return jsonb_build_object('id',null,'categoryId',category,'pending',false);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order,id),'[]')
      into categories from public.inventory_categories where family_id=family;
    select exists(select 1 from public.agent_workers where family_id=family and enabled
      and last_seen_at>now()-interval '2 minutes') into online;
    insert into private.cart_category_requests(family_id,actor_id,name,categories)
      values(family,actor,input->>'name',categories) returning * into job;
    return jsonb_build_object('id',job.id,'categoryId',null,'pending',online);
  elsif operation='claim' then
    update public.agent_workers set last_seen_at=now() where id=actor;
    update private.cart_category_requests set status='failed',lease_token=null
      where family_id=family and ((status='running' and lease_until<=now())
        or (status='queued' and created_at<=now()-interval '5 minutes'));
    select * into job from private.cart_category_requests where family_id=family and status='queued'
      and item_id is not null
      order by created_at,id limit 1 for update;
    if not found then return 'null'; end if;
    update private.cart_category_requests set status='running',worker_id=actor,
      lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds'
      where id=job.id returning * into job;
    return jsonb_build_object('id',job.id,'leaseToken',job.lease_token,'name',job.name,
      'categories',(select jsonb_agg(value->>'name') from jsonb_array_elements(job.categories)));
  elsif operation in ('complete','fail') then
    select * into job from private.cart_category_requests where id=target and family_id=family
      and worker_id=actor and status='running' and lease_token=(input->>'leaseToken')::uuid
      and lease_until>now() for update;
    if not found then raise exception 'lease_lost'; end if;
    if operation='complete' then
      select (value->>'id')::uuid into category from jsonb_array_elements(job.categories)
        where value->>'name'=input->>'category' limit 1;
      if not exists(select 1 from public.inventory_categories where id=category and family_id=family)
        then category:=null; end if;
    end if;
    update private.cart_category_requests set status=case when category is null then 'failed' else 'completed' end,
      category_id=category,lease_token=null where id=job.id;
    if category is not null and job.item_id is not null then
      update public.cart_items set category_id=category where id=job.item_id and family_id=family
        and purchased_at is null;
    end if;
    return '{}';
  elsif operation='add' then
    payload:=input->'command';
    if payload->>'action' is distinct from 'add' then raise exception 'invalid_cart'; end if;
    if target is not null then
      select * into job from private.cart_category_requests where id=target and family_id=family
        and actor_id=actor for update;
      if not found or job.item_id is not null or job.name is distinct from payload->'item'->>'name'
        then raise exception 'invalid_cart'; end if;
      category:=job.category_id;
    else
      -- A matched category is revalidated against this family rather than trusted from the client.
      category:=(input->>'categoryId')::uuid;
    end if;
    if not exists(select 1 from public.inventory_categories where id=category and family_id=family) then
      select id into category from public.inventory_categories where family_id=family and name='기타';
    end if;
    payload:=jsonb_set(payload,'{item,category_id}',coalesce(to_jsonb(category),'null'));
    result:=public.write_cart(payload);
    if target is not null then
      if result->'item'->>'id' is not null then
        update private.cart_category_requests set item_id=(result->'item'->>'id')::uuid where id=target;
        perform private.agent_notice(family,'job.ready','{"changed":true}');
      else
        delete from private.cart_category_requests where id=target;
      end if;
    end if;
    return result;
  end if;
  raise exception 'invalid_cart';
end $$;
revoke all on function public.cart_category_command(text,jsonb) from public, anon;
grant execute on function public.cart_category_command(text,jsonb) to authenticated;
commit;
