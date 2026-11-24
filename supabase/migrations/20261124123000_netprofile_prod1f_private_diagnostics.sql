-- NET-PROFILE-PROD1.F — quantitative producer evidence diagnostics.
-- Append a strictly bounded JSON counter object to the existing private
-- completion event. No public profile data is changed; no raw HTML is stored.
alter table private.network_profile_producer_activity_events
  add column if not exists diagnostics jsonb;

comment on column private.network_profile_producer_activity_events.diagnostics
  is 'Internal counts only: HTML pages, editorial blocks, relation matches/rejections, aggregate discard reason. No raw website content.';

create or replace function public.netprofile_prod1f_record_diagnostics(
  p_company_id uuid,
  p_diagnostics jsonb
) returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_key text;
  v_fields text[] := array[
    'html_pages','editorial_blocks','sentence_segments',
    'pages_without_editorial','product_verb_segments','working_verb_segments',
    'product_relation_segments','working_relation_segments',
    'rejected_product_segments','rejected_working_segments','fetch_failures'
  ];
  v_reason text;
  v_event bigint;
begin
  if p_company_id is null or p_diagnostics is null or
     jsonb_typeof(p_diagnostics)<>'object' or
     (select count(*) from jsonb_object_keys(p_diagnostics))<>12
  then
    raise exception 'Invalid private activity diagnostics' using errcode='22023';
  end if;
  for v_key in select jsonb_array_elements_text(to_jsonb(v_fields)) loop
    if jsonb_typeof(p_diagnostics->v_key)<>'number'
       or coalesce(p_diagnostics->>v_key,'') !~ '^[0-9]{1,4}$'
       or (p_diagnostics->>v_key)::integer > 3000
    then
      raise exception 'Invalid numeric activity diagnostic: %',v_key
        using errcode='22023';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_object_keys(p_diagnostics) as entry(key)
    where entry.key <> 'reason_bucket' and entry.key <> all(v_fields)
  ) or (p_diagnostics->>'html_pages')::integer > 5
     or (p_diagnostics->>'editorial_blocks')::integer > 750
     or (p_diagnostics->>'pages_without_editorial')::integer >
        (p_diagnostics->>'html_pages')::integer
     or (p_diagnostics->>'product_relation_segments')::integer >
        (p_diagnostics->>'product_verb_segments')::integer
     or (p_diagnostics->>'working_relation_segments')::integer >
        (p_diagnostics->>'working_verb_segments')::integer
  then
    raise exception 'Inconsistent private activity metrics' using errcode='22023';
  end if;
  v_reason := p_diagnostics->>'reason_bucket';
  if v_reason not in (
    'identity_mismatch','source_unavailable','no_editorial_blocks',
    'no_explicit_verbs','rejected_or_unclassified_relation',
    'already_known_or_policy_excluded','accepted'
  ) or v_reason is null then
    raise exception 'Unrecognized activity diagnostic reason' using errcode='22023';
  end if;

  -- The main completion RPC has already committed. Attach counters to its
  -- latest recent event only; reject replays and cross-company updates.
  select e.id into v_event
  from private.network_profile_producer_activity_events e
  where e.company_id=p_company_id
    and e.occurred_at between now()-interval '15 minutes'
                          and now()+interval '1 minute'
    and e.diagnostics is null
  order by e.id desc
  limit 1 for update;

  if v_event is null then
    return jsonb_build_object('contract','netprofile-prod1f-record-v1','saved',false);
  end if;
  update private.network_profile_producer_activity_events
     set diagnostics=p_diagnostics where id=v_event;
  return jsonb_build_object('contract','netprofile-prod1f-record-v1','saved',true);
end $$;

revoke all on function public.netprofile_prod1f_record_diagnostics(uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.netprofile_prod1f_record_diagnostics(uuid,jsonb)
  to service_role;
