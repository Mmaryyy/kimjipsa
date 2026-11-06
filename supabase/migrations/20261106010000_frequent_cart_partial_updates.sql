-- CART-05: null means no value override; omitted fields keep the saved value.
alter table public.frequent_cart_overrides
  alter column memo drop not null,
  alter column memo drop default,
  alter column link_url drop not null,
  alter column link_url drop default;

create or replace function public.save_frequent_cart_override(payload jsonb)
returns jsonb
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
    or (coalesce(payload->>'link_url','') <> ''
      and payload->>'link_url' !~ '^https?://[^[:space:]]+$')
    or (category is not null and not exists (
      select 1 from public.inventory_categories where id=category and family_id=family))
    or (unit is not null and not exists (
      select 1 from public.units where id=unit and family_id=family))
    or jsonb_typeof(payload->'hidden') is distinct from 'boolean'
  then raise exception 'invalid_cart'; end if;
  insert into public.frequent_cart_overrides(
    family_id, normalized_name, category_id, unit_id, memo, link_url, hidden
  )
    values(family, normalized, category, unit, payload->>'memo',
      payload->>'link_url', (payload->>'hidden')::boolean)
    on conflict(family_id, normalized_name) do update set
      category_id=case when payload ? 'category_id' then excluded.category_id
        else frequent_cart_overrides.category_id end,
      unit_id=case when payload ? 'unit_id' then excluded.unit_id
        else frequent_cart_overrides.unit_id end,
      memo=case when payload ? 'memo' then excluded.memo
        else frequent_cart_overrides.memo end,
      link_url=case when payload ? 'link_url' then excluded.link_url
        else frequent_cart_overrides.link_url end,
      hidden=excluded.hidden;
  return '{}'::jsonb;
end;
$$;

alter publication supabase_realtime add table public.units;
