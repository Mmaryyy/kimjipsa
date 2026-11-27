-- PJ7: nullable provenance for the one-time wedd import.
alter table public.projects
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_areas
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_milestones
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_tasks
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_decisions
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_decision_opinions
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_lists
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_list_items
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_reservations
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_itinerary
  add column source_ref text, add unique (family_id, source_ref);
alter table public.project_expenses
  add column source_ref text, add unique (family_id, source_ref);
