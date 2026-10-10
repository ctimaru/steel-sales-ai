-- CRAWL-IT3.1: human-reviewed domain leads become staged crawler runs, never publications.
alter table public.network_discovery_domain_leads
 add column if not exists review_note text,
 add column if not exists intake_run_id uuid null references public.network_company_discovery_runs(id);
create or replace function public.crawl_it3_review_lead(
 p_lead_id uuid,p_decision text,p_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.network_discovery_domain_leads%rowtype;
 declare_run uuid;
begin
 perform private.require_platform_permission('discovery.review');
 if p_decision not in ('accept','reject') or length(btrim(coalesce(p_note,''))) < 12
 then raise exception 'review requires decision and explanation' using errcode='22023'; end if;
 select * into v from public.network_discovery_domain_leads
 where id=p_lead_id for update;
 if not found then raise exception 'lead missing' using errcode='P0002'; end if;
 if v.status<>'pending_review' then raise exception 'lead already reviewed' using errcode='22023'; end if;
 if p_decision='accept' and not exists(
   select 1 from public.network_discovery_source_registry s
   where s.id=v.source_id and s.country_code='IT' and s.enabled_for_discovery
    and s.governance_status='approved'
    and s.terms_status in ('allows_reuse','allows_limited_reuse')
    and s.database_rights_status in ('low_risk','licensed')
    and s.personal_data_policy in ('company_data_only','exclude_personal_data')
 ) then raise exception 'source approval required' using errcode='42501'; end if;
 if p_decision='accept' and exists (
   select 1 from public.network_companies c
   where c.archived_at is null and lower(c.website_domain)=lower(v.domain)
 ) then raise exception 'domain already present in Network; resolve existing identity first' using errcode='22023'; end if;
 if p_decision='accept' then
   -- A reviewed lead enters the existing candidate extraction pipeline;
   -- no approval of a Network company or facility happens here.
   insert into public.network_company_discovery_runs(
     requested_by,country_code,seed_urls,status,source_type,source_reference,label
   ) values (
     auth.uid(),'IT',jsonb_build_array(v.proposed_url),'queued',
     'manual_url',v.evidence_url,'CRAWL-IT3.1 reviewed lead'
   ) returning id into declare_run;
 end if;
 update public.network_discovery_domain_leads
 set status=case when p_decision='accept' then 'accepted' else 'rejected' end,
   review_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),
   intake_run_id=declare_run where id=p_lead_id;
 return jsonb_build_object('lead_id',p_lead_id,'decision',p_decision,'run_id',declare_run);
end $$;
revoke all on function public.crawl_it3_review_lead(uuid,text,text) from public,anon;
grant execute on function public.crawl_it3_review_lead(uuid,text,text) to authenticated;

create or replace function public.crawl_it3_list_pending_leads()
returns table(id uuid,domain text,proposed_url text,evidence_url text,source_name text,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
 perform private.require_platform_permission('discovery.read');
 return query select l.id,l.domain,l.proposed_url,l.evidence_url,s.source_name,l.created_at
 from public.network_discovery_domain_leads l
 join public.network_discovery_source_registry s on s.id=l.source_id
 where l.status='pending_review' order by l.created_at asc limit 100;
end $$;
revoke all on function public.crawl_it3_list_pending_leads() from public,anon;
grant execute on function public.crawl_it3_list_pending_leads() to authenticated;
