-- BOT-06/10/12/13: read-only household skill, bound to a registered worker.
begin;
create function public.agent_read(input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare worker public.agent_workers; resource text:=input->>'resource'; settings private.ai_settings;
begin
  select * into worker from public.agent_workers where id=auth.uid() and enabled;
  if not found then raise exception 'forbidden'; end if;
  if resource='memories' then
    select * into settings from private.ai_settings where family_id=worker.family_id;
    return jsonb_build_object('enabled',coalesce(settings.memory_enabled,true),'memories',
      case when settings.memory_enabled is false then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('id',id,'text',text,'version',version) order by id)
        from public.family_memories where family_id=worker.family_id),'[]'::jsonb) end);
  elsif resource='inventory' then
    return jsonb_build_object(
      'items',coalesce((select jsonb_agg(i order by i.name,i.id) from public.inventory_items i where family_id=worker.family_id),'[]'),
      'units',coalesce((select jsonb_agg(u) from public.units u where family_id=worker.family_id),'[]'),
      'categories',coalesce((select jsonb_agg(c) from public.inventory_categories c where family_id=worker.family_id),'[]'),
      'locations',coalesce((select jsonb_agg(l) from public.locations l where family_id=worker.family_id and enabled),'[]'));
  elsif resource='cart' then
    return jsonb_build_object(
      'items',coalesce((select jsonb_agg(c order by c.created_at,c.id) from public.cart_items c where family_id=worker.family_id and purchased_at is null),'[]'),
      'units',coalesce((select jsonb_agg(u) from public.units u where family_id=worker.family_id),'[]'));
  elsif resource='calendar' then
    return private.agent_calendar_context(worker.family_id,null,'shared');
  end if;
  raise exception 'invalid_chat';
end $$;
revoke all on function public.agent_read(jsonb) from public, anon;
grant execute on function public.agent_read(jsonb) to authenticated;
commit;
