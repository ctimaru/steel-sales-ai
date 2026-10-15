-- CRAWL-IT6.10b.7: reject unapproved queued runs at claim time.
create or replace function public.p3_claim_next_company_discovery()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_run public.network_company_discovery_runs%rowtype;
begin
 update public.network_company_discovery_runs r
 set status='running',started_at=now(),completed_at=null,error=null
 where r.id=(
  select q.id from public.network_company_discovery_runs q
  where q.status='queued'
    and q.governance_status='approved'
    and q.terms_status in ('allows_reuse','allows_limited_reuse')
    and q.database_rights_status in ('low_risk','licensed')
    and q.personal_data_policy in ('company_data_only','exclude_personal_data')
  order by q.created_at,q.id for update skip locked limit 1
 ) returning r.* into v_run;
 if not found then return null; end if;
 return jsonb_build_object('run_id',v_run.id,'country_code',v_run.country_code,
  'seed_urls',v_run.seed_urls,'status',v_run.status,'started_at',v_run.started_at);
end $$;
