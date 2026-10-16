-- NET-COV2B: source activation only after first-party domain consent is recorded.
create or replace function private.netcov2b_activate_source_impl(p_source_id uuid,p_attested boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype;n integer;
begin
 perform private.require_platform_permission('discovery.governance_review');
 if auth.uid() is null or p_attested is distinct from true
 then raise exception 'Explicit Platform approval required' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry where id=p_source_id for update;
 if not found or s.country_code<>'IT' or s.source_type<>'company_submission'
  or s.governance_status<>'approved'
  or s.terms_status not in ('allows_reuse','allows_limited_reuse')
  or s.database_rights_status not in ('low_risk','licensed')
  or s.personal_data_policy not in ('company_data_only','exclude_personal_data')
  or s.reviewed_at is null or s.reviewed_by is null
  or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
  or nullif(btrim(coalesce(s.review_note,'')),'') is null
  or s.rights_evidence_url='https://www.wikidata.org/wiki/Wikidata:Licensing'
 then raise exception 'Genuinely rights-reviewed company submission source required' using errcode='42501';end if;
 select count(*) into n from public.network_netcov2b_domain_permissions p
  where p.source_id=p_source_id and p.revoked_at is null and p.expires_at>now();
 if n=0 then raise exception 'No unexpired first-party company permissions' using errcode='42501';end if;
 update public.network_discovery_source_registry
 set enabled_for_discovery=true,
     max_domains_per_run=least(max_domains_per_run,10),
     minimum_interval_hours=greatest(minimum_interval_hours,24),
     updated_at=now() where id=p_source_id;
 return jsonb_build_object('status','source_enabled','consented_domains',n,
   'run_started',false,'published',0);
end $$;
create or replace function public.netcov2b_activate_source(p_source_id uuid,p_attested boolean default false)
returns jsonb language sql security invoker set search_path=''
as 'select private.netcov2b_activate_source_impl(p_source_id,p_attested);';

create or replace function private.netcov2b_source_readiness_impl()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 select jsonb_build_object('contract','netcov2b-source-readiness-v1',
  'items',coalesce(jsonb_agg(jsonb_build_object(
     'source_id',s.id,'source_name',s.source_name,
     'approved',s.governance_status='approved','enabled',s.enabled_for_discovery,
     'consented_domains',coalesce(p.n,0),'max_sites_per_run',least(10,s.max_domains_per_run)
  ) order by s.source_name),'[]'::jsonb)) into v
 from public.network_discovery_source_registry s
 left join lateral(select count(*) n from public.network_netcov2b_domain_permissions p
  where p.source_id=s.id and p.revoked_at is null and p.expires_at>now())p on true
 where s.source_type='company_submission';
 return v;
end $$;
create or replace function public.netcov2b_source_readiness()
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netcov2b_source_readiness_impl();';

revoke all on function private.netcov2b_activate_source_impl(uuid,boolean) from public,anon,authenticated;
revoke all on function private.netcov2b_source_readiness_impl() from public,anon,authenticated;
revoke all on function public.netcov2b_activate_source(uuid,boolean) from public,anon;
revoke all on function public.netcov2b_source_readiness() from public,anon;
grant execute on function private.netcov2b_activate_source_impl(uuid,boolean) to authenticated;
grant execute on function private.netcov2b_source_readiness_impl() to authenticated;
grant execute on function public.netcov2b_activate_source(uuid,boolean) to authenticated;
grant execute on function public.netcov2b_source_readiness() to authenticated;
