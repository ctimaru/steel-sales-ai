-- NET-PIPELINE1B.2J — Read-only 434+ lead bulk preflight.
-- This is NOT a publish authorization: source terms, legal identity, GDPR and provenance remain gated.
with leads as (
 select l.id,l.company_name,l.canonical_domain,l.evidence_url,
 lower(regexp_replace(trim(l.canonical_domain),'^www\\.','')) as domain,
 lower(regexp_replace(split_part(regexp_replace(l.evidence_url,'^https?://',''), '/',1),'^www\\.','')) as evidence_host
 from public.network_core_target_leads l
), classification as (
 select l.*,
 exists(select 1 from public.network_companies n
   where lower(regexp_replace(coalesce(n.website_domain,''),'^www\\.',''))=l.domain) as published_domain_collision,
 exists(select 1 from public.network_company_discovery_candidates d
   where lower(regexp_replace(coalesce(d.canonical_domain,''),'^www\\.',''))=l.domain) as discovery_domain_collision
 from leads l
)
select case
 when trim(coalesce(company_name,''))='' or trim(coalesce(domain,''))='' or trim(coalesce(evidence_url,''))='' then 'incomplete_identity'
 when published_domain_collision then 'existing_network_domain'
 when discovery_domain_collision then 'existing_discovery_domain'
 when domain<>evidence_host and evidence_host not like ('%.'||domain) then 'external_or_mismatched_source'
 when lower(trim(company_name)) ~ '^[[:alnum:]]+(srl|spa)[.]$' then 'malformed_name'
 else 'identity_prefilter_only_rights_and_company_verification_pending'
 end as preflight_status,count(*) as lead_count
from classification group by 1 order by 2 desc;
