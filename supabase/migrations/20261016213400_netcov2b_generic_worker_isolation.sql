-- NET-COV2B isolation: generic runners must NEVER claim consented website runs.
-- Dedicated manual NET-COV2B worker alone may claim them after independent review.
create or replace function public.p3_claim_next_company_discovery()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_run public.network_company_discovery_runs%rowtype;
begin
 update public.network_company_discovery_runs r
 set status='running',started_at=now(),completed_at=null,error=null
 where r.id=(
  select q.id from public.network_company_discovery_runs q
  where q.status='queued' and q.governance_status='approved'
    and coalesce(q.label,'') <> 'NET-COV2B first-party; separate run governance required'
    and q.terms_status in ('allows_reuse','allows_limited_reuse')
    and q.database_rights_status in ('low_risk','licensed')
    and q.personal_data_policy in ('company_data_only','exclude_personal_data')
  order by q.created_at,q.id for update skip locked limit 1
 ) returning r.* into v_run;
 if not found then return null;end if;
 return jsonb_build_object('run_id',v_run.id,'country_code',v_run.country_code,
  'seed_urls',v_run.seed_urls,'status',v_run.status,'started_at',v_run.started_at);
end $$;

-- Generic source harvest must not mistake first-party domain permissions for
-- a broad directory/aggregation crawling license.
create or replace function public.crawl_it3_claim_due_source()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.network_discovery_source_registry%rowtype;
begin
 if auth.role()<>'service_role' then
  raise exception 'worker role required' using errcode='42501';end if;
 select * into v from public.network_discovery_source_registry
 where enabled_for_discovery=true and governance_status='approved'
   and source_type<>'company_submission' and country_code='IT'
   and terms_status in ('allows_reuse','allows_limited_reuse')
   and database_rights_status in ('low_risk','licensed')
   and personal_data_policy in ('company_data_only','exclude_personal_data')
   and reviewed_at is not null and reviewed_by is not null
   and nullif(btrim(coalesce(rights_evidence_url,'')),'') is not null
   and (last_discovered_at is null or last_discovered_at<=now()-make_interval(hours=>minimum_interval_hours))
 order by coalesce(last_discovered_at,'epoch'::timestamptz),created_at
 for update skip locked limit 1;
 if not found then return null;end if;
 update public.network_discovery_source_registry
 set last_discovered_at=now(),updated_at=now() where id=v.id;
 return jsonb_build_object('id',v.id,'source_url',v.source_url,
   'max_domains_per_run',least(v.max_domains_per_run,20));
end $$;
revoke all on function public.crawl_it3_claim_due_source() from public,anon,authenticated;
grant execute on function public.crawl_it3_claim_due_source() to service_role;

-- Prevent the ordinary source review RPC from silently enabling a company
-- submission with no real domain-specific authorization.
create or replace function private.netcov2b_source_activation_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.source_type='company_submission' and new.enabled_for_discovery then
   if not exists (select 1 from public.network_netcov2b_domain_permissions p
      where p.source_id=new.id and p.revoked_at is null and p.expires_at>now())
   then raise exception 'NET-COV2B: website crawl requires explicit active company consent' using errcode='42501';end if;
 end if;
 return new;
end $$;
drop trigger if exists netcov2b_source_activation_guard on public.network_discovery_source_registry;
create trigger netcov2b_source_activation_guard
 before update on public.network_discovery_source_registry
 for each row execute function private.netcov2b_source_activation_guard();
revoke all on function private.netcov2b_source_activation_guard() from public,anon,authenticated;
