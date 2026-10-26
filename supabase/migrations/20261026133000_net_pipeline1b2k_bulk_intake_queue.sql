-- NET-PIPELINE1B.2K: read-only bulk intake queue, isolated from reviewed discovery.
-- A domain match is NOT proof of identity or redistribution rights.
create or replace view private.net_pipeline1b2k_bulk_intake_queue
with (security_invoker = true)
as
with leads as (
 select l.id as lead_id, l.company_name, l.canonical_domain,
        l.evidence_url, l.status as lead_status,
        lower(regexp_replace(trim(l.canonical_domain), '^www[.]', '')) as domain,
        lower(regexp_replace(split_part(regexp_replace(trim(l.evidence_url),'^https?://',''), '/',1),'^www[.]','')) as source_host
 from public.network_core_target_leads l
),
checks as (
 select l.*,
 exists(select 1 from public.network_companies n
   where lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))=l.domain) as in_network,
 exists(select 1 from public.network_company_discovery_candidates d
   where lower(regexp_replace(coalesce(d.canonical_domain,''),'^www[.]',''))=l.domain) as in_discovery
 from leads l
)
select lead_id,company_name,canonical_domain,evidence_url,lead_status,
 case
 when coalesce(trim(company_name),'')='' or coalesce(trim(domain),'')='' or coalesce(trim(evidence_url),'')='' then 'missing_fields'
 when in_network then 'network_domain_collision'
 when in_discovery then 'discovery_domain_collision'
 when evidence_url !~* '^https://' then 'non_https_evidence'
 when domain<>source_host and right(source_host,length(domain)+1)<>'.'||domain then 'external_source'
 when lower(trim(company_name)) ~ '^[[:alnum:]]+(srl|spa)[.]$' then 'malformed_name'
 else 'technical_prefilter_pass_rights_pending'
 end as classification
from checks;
revoke all on private.net_pipeline1b2k_bulk_intake_queue from public,anon,authenticated;
