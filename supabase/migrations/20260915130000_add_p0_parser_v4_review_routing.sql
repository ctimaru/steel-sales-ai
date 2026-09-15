-- P0.6 — Parser contract v4 review routing.
--
-- The existing promote_worker_job flow remains the source of truth. Parser v4
-- stores its confidence/validation contract in worker_staging_observations.metadata.
-- These triggers preserve promotion compatibility while exposing v4 provenance
-- and precise review reasons in the commercial layer.

create or replace function public.parser_v4_primary_review_reason(p_metadata jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when coalesce(p_metadata ->> 'parser_contract_version', '') <> 'v4' then null
    when jsonb_typeof(p_metadata #> '{validation,issues}') <> 'array' then null
    when jsonb_array_length(p_metadata #> '{validation,issues}') = 0 then null
    else nullif(p_metadata #>> '{validation,issues,0,code}', '')
  end
$$;

create or replace function public.parser_v4_review_severity(p_metadata jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when public.parser_v4_primary_review_reason(p_metadata) is null then null
    when p_metadata #>> '{validation,issues,0,severity}' = 'error' then 'error'
    else 'warning'
  end
$$;

create or replace function public.apply_parser_v4_observation_provenance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_metadata jsonb;
begin
  if new.source_extraction_id is null then
    return new;
  end if;

  select s.metadata into v_metadata
  from public.worker_staging_observations s
  where s.id = new.source_extraction_id;

  if coalesce(v_metadata ->> 'parser_contract_version', '') = 'v4' then
    new.role_method := 'worker_v4';
  end if;

  return new;
end;
$$;

create or replace function public.apply_parser_v4_review_taxonomy()
returns trigger
language plpgsql
security invoker
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

drop trigger if exists commercial_observations_parser_v4_provenance
  on public.commercial_observations;
create trigger commercial_observations_parser_v4_provenance
before insert on public.commercial_observations
for each row
execute function public.apply_parser_v4_observation_provenance();

drop trigger if exists commercial_review_queue_parser_v4_taxonomy
  on public.commercial_review_queue;
create trigger commercial_review_queue_parser_v4_taxonomy
before insert on public.commercial_review_queue
for each row
execute function public.apply_parser_v4_review_taxonomy();

revoke execute on function public.parser_v4_primary_review_reason(jsonb) from public, anon, authenticated;
revoke execute on function public.parser_v4_review_severity(jsonb) from public, anon, authenticated;
revoke execute on function public.apply_parser_v4_observation_provenance() from public, anon, authenticated;
revoke execute on function public.apply_parser_v4_review_taxonomy() from public, anon, authenticated;

grant execute on function public.parser_v4_primary_review_reason(jsonb) to service_role;
grant execute on function public.parser_v4_review_severity(jsonb) to service_role;
grant execute on function public.apply_parser_v4_observation_provenance() to service_role;
grant execute on function public.apply_parser_v4_review_taxonomy() to service_role;

comment on function public.parser_v4_primary_review_reason(jsonb) is
  'P0.6 extracts the primary machine-readable parser v4 validation issue code for review routing.';
comment on function public.apply_parser_v4_observation_provenance() is
  'P0.6 marks promoted worker observations with role_method=worker_v4 when staging metadata declares parser contract v4.';
comment on function public.apply_parser_v4_review_taxonomy() is
  'P0.6 replaces generic low-confidence review reasons with parser v4 validation taxonomy and severity.';
