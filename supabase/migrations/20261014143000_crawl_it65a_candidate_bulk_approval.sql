-- CRAWL-IT6.5a — governed multi-candidate approvals (never network publication).
-- SECURITY INVOKER facade over a private, permission-checked implementation.
create or replace function private.crawl_it65a_bulk_approve_candidates_impl(
  p_candidate_ids uuid[],
  p_note text,
  p_attested boolean
)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text := btrim(coalesce(p_note,''));
  v_approved jsonb := '[]'::jsonb;
  v_excluded jsonb := '[]'::jsonb;
  v_reason text;
begin
  perform private.require_platform_permission('discovery.governance_review');
  if p_attested is distinct from true then
    raise exception 'explicit company-data verification confirmation required' using errcode='22023';
  end if;
  if char_length(v_note) < 12 or char_length(v_note) > 1000 then
    raise exception 'bulk review requires a 12-1000 character reason' using errcode='22023';
  end if;
  if p_candidate_ids is null or cardinality(p_candidate_ids) not between 1 and 50
     or array_position(p_candidate_ids,null) is not null then
    raise exception 'bulk review requires 1-50 candidate IDs' using errcode='22023';
  end if;
  select array_agg(id order by id) into v_ids
  from (select distinct unnest(p_candidate_ids) as id) q;
  if cardinality(v_ids) <> cardinality(p_candidate_ids) then
    raise exception 'duplicate candidate IDs are not accepted' using errcode='22023';
  end if;

  -- Lock in deterministic order. Stale selections fail closed per candidate.
  foreach v_id in array v_ids loop
    v_reason := null;
    select * into v_candidate from public.network_company_discovery_candidates
      where id=v_id for update;
    if not found then
      v_reason := 'not_found';
    elsif v_candidate.country_code <> 'IT' then
      v_reason := 'not_italian';
    elsif v_candidate.review_status <> 'pending_review'
      or v_candidate.governance_status <> 'unreviewed' then
      v_reason := 'already_reviewed_or_closed';
    elsif v_candidate.personal_data_detected
      or cardinality(v_candidate.personal_data_fields) > 0 then
      v_reason := 'personal_data_requires_individual_review';
    elsif v_candidate.match_company_id is not null
      or coalesce(v_candidate.match_signals,'[]'::jsonb) <> '[]'::jsonb then
      v_reason := 'identity_match_requires_individual_review';
    elsif cardinality(v_candidate.quality_flags)>0 then
      v_reason := 'quality_flags_require_individual_review';
    elsif jsonb_typeof(v_candidate.evidence) <> 'array'
      or v_candidate.evidence='[]'::jsonb then
      v_reason := 'source_evidence_missing';
    else
      select * into v_run from public.network_company_discovery_runs
        where id=v_candidate.run_id for share;
      if not found or v_run.country_code <> 'IT'
        or v_run.governance_status <> 'approved'
        or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
        or v_run.database_rights_status not in ('low_risk','licensed')
        or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
        or v_run.governance_reviewed_by is null or v_run.governance_reviewed_at is null then
        v_reason := 'source_rights_not_approved';
      end if;
    end if;

    if v_reason is not null then
      v_excluded := v_excluded || jsonb_build_array(
        jsonb_build_object('id',v_id,'reason',v_reason)
      );
    else
      -- Reuse PA1.5's row-locked decision and immutable per-candidate audit event.
      perform private.pa1_5_review_discovery_candidate_governance_impl(
        v_id, 'approved_company_data', false, '{}'::text[],
        'CRAWL-IT6.5a bulk: ' || v_note
      );
      v_approved := v_approved || to_jsonb(v_id::text);
    end if;
  end loop;

  return jsonb_build_object(
    'requested_count',cardinality(v_ids),
    'approved_count',jsonb_array_length(v_approved),
    'excluded_count',jsonb_array_length(v_excluded),
    'approved_ids',v_approved,
    'excluded',v_excluded,
    'network_publications',0
  );
end;
$$;
revoke all on function private.crawl_it65a_bulk_approve_candidates_impl(uuid[],text,boolean)
  from public,anon,authenticated;
grant execute on function private.crawl_it65a_bulk_approve_candidates_impl(uuid[],text,boolean)
  to authenticated,service_role;

create or replace function public.crawl_it65a_bulk_approve_candidates(
  p_candidate_ids uuid[],
  p_note text,
  p_attested boolean default false
)
returns jsonb
language sql volatile security invoker set search_path=''
as $$
  select private.crawl_it65a_bulk_approve_candidates_impl(p_candidate_ids,p_note,p_attested);
$$;
revoke all on function public.crawl_it65a_bulk_approve_candidates(uuid[],text,boolean)
  from public,anon,authenticated;
grant execute on function public.crawl_it65a_bulk_approve_candidates(uuid[],text,boolean)
  to authenticated,service_role;
comment on function public.crawl_it65a_bulk_approve_candidates(uuid[],text,boolean) is
'CRAWL-IT6.5a Owner-reviewed maximum 50, strict evidence and rights gate; skips blocked IDs and writes immutable PA1.5 review audit per success. Never publishes.';
