-- NET-COV2B: selected, consented leads create an *unapproved* run only.
create or replace function private.netcov2b_prepare_run_impl(p_source_id uuid,p_lead_ids uuid[])
returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype; n integer; seeds jsonb; rid uuid;
begin
 perform private.require_platform_permission('discovery.run');
 if auth.uid() is null or p_lead_ids is null or cardinality(p_lead_ids) not between 1 and 10
  or (select count(distinct x) from unnest(p_lead_ids)x)<>cardinality(p_lead_ids)
 then raise exception 'Exactly 1-10 distinct lead IDs required' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry where id=p_source_id for share;
 if not found or s.country_code<>'IT' or s.source_type<>'company_submission'
  or s.governance_status<>'approved' or not s.enabled_for_discovery
  or s.terms_status not in ('allows_reuse','allows_limited_reuse')
  or s.database_rights_status not in ('low_risk','licensed')
  or s.personal_data_policy not in ('company_data_only','exclude_personal_data')
  or s.reviewed_by is null or s.reviewed_at is null
  or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
  or cardinality(p_lead_ids)>least(10,s.max_domains_per_run)
 then raise exception 'Active licensed source and budget required' using errcode='42501';end if;
 select count(*),coalesce(jsonb_agg(l.proposed_url order by l.domain),'[]'::jsonb) into n,seeds
 from public.network_discovery_domain_leads l
 join public.network_core_target_leads t on t.discovery_lead_id=l.id
 join public.network_netcov2b_domain_permissions p on p.source_id=l.source_id
  and p.domain=l.domain and p.expires_at>now() and p.revoked_at is null
 where l.id=any(p_lead_ids) and l.source_id=p_source_id and l.country_code='IT'
  and l.status='pending_review' and l.intake_run_id is null
  and t.status='enqueued_for_crawler' and t.material_signal='explicit_steel_tube_product'
  and l.proposed_url='https://'||l.domain||'/'
  and not exists(select 1 from public.network_companies c
   where lower(c.website_domain)=l.domain and c.archived_at is null)
  and not exists(select 1 from public.network_company_discovery_candidates c
   where c.canonical_domain=l.domain);
 if n<>cardinality(p_lead_ids)
 then raise exception 'One or more leads lacks direct domain consent, target review or deduplication' using errcode='42501';end if;
 insert into public.network_company_discovery_runs(
   requested_by,country_code,seed_urls,status,source_type,source_reference,label
 ) values(auth.uid(),'IT',seeds,'queued','other',s.source_url,
   'NET-COV2B first-party; separate run governance required') returning id into rid;
 return jsonb_build_object('status','queued_unreviewed','run_id',rid,'seed_count',n,'crawler_executed',false,'published',0);
end $$;
create or replace function public.netcov2b_prepare_run(p_source_id uuid,p_lead_ids uuid[])
returns jsonb language sql security invoker set search_path=''
as 'select private.netcov2b_prepare_run_impl(p_source_id,p_lead_ids);';
revoke all on function private.netcov2b_prepare_run_impl(uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.netcov2b_prepare_run(uuid,uuid[]) from public,anon;
grant execute on function private.netcov2b_prepare_run_impl(uuid,uuid[]) to authenticated;
grant execute on function public.netcov2b_prepare_run(uuid,uuid[]) to authenticated;
