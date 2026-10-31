-- NET-GROWTH2C.2R — product evidence integrity remediation (audit of #1069).
--
-- Replaces the read-only queue RPC created by
-- 20261031183100_netgrowth2c2_product_evidence_review.sql. That file is kept
-- byte-identical so the migration ledger never diverges, whether or not it was
-- already applied somewhere.
--
-- Fixes:
--  * Provisional evidence is shown only while its discovery record still
--    resolves in private.netfast_discovered_records. That view drops records
--    when the domain is promoted, suppressed, rejected, loses its feed grant /
--    source rights, or loses the per-domain priority. Such rows were previously
--    displayed as "Identità da riconciliare" with their source URL.
--  * Evidence whose source host or company domain is suppressed
--    (public.network_netfast3_suppressed_domains) is never shown.
--  * Evidence attached to archived/suspended canonical companies is not shown.
--  * Excluded rows stay untouched in the private table (historical provenance
--    preserved) and are reported only as aggregate counts per reason: no id,
--    name, domain, URL or excerpt of a quarantined row leaves the database.
--  * field_value formats are made explicit (text / string_list / mixed_list /
--    object); only string entries are rendered, max 4 x 140 chars.
--  * Deterministic ordering no longer depends on confidence alone
--    (the in-repo ingestion path always writes confidence = null).
--  * Least privilege: no service_role execute (the guard requires a real
--    Platform user anyway).
--
-- This migration DOES NOT change any evidence, company, review status or
-- publication state. Read-only RPC; no rows are written.

create or replace function public.netgrowth2c2_product_evidence_page(
  p_lane text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
declare payload jsonb;
begin
  perform private.require_platform_permission('discovery.read');
  if p_lane is null or p_lane not in ('all','canonical','provisional')
    or p_limit is null or p_limit < 1 or p_limit > 25
    or p_offset is null or p_offset < 0 or p_offset > 10000 then
    raise exception 'Invalid bounded product evidence page' using errcode='22023';
  end if;

  with raw as (
    select e.id,e.field_value,e.evidence_url,e.confidence,e.fetched_at,
      e.extractor_version,e.review_status,
      e.canonical_company_id,e.discovered_record_id,
      c.id as company_id,c.legal_name,c.publication_status,c.archived_at,
      nullif(regexp_replace(lower(btrim(coalesce(c.website_domain,''))),'^www[.]',''),'') as company_domain,
      d.id as discovery_id,d.company_name as discovery_name,
      nullif(regexp_replace(lower(btrim(coalesce(d.domain,''))),'^www[.]',''),'') as discovery_domain,
      nullif(regexp_replace(lower(coalesce(
        substring(e.evidence_url from '^[A-Za-z][A-Za-z0-9+.-]*://([^/:?#]+)'),'')),
        '^www[.]',''),'') as evidence_host
    from private.network_company_enrichment e
    left join public.network_companies c on c.id=e.canonical_company_id
    left join private.netfast_discovered_records d on d.id=e.discovered_record_id
    where e.field_key='products' and e.review_status='candidate'
  ), classified as (
    select r.*,
      case when r.canonical_company_id is not null then 'canonical' else 'provisional' end as lane,
      case when r.canonical_company_id is not null then r.company_domain else r.discovery_domain end as domain,
      case
        when exists (
          select 1 from public.network_netfast3_suppressed_domains s
          where s.domain in (r.evidence_host,r.company_domain,r.discovery_domain)
            or r.evidence_host like '%.'||s.domain
        ) then 'suppressed_domain'
        when r.canonical_company_id is not null and (
          r.company_id is null or r.archived_at is not null
          or r.publication_status in ('archived','suspended')
        ) then 'canonical_inactive'
        when r.canonical_company_id is null and r.discovery_id is null
          then 'discovery_unresolved'
        else null
      end as quarantine_reason
    from raw r
  ), eligible as (
    select q.*,
      coalesce(case when q.lane='canonical' then q.legal_name else q.discovery_name end,
        'Identità da riconciliare') as company_name,
      (q.evidence_host is not null and q.domain is not null and
        (q.evidence_host=q.domain or q.evidence_host like '%.'||q.domain)) as source_domain_match,
      case jsonb_typeof(q.field_value)
        when 'string' then 'text'
        when 'array' then case
          when not exists (
            select 1 from jsonb_array_elements(q.field_value) x(value)
            where jsonb_typeof(x.value)<>'string'
          ) then 'string_list' else 'mixed_list' end
        else 'object'
      end as value_format
    from classified q
    where q.quarantine_reason is null
  ), filtered as (
    select * from eligible where p_lane='all' or lane=p_lane
  ), page as (
    select * from filtered
    order by case when lane='canonical' then 0 else 1 end,
      confidence desc nulls last,fetched_at desc,company_name,id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'contract','net-growth2c2-product-review-v2',
    'total_candidates',(select count(*) from eligible),
    'canonical_candidates',(select count(*) from eligible where lane='canonical'),
    'provisional_candidates',(select count(*) from eligible where lane='provisional'),
    'selected_total',(select count(*) from filtered),
    'quarantined_total',(select count(*) from classified where quarantine_reason is not null),
    'quarantine_by_reason',jsonb_build_object(
      'discovery_unresolved',(select count(*) from classified where quarantine_reason='discovery_unresolved'),
      'suppressed_domain',(select count(*) from classified where quarantine_reason='suppressed_domain'),
      'canonical_inactive',(select count(*) from classified where quarantine_reason='canonical_inactive')
    ),
    'accepted_by_this_process',0,
    'publication_performed',false,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.company_name,'domain',coalesce(p.domain,''),
      'lane',p.lane,
      'is_published',(p.lane='canonical' and p.publication_status='published'),
      'review_status',p.review_status,'confidence',p.confidence,
      'fetched_at',p.fetched_at,'source_url',p.evidence_url,
      'source_domain_match',p.source_domain_match,
      'extractor_version',p.extractor_version,
      'value_format',p.value_format,
      'products',case p.value_format
        when 'text' then case
          when nullif(btrim(p.field_value #>> '{}'),'') is null then '[]'::jsonb
          else jsonb_build_array(left(btrim(p.field_value #>> '{}'),140)) end
        when 'object' then '[]'::jsonb
        else coalesce((
          select jsonb_agg(left(btrim(x.value #>> '{}'),140) order by x.ordinality)
          from (
            select y.value,row_number() over (order by y.ordinality) as ordinality
            from jsonb_array_elements(p.field_value) with ordinality as y(value,ordinality)
            where jsonb_typeof(y.value)='string' and nullif(btrim(y.value #>> '{}'),'') is not null
          ) x
          where x.ordinality<=4
        ),'[]'::jsonb)
      end
    ) order by case when p.lane='canonical' then 0 else 1 end,
      p.confidence desc nulls last,p.fetched_at desc,p.company_name,p.id) from page p),'[]'::jsonb)
  ) into payload;
  return payload;
end;
$function$;

revoke all on function public.netgrowth2c2_product_evidence_page(text,integer,integer)
from public,anon,authenticated,service_role;
grant execute on function public.netgrowth2c2_product_evidence_page(text,integer,integer)
to authenticated;
comment on function public.netgrowth2c2_product_evidence_page(text,integer,integer) is
 'Platform discovery.read only. Eligible candidate product excerpts (max 4 x 140 chars); unresolved, suppressed or inactive evidence is quarantined and exposed only as aggregate counts. No acceptance, rights approval or company publication.';
