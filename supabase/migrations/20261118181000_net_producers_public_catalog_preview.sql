-- NET-PRO-PRODUCERS1: public-source catalogue preview, no unlicensed PDF copy.
-- Source and observed atomic facts are PUBLIC FIRST-PARTY assertions, not
-- verified combinations or manufacturing guarantees. PRO retains intelligent
-- matching and verified claims; this is a bounded public discovery preview.

create function sec1_public.netproducers1_catalog_observed_preview_impl(
  p_search text default '', p_limit integer default 24
) returns jsonb
language plpgsql stable security definer set search_path=''
as $body$
declare
  v_items jsonb;
  v_total integer;
  v_producers integer;
  v_facts integer;
  v_q text:=lower(trim(coalesce(p_search,'')));
begin
  if p_search is not null and length(p_search)>80
    or p_limit is null or p_limit not between 1 and 24
  then
    raise exception 'Invalid public catalogue preview limits'
      using errcode='22023';
  end if;
  -- Never expose private submissions, grants, company claims, contacts,
  -- full document text, files, or unapproved producer candidates.
  select count(*),count(distinct c.id)
    into v_total,v_producers
  from private.network_producer_catalog_links l
  join public.network_companies c on c.id=l.company_id
  where c.country_code='IT' and c.publication_status='published'
    and c.archived_at is null
    and l.source_status='official_link_observed'
    and l.rights_status='link_only'
    and exists(
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer'
        and r.status='active'
    );
  select count(*) into v_facts
  from private.network_producer_technical_claims e
  join public.network_companies c on c.id=e.company_id
  where c.country_code='IT' and c.publication_status='published'
    and c.archived_at is null and e.evidence_status='first_party_observed'
    and e.rights_status='link_only'
    and exists(
      select 1 from private.network_producer_catalog_links l
      where l.company_id=e.company_id and l.source_url=e.source_url
        and l.rights_status='link_only'
        and l.source_status='official_link_observed'
    )
    and exists(
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer'
        and r.status='active'
    );
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',src.id,
    'company_id',src.company_id,
    'company_name',src.legal_name,
    'title',src.title,
    'source_url',src.source_url,
    'document_type',src.document_type,
    'edition_year',src.edition_year,
    'status','producer_confirmation_pending',
    'observations',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind',o.claim_kind,'value',o.claim_value,
        'scope',o.product_scope,'source_title',o.source_title
      ) order by o.claim_kind,o.claim_value),'[]'::jsonb)
      from (
        select e.claim_kind,e.claim_value,e.product_scope,e.source_title
        from private.network_producer_technical_claims e
        where e.company_id=src.company_id and e.source_url=src.source_url
          and e.evidence_status='first_party_observed'
          and e.rights_status='link_only'
        order by e.claim_kind,e.claim_value limit 25
      ) o
    )
  ) order by src.legal_name,src.title),'[]'::jsonb)
  into v_items
  from (
    select l.id,l.company_id,c.legal_name,l.title,l.source_url,
           l.document_type,l.edition_year
    from private.network_producer_catalog_links l
    join public.network_companies c on c.id=l.company_id
    where c.country_code='IT' and c.publication_status='published'
      and c.archived_at is null
      and l.source_status='official_link_observed'
      and l.rights_status='link_only'
      and exists(
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer'
          and r.status='active'
      )
      and (v_q='' or position(v_q in lower(c.legal_name||' '||l.title))>0
        or exists(
          select 1 from private.network_producer_technical_claims e
          where e.company_id=l.company_id and e.source_url=l.source_url
            and e.evidence_status='first_party_observed'
            and e.rights_status='link_only'
            and position(v_q in lower(e.claim_value))>0
        ))
    order by c.legal_name,l.title
    limit p_limit
  ) src;
  return jsonb_build_object(
    'contract','netproducers-catalog-preview-v1',
    'sources_total',v_total,'producers_total',v_producers,
    'observations_total',v_facts,
    'items',v_items,
    'count',jsonb_array_length(v_items),
    'manufacturer_confirmed',0,
    'exact_skus_verified',0,
    'document_copies',0
  );
end;
$body$;

create function public.netproducers1_catalog_observed_preview(
  p_search text default '',p_limit integer default 24
) returns jsonb language sql stable security invoker set search_path=''
as $body$
 select sec1_public.netproducers1_catalog_observed_preview_impl(p_search,p_limit);
$body$;

revoke all on function sec1_public.netproducers1_catalog_observed_preview_impl(text,integer)
  from public,anon,authenticated;
revoke all on function public.netproducers1_catalog_observed_preview(text,integer)
  from public,anon,authenticated;
grant execute on function sec1_public.netproducers1_catalog_observed_preview_impl(text,integer)
  to anon,authenticated,service_role;
grant execute on function public.netproducers1_catalog_observed_preview(text,integer)
  to anon,authenticated,service_role;

comment on function public.netproducers1_catalog_observed_preview(text,integer) is
'Bounded read-only published producer catalogue links and separately attributed first-party observed facts. No PDF mirroring, grants, exact SKUs, stock, prices or ability to supply.';
