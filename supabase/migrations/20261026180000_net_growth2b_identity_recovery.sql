-- NET-GROWTH2B: deterministic, read-only recovery queue over unpromoted leads.
-- Names and domains are signals, never proof of legal identity.
create or replace view private.net_growth2b_identity_recovery
with (security_invoker=true) as
with base as (
 select l.id as lead_id,l.company_name,l.canonical_domain,l.evidence_url,
 lower(regexp_replace(trim(l.company_name),'[^[:alnum:]]','','g')) as name_key,
 lower(regexp_replace(trim(l.canonical_domain),'^www[.]','')) as domain_key
 from public.network_core_target_leads l
 where not exists (select 1 from private.net_pipeline1b2p_publication_ledger p where p.lead_id=l.id)
), scored as (
select b.*,
 exists(select 1 from public.network_companies c
   where lower(regexp_replace(trim(c.legal_name),'[^[:alnum:]]','','g'))=b.name_key) as name_in_catalog,
 exists(select 1 from public.network_companies c
   where lower(regexp_replace(coalesce(c.website_domain,''),'^www[.]',''))=b.domain_key) as domain_in_catalog,
 exists(select 1 from public.network_core_target_leads o
   where o.id<>b.lead_id
   and lower(regexp_replace(trim(o.company_name),'[^[:alnum:]]','','g'))=b.name_key) as lead_name_collision
from base b)
select lead_id,company_name,canonical_domain,evidence_url,
 case
 when domain_in_catalog or name_in_catalog or lead_name_collision then 'identity_collision_review'
 when company_name ~* '(s[.]?r[.]?l[.]?|s[.]?p[.]?a[.]?)[[:space:]]*$' then 'corporate_form_source_review'
 when company_name ~* '(group|gruppo|holding|industries|international)' then 'group_or_brand_review'
 else 'legal_identity_enrichment'
 end as next_action,
 name_in_catalog,domain_in_catalog,lead_name_collision
from scored;
revoke all on private.net_growth2b_identity_recovery from public,anon,authenticated;
