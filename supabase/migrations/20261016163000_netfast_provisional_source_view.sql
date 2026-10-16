-- NETFAST1: dynamic candidate-only discovery cards, not canonical publication.
create or replace view private.netfast_discovered_records as
with eligible_candidate as (
 select c.id,c.canonical_domain as domain,c.legal_name as company_name,
 c.website_url,
 (select e->>'url' from jsonb_array_elements(c.evidence)e limit 1) as source_url,
 c.role_keys[1] as role_key,c.created_at,
 'governed_candidate'::text as origin,false as finished_only,1 as rank
 from public.network_company_discovery_candidates c
 join public.network_company_discovery_runs r on r.id=c.run_id
 where c.country_code='IT' and c.review_status='pending_review'
 and c.governance_status='approved_company_data'
 and c.personal_data_detected=false
 and coalesce(cardinality(c.personal_data_fields),0)=0
 and coalesce(cardinality(c.quality_flags),0)=0
 and c.match_company_id is null and c.match_signals='[]'::jsonb
 and c.promoted_company_id is null
 and jsonb_typeof(c.evidence)='array' and jsonb_array_length(c.evidence)>0
 and c.confidence>=0.55 and c.website_url like 'https://%'
 and r.governance_status='approved'
 and r.terms_status in ('allows_reuse','allows_limited_reuse')
 and r.database_rights_status in ('low_risk','licensed')
 and r.personal_data_policy in ('company_data_only','exclude_personal_data')
 and c.role_keys[1] in ('producer','trader_distributor','processor_service_provider','end_user')
), eligible_target as (
 select t.id,t.canonical_domain as domain,t.company_name,
 ('https://'||t.canonical_domain||'/')::text as website_url,
 t.evidence_url as source_url,t.proposed_role as role_key,t.created_at,
 'official_company_research'::text as origin,
 (t.material_signal='finished_equipment_only') as finished_only,2 as rank
 from public.network_core_target_leads t
 where t.status in ('needs_review','ready_for_crawler','enqueued_for_crawler')
 and t.evidence_url like 'https://%'
), candidates as (
 select * from eligible_candidate union all select * from eligible_target
), filtered as (
 select a.*,row_number() over(partition by a.domain order by a.rank,a.created_at,a.id) priority
 from candidates a
 where not exists(select 1 from public.network_companies c where c.archived_at is null
 and regexp_replace(lower(coalesce(c.website_domain,'')),'^www[.]','')=a.domain)
 and not exists(select 1 from public.network_company_discovery_candidates x
 where x.review_status='rejected' and lower(x.canonical_domain)=a.domain)
)
select id,domain,company_name,website_url,source_url,role_key,created_at,origin,finished_only
from filtered where priority=1;
revoke all on private.netfast_discovered_records from public,anon,authenticated;
