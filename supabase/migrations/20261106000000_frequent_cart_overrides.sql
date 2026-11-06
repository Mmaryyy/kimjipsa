-- CART-05: values only; the ranked purchase list is still calculated.
create table public.frequent_cart_overrides (
  family_id uuid not null references public.families(id) on delete cascade,
  normalized_name text not null check (char_length(normalized_name) between 1 and 100
    and normalized_name = private.normalize_cart_name(normalized_name)),
  category_id uuid references public.inventory_categories(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  memo text not null default '' check (char_length(memo) <= 1000),
  link_url text not null default '' check (link_url = '' or link_url ~ '^https?://[^[:space:]]+$'),
  hidden boolean not null default false,
  primary key (family_id, normalized_name)
);
alter table public.frequent_cart_overrides enable row level security;
create policy frequent_cart_overrides_read on public.frequent_cart_overrides
  for select to authenticated using (family_id = private.current_family_id());
revoke all on public.frequent_cart_overrides from public, anon, authenticated;
grant select on public.frequent_cart_overrides to authenticated;

create function public.save_frequent_cart_override(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  normalized text := private.normalize_cart_name(payload->>'name');
  category uuid := (payload->>'category_id')::uuid;
  unit uuid := (payload->>'unit_id')::uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  if normalized is null or char_length(normalized) not between 1 and 100
    or char_length(coalesce(payload->>'memo','')) > 1000
    or (coalesce(payload->>'link_url','') <> '' and payload->>'link_url' !~ '^https?://[^[:space:]]+$')
    or (category is not null and not exists (
      select 1 from public.inventory_categories where id=category and family_id=family))
    or (unit is not null and not exists (
      select 1 from public.units where id=unit and family_id=family))
    or jsonb_typeof(payload->'hidden') is distinct from 'boolean'
  then raise exception 'invalid_cart'; end if;
  insert into public.frequent_cart_overrides(family_id, normalized_name, category_id, unit_id, memo, link_url, hidden)
    values(family, normalized, category, unit, coalesce(payload->>'memo',''),
      coalesce(payload->>'link_url',''), (payload->>'hidden')::boolean)
    on conflict(family_id, normalized_name) do update set
      category_id=excluded.category_id, unit_id=excluded.unit_id, memo=excluded.memo,
      link_url=excluded.link_url, hidden=excluded.hidden;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.save_frequent_cart_override(jsonb) from public, anon;
grant execute on function public.save_frequent_cart_override(jsonb) to authenticated;

-- Keep all candidates so hidden entries can be replaced before applying the UI limit.
create or replace function public.frequent_cart_items() returns setof public.cart_items
language sql stable security invoker set search_path = '' as $$
  with purchases as (
    select c.*, private.normalize_cart_name(c.name) as normalized_name
    from public.cart_items c where c.purchased_at is not null
  ), ranked as (
    select id, count(*) over (partition by normalized_name) as purchases,
      count(*) filter (where purchased_at >= now() - interval '90 days')
        over (partition by normalized_name) as recent_purchases,
      row_number() over (partition by normalized_name order by purchased_at desc, created_at desc, id) as position
    from purchases
  )
  select c.* from ranked r join public.cart_items c on c.id = r.id
    where r.position = 1 and r.purchases >= 2
    order by r.recent_purchases desc, c.name collate "C", c.id
$$;

alter publication supabase_realtime add table public.frequent_cart_overrides;
