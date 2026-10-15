-- CRAWL-IT6.10b.3: operator-authorized, source-bound lead/run link.
-- No candidate insert, auto-approval, publication or background activation.
create or replace function public.crawl_it610b3_link_lead_run(
 p_lead_id uuid, p_run_id uuid
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_lead public.network_discovery_domain_leads%rowtype;
 v_source public.network_discovery_source_registry%rowtype;
 v_run public.network_company_discovery_runs%rowtype;
begin
 perform private.require_platform_permission('discovery.run');
 if auth.uid() is null then
  raise exception 'platform operator required' using errcode='42501';
 end if;
 select * into v_lead from public.network_discovery_domain_leads
  where id=p_lead_id for update;
 if not found or v_lead.status <> 'pending_review' then
  raise exception 'pending lead required' using errcode='22023';
 end if;
 select * into v_source from public.network_discovery_source_registry
  where id=v_lead.source_id for share;
 if not found or not v_source.enabled_for_discovery
   or v_source.governance_status <> 'approved'
   or v_source.terms_status not in ('allows_reuse','allows_limited_reuse')
   or v_source.database_rights_status not in ('low_risk','licensed')
   or v_source.personal_data_policy not in ('company_data_only','exclude_personal_data')
   or v_source.reviewed_by is null or v_source.reviewed_at is null
   or nullif(btrim(coalesce(v_source.rights_evidence_url,'')),'') is null
 then raise exception 'lead source is not approved' using errcode='42501'; end if;
 select * into v_run from public.network_company_discovery_runs
  where id=p_run_id for update;
 if not found or v_run.country_code <> 'IT'
   or v_run.status not in ('running','completed')
   or v_run.governance_status <> 'approved'
   or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
   or v_run.database_rights_status not in ('low_risk','licensed')
   or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
   or v_run.requested_by <> auth.uid()
   or v_run.source_reference is distinct from v_source.source_url
 then raise exception 'owned and source-matched approved run required' using errcode='42501'; end if;
 if v_lead.intake_run_id = p_run_id then
  return jsonb_build_object('status','already_linked','updated',0,'published',0);
 end if;
 if v_lead.intake_run_id is not null then
  raise exception 'lead already linked to another run' using errcode='23505';
 end if;
 update public.network_discovery_domain_leads
 set intake_run_id=p_run_id where id=p_lead_id;
 return jsonb_build_object('status','linked_for_review','updated',1,'published',0);
end $$;
revoke all on function public.crawl_it610b3_link_lead_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.crawl_it610b3_link_lead_run(uuid,uuid) to authenticated;
comment on function public.crawl_it610b3_link_lead_run(uuid,uuid) is
'Platform discovery.run permission and own explicitly approved source-matched run required; links pending lead only, no publication.';
