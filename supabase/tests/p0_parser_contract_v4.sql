\set ON_ERROR_STOP on

begin;

do $$
declare
  v_invalid jsonb := '{
    "parser_contract_version":"v4",
    "validation":{"status":"invalid","issues":[{"code":"invalid_wall_thickness","severity":"error","field":"thickness_mm"}]}
  }'::jsonb;
  v_low jsonb := '{
    "parser_contract_version":"v4",
    "validation":{"status":"review_required","issues":[{"code":"low_confidence","severity":"warning","field":"confidence"}]}
  }'::jsonb;
  v_trigger_count integer;
  v_observation_max bigint;
  v_observation_sequence bigint;
  v_review_max bigint;
  v_review_sequence bigint;
begin
  if public.parser_v4_primary_review_reason(v_invalid) <> 'invalid_wall_thickness' then
    raise exception 'P0.6 did not expose invalid_wall_thickness as primary review reason';
  end if;

  if public.parser_v4_review_severity(v_invalid) <> 'error' then
    raise exception 'P0.6 did not preserve error severity';
  end if;

  if public.parser_v4_primary_review_reason(v_low) <> 'low_confidence' then
    raise exception 'P0.6 did not expose low_confidence as primary review reason';
  end if;

  if public.parser_v4_review_severity(v_low) <> 'warning' then
    raise exception 'P0.6 did not preserve warning severity';
  end if;

  if public.parser_v4_primary_review_reason('{"parser_contract_version":"v3.1"}'::jsonb) is not null then
    raise exception 'P0.6 taxonomy helper must ignore non-v4 metadata';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and n.nspname = 'public'
    and (
      (c.relname = 'commercial_observations' and t.tgname = 'commercial_observations_parser_v4_provenance')
      or (c.relname = 'commercial_review_queue' and t.tgname = 'commercial_review_queue_parser_v4_taxonomy')
    );

  if v_trigger_count <> 2 then
    raise exception 'Expected two P0.6 parser v4 triggers, found %', v_trigger_count;
  end if;

  select coalesce(max(id), 0) into v_observation_max
  from public.commercial_observations;
  select last_value into v_observation_sequence
  from public.commercial_observations_id_seq;

  if v_observation_max > 0 and v_observation_sequence < v_observation_max then
    raise exception 'commercial_observations sequence drift: last_value %, max(id) %',
      v_observation_sequence, v_observation_max;
  end if;

  select coalesce(max(id), 0) into v_review_max
  from public.commercial_review_queue;
  select last_value into v_review_sequence
  from public.commercial_review_queue_id_seq;

  if v_review_max > 0 and v_review_sequence < v_review_max then
    raise exception 'commercial_review_queue sequence drift: last_value %, max(id) %',
      v_review_sequence, v_review_max;
  end if;
end;
$$;

rollback;
