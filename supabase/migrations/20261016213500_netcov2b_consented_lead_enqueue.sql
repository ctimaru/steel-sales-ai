-- NET-COV2B: enqueue only research leads covered by THIS source's live direct consent.
create or replace function private.netcov2b_enqueue_consented_impl(p_source_id uuid,p_limit integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype;
 t record; new_id uuid; staged integer:=0; skipped integer:=0;
begin
 perform private.require_platform_permission('discovery.run');
 perform private.require_platform_permission('discovery.governance_review');
 if auth.uid() is null or p_limit not between 1 and 10
 then raise exception 'Attested Platform operator and 1-10 budget required' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry
 where id=p_source_id for share;
 if not found or s.country_code<>'IT' or s.source_type<>'company_submission'
   or not s.enabled_for_discovery or s.governance_status<>'approved'
   or s.terms_status not in ('allows_reuse','allows_limited_reuse')
   or s.database_rights_status not in ('low_risk','licensed')
   or s.personal_data_policy not in ('company_data_only','exclude_personal_data')
   or s.reviewed_by is null or s.reviewed_at is null
   or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
 then raise exception 'Active company-submission source required' using errcode='42501';end if;
 for t in select q.* from public.network_core_target_leads q
   join public.network_netcov2b_domain_permissions p
   on p.source_id=p_source_id and p.domain=q.canonical_domain
    and p.revoked_at is null and p.expires_at>now()
   where q.status='ready_for_crawler'
     and q.material_signal='explicit_steel_tube_product'
   order by q.reviewed_at,q.id limit least(p_limit,s.max_domains_per_run) for update of q
 loop
   if exists(select 1 from public.network_companies c
     where c.archived_at is null and lower(c.website_domain)=t.canonical_domain)
      or exists(select 1 from public.network_company_discovery_candidates c
        where c.canonical_domain=t.canonical_domain)
      or exists(select 1 from public.network_discovery_domain_leads l
        where l.domain=t.canonical_domain)
   then skipped:=skipped+1;continue;end if;
   insert into public.network_discovery_domain_leads
    (source_id,country_code,domain,proposed_url,evidence_url,status)
    values(p_source_id,'IT',t.canonical_domain,
      'https://'||t.canonical_domain||'/',t.evidence_url,'pending_review')
    on conflict(source_id,domain) do nothing returning id into new_id;
   if new_id is not null then
     update public.network_core_target_leads
       set status='enqueued_for_crawler',discovery_lead_id=new_id,updated_at=now()
       where id=t.id;
     staged:=staged+1;
   else skipped:=skipped+1;end if;
   new_id:=null;
 end loop;
 return jsonb_build_object('status','consent_only_pending_review',
  'enqueued',staged,'skipped_duplicates',skipped,'crawler_executed',false,'published',0);
end $$;
create or replace function public.netcov2b_enqueue_consented(p_source_id uuid,p_limit integer default 10)
returns jsonb language sql security invoker set search_path=''
as 'select private.netcov2b_enqueue_consented_impl(p_source_id,p_limit);';

-- Fail closed for ordinary domain-lead writes that accidentally reuse a
-- first-party submission source with no company-specific permission.
create or replace function private.netcov2b_domain_lead_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if exists (select 1 from public.network_discovery_source_registry s
   where s.id=new.source_id and s.source_type='company_submission')
   and not exists (select 1 from public.network_netcov2b_domain_permissions p
      where p.source_id=new.source_id and p.domain=new.domain
        and p.revoked_at is null and p.expires_at>now())
 then raise exception 'Direct permission required for this company domain' using errcode='42501';end if;
 return new;
end $$;
drop trigger if exists netcov2b_domain_lead_guard on public.network_discovery_domain_leads;
create trigger netcov2b_domain_lead_guard before insert or update of source_id,domain
 on public.network_discovery_domain_leads for each row
 execute function private.netcov2b_domain_lead_guard();
revoke all on function private.netcov2b_enqueue_consented_impl(uuid,integer) from public,anon,authenticated;
revoke all on function private.netcov2b_domain_lead_guard() from public,anon,authenticated;
revoke all on function public.netcov2b_enqueue_consented(uuid,integer) from public,anon;
grant execute on function private.netcov2b_enqueue_consented_impl(uuid,integer) to authenticated;
grant execute on function public.netcov2b_enqueue_consented(uuid,integer) to authenticated;
