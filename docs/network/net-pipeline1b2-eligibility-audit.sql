-- NET-PIPELINE1B.2: deterministic first-pass classification, read-only.
-- Diagnostic only. NEVER use this query as permission to publish.
-- Run through an authorized private operator workflow; do not expose candidate data publicly.
with candidates as (
 select d.id, d.match_company_id, d.quality_flags,
        d.personal_data_detected, d.legal_name, d.canonical_domain,
        d.country_code, d.source_url,
        exists (
          select 1 from public.network_companies n
          where lower(trim(n.website_domain))=lower(trim(d.canonical_domain))
        ) as domain_in_catalog
 from public.network_company_discovery_candidates d
 where d.review_status='pending_review'
   and d.governance_status='approved_company_data'
), classified as (
 select id,
 case
   when match_company_id is not null or domain_in_catalog
     then 'existing_match_review'
   when coalesce(personal_data_detected,false)
     then 'personal_data_hold'
   when nullif(trim(legal_name),'') is null
     or nullif(trim(canonical_domain),'') is null
     or nullif(trim(country_code),'') is null
     or nullif(trim(source_url),'') is null
     then 'incomplete_hold'
   when cardinality(coalesce(quality_flags,array[]::text[]))>0
     then 'quality_flags_review'
   else 'new_preview_candidate'
 end as eligibility_class
 from candidates
)
select eligibility_class,count(*) as candidate_count
from classified group by eligibility_class order by eligibility_class;
