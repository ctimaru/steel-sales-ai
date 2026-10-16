-- NET-COV2B: atomic link only after separate human governance approved the run.
create or replace function private.netcov2b_link_run_impl(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.network_company_discovery_runs%rowtype;s public.network_discovery_source_registry%rowtype;
 expected integer; eligible integer;linked integer;
begin
 perform private.require_platform_permission('discovery.run');
 perform private.require_platform_permission('discovery.governance_review');
 if auth.uid() is null then raise exception 'Operator identity required' using errcode='42501';end if;
 select * into r from public.network_company_discovery_runs where id=p_run_id for update;
 if not found or r.requested_by<>auth.uid() or r.country_code<>'IT'
  or r.status<>'queued' or r.governance_status<>'approved'
  or r.terms_status not in ('allows_reuse','allows_limited_reuse')
  or r.database_rights_status not in ('low_risk','licensed')
  or r.personal_data_policy not in ('company_data_only','exclude_personal_data')
  or r.label<>'NET-COV2B first-party; separate run governance required'
  or jsonb_typeof(r.seed_urls)<>'array' or jsonb_array_length(r.seed_urls) not between 1 and 10
 then raise exception 'Owned, separately approved, queued NET-COV2B run required' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry
  where source_url=r.source_reference and source_type='company_submission' for share;
 if not found or not s.enabled_for_discovery or s.governance_status<>'approved'
  or s.terms_status not in ('allows_reuse','allows_limited_reuse')
  or s.database_rights_status not in ('low_risk','licensed')
  or s.personal_data_policy not in ('company_data_only','exclude_personal_data')
  or s.reviewed_at is null or s.reviewed_by is null
  or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
 then raise exception 'Source no longer approved' using errcode='42501';end if;
 expected:=jsonb_array_length(r.seed_urls);
 if expected>least(10,s.max_domains_per_run)
  or (select count(distinct x) from jsonb_array_elements_text(r.seed_urls)x)<>expected
 then raise exception 'Unacceptable run budget or duplicate seeds' using errcode='42501';end if;
 select count(*) into eligible from public.network_discovery_domain_leads l
 join public.network_netcov2b_domain_permissions p on p.source_id=l.source_id
  and p.domain=l.domain and p.revoked_at is null and p.expires_at>now()
 join public.network_core_target_leads t on t.discovery_lead_id=l.id
 where l.source_id=s.id and l.country_code='IT' and l.status='pending_review'
  and l.intake_run_id is null and t.status='enqueued_for_crawler'
  and t.material_signal='explicit_steel_tube_product'
  and l.proposed_url in (select jsonb_array_elements_text(r.seed_urls));
 if eligible<>expected then raise exception 'Missing direct permission or target qualification' using errcode='42501';end if;
 update public.network_discovery_domain_leads l set intake_run_id=r.id
 where l.source_id=s.id and l.status='pending_review' and l.intake_run_id is null
  and l.proposed_url in (select jsonb_array_elements_text(r.seed_urls));
 get diagnostics linked=row_count;
 if linked<>expected then raise exception 'Concurrent lead linkage mismatch' using errcode='42501';end if;
 return jsonb_build_object('status','linked_for_worker','run_id',r.id,
  'linked',linked,'published',0);
end $$;
create or replace function public.netcov2b_link_run(p_run_id uuid)
returns jsonb language sql security invoker set search_path=''
as 'select private.netcov2b_link_run_impl(p_run_id);';

-- Re-check direct permission on every write to the Candidate Gate.
create or replace function public.netcov2b_stage_candidate(p_lead_id uuid,p_candidate jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare d text;
begin
 if current_user<>'service_role' then raise exception 'Only dedicated worker credentials' using errcode='42501';end if;
 select l.domain into d from public.network_discovery_domain_leads l
 join public.network_netcov2b_domain_permissions p on p.source_id=l.source_id
   and p.domain=l.domain and p.revoked_at is null and p.expires_at>now()
 join public.network_discovery_source_registry s on s.id=l.source_id
 where l.id=p_lead_id and l.status='pending_review'
   and s.enabled_for_discovery and s.governance_status='approved'
   and s.source_type='company_submission'
   and s.terms_status in ('allows_reuse','allows_limited_reuse')
   and s.database_rights_status in ('low_risk','licensed')
   and s.personal_data_policy in ('company_data_only','exclude_personal_data');
 if d is null or d is distinct from p_candidate->>'canonical_domain'
 then raise exception 'Live first-party website permission required' using errcode='42501';end if;
 return public.crawl_it610b2_stage_candidate(p_lead_id,p_candidate);
end $$;
revoke all on function private.netcov2b_link_run_impl(uuid) from public,anon,authenticated;
revoke all on function public.netcov2b_link_run(uuid) from public,anon;
revoke all on function public.netcov2b_stage_candidate(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.netcov2b_link_run_impl(uuid) to authenticated;
grant execute on function public.netcov2b_link_run(uuid) to authenticated;
grant execute on function public.netcov2b_stage_candidate(uuid,jsonb) to service_role;
