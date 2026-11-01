-- NET-GROWTH2C.2 — governed product evidence triage, read-only.
-- This migration DOES NOT accept any evidence, create companies or publish data.
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

  with candidate as (
    select e.id,e.field_key,e.field_value,e.evidence_url,e.confidence,e.fetched_at,
      e.extractor_version,e.review_status,e.canonical_company_id,e.discovered_record_id,
      case when e.canonical_company_id is not null then 'canonical' else 'provisional' end as lane,
      coalesce(c.legal_name,d.company_name,'Identità da riconciliare') as company_name,
      coalesce(c.website_domain,d.domain,'') as domain,
      (c.id is not null and c.publication_status='published' and c.archived_at is null) as is_published
    from private.network_company_enrichment e
    left join public.network_companies c on c.id=e.canonical_company_id
    left join private.netfast_discovered_records d on d.id=e.discovered_record_id
    where e.field_key='products' and e.review_status='candidate'
  ), filtered as (
    select * from candidate where p_lane='all' or lane=p_lane
  ), page as (
    select * from filtered
    order by case when lane='canonical' then 0 else 1 end,
      confidence desc nulls last,company_name,id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'contract','net-growth2c2-product-review-v1',
    'total_candidates',(select count(*) from candidate),
    'canonical_candidates',(select count(*) from candidate where lane='canonical'),
    'provisional_candidates',(select count(*) from candidate where lane='provisional'),
    'selected_total',(select count(*) from filtered),
    'accepted_by_this_process',0,
    'publication_performed',false,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.company_name,'domain',p.domain,
      'lane',p.lane,'is_published',p.is_published,
      'review_status',p.review_status,'confidence',p.confidence,
      'fetched_at',p.fetched_at,'source_url',p.evidence_url,
      'extractor_version',p.extractor_version,
      'products',coalesce((
        select jsonb_agg(left(x.value,140) order by x.ordinality)
        from jsonb_array_elements_text(
          case when jsonb_typeof(p.field_value)='array' then p.field_value else '[]'::jsonb end
        ) with ordinality as x(value,ordinality)
        where x.ordinality<=4
      ),'[]'::jsonb)
    ) order by case when p.lane='canonical' then 0 else 1 end,
      p.confidence desc nulls last,p.company_name,p.id) from page p),'[]'::jsonb)
  ) into payload;
  return payload;
end;
$function$;
revoke all on function public.netgrowth2c2_product_evidence_page(text,integer,integer)
from public,anon,authenticated;
grant execute on function public.netgrowth2c2_product_evidence_page(text,integer,integer)
to authenticated,service_role;
comment on function public.netgrowth2c2_product_evidence_page(text,integer,integer) is
 'Platform discovery.read only. Candidate product excerpts (max 4 brief phrases), no acceptance, rights approval or company publication.';
