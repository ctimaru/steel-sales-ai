-- P1.11 — Harden parser v4 review taxonomy trigger execution.
--
-- commercial_review_queue can be inserted through authenticated flows, but the
-- parser-v4 taxonomy trigger must read worker_staging_observations, which remains
-- intentionally unavailable to browser roles. Keep that staging table private
-- and elevate only this trigger function's internal lookup.

create or replace function public.apply_parser_v4_review_taxonomy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_metadata jsonb;
  v_reason text;
  v_severity text;
begin
  if new.observation_id is null then
    return new;
  end if;

  select s.metadata into v_metadata
  from public.commercial_observations o
  join public.worker_staging_observations s
    on s.id = o.source_extraction_id
  where o.id = new.observation_id;

  v_reason := public.parser_v4_primary_review_reason(v_metadata);
  v_severity := public.parser_v4_review_severity(v_metadata);

  if v_reason is not null then
    new.reason := v_reason;
    new.severity := coalesce(v_severity, 'warning');
  end if;

  return new;
end;
$$;

revoke execute on function public.apply_parser_v4_review_taxonomy()
  from public, anon, authenticated;

grant execute on function public.apply_parser_v4_review_taxonomy()
  to service_role;

comment on function public.apply_parser_v4_review_taxonomy() is
  'P0.6/P1.11 internal trigger: applies parser-v4 review taxonomy while keeping worker staging unavailable to browser roles.';
