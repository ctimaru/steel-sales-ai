create or replace function private.crawl_it610b5_create_run_impl(p_source_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.network_discovery_source_registry%rowtype; rid uuid; seeds jsonb;
begin
 perform private.require_platform_permission('discovery.run');
 if auth.uid() is null then raise exception 'operator required' using errcode='42501'; end if;
 select * into s from public.network_discovery_source_registry where id=p_source_id for share;
 if not found or s.country_code <> 'IT' or s.governance_status <> 'approved'
 or not s.enabled_for_discovery or s.terms_status not in ('allows_reuse','allows_limited_reuse')
 or s.database_rights_status not in ('low_risk','licensed')
 or s.personal_data_policy not in ('company_data_only','exclude_personal_data')
 or s.reviewed_by is null or s.reviewed_at is null
 or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
 then raise exception 'approved source required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(proposed_url),'[]'::jsonb) into seeds
 from (select proposed_url from public.network_discovery_domain_leads
 where source_id=p_source_id and status='pending_review' and intake_run_id is null
 order by created_at limit 20) q;
 if jsonb_array_length(seeds)=0 then
 return jsonb_build_object('status','no_pending_leads','created',0); end if;
 insert into public.network_company_discovery_runs(
 requested_by,country_code,seed_urls,status,source_type,source_reference,label)
 values(auth.uid(),'IT',seeds,'queued','other',s.source_url,
 'Governed source intake — requires separate run review')
 returning id into rid;
 return jsonb_build_object('status','created_unreviewed','run_id',rid,
 'seed_count',jsonb_array_length(seeds),'published',0);
end $$;
revoke all on function private.crawl_it610b5_create_run_impl(uuid) from public,anon,authenticated;
grant execute on function private.crawl_it610b5_create_run_impl(uuid) to authenticated;
create or replace function public.crawl_it610b5_create_run(p_source_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
select private.crawl_it610b5_create_run_impl(p_source_id);
$$;
revoke all on function public.crawl_it610b5_create_run(uuid) from public,anon,authenticated;
grant execute on function public.crawl_it610b5_create_run(uuid) to authenticated;