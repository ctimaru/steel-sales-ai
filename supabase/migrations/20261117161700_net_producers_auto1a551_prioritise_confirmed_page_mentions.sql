-- AUTO1.A.5.5.1 — rank ONLY source-local, confirmed individual mentions
-- before weaker URL path hints when selecting a read-only A5.5 audit sample.
-- Same-PAGE mention != same-ROW exact capacity; no SKU inference or write.
-- Preserves all A5.5 official source, source SHA, access and rate guards.

create or replace function private.netproducers1_auto1a55_product_audit_sample(
 p_limit integer default 8
) returns jsonb
language plpgsql stable security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if p_limit is null or p_limit not between 1 and 12 then
   raise exception 'A5.5 sample limit must be 1..12' using errcode='22023';
 end if;

 with official_sources as (
   select
     p.id as page_id, p.source_url, p.canonical_domain,
     p.last_sha256 as source_sha256, p.last_checked_at,
     -- Both observations must come from this exact first-party page and the
     -- identical bytes. Neither proves a standard/grade DIMENSION tuple.
     exists (
       select 1 from private.network_producer_auto1_candidates n
       where n.company_id=p.company_id
         and n.source_url=p.source_url
         and n.source_sha256=p.last_sha256
         and n.evidence_status='confirmed'
         and n.claim_kind='technical_standard'
     ) and exists (
       select 1 from private.network_producer_auto1_candidates g
       where g.company_id=p.company_id
         and g.source_url=p.source_url
         and g.source_sha256=p.last_sha256
         and g.evidence_status='confirmed'
         and g.claim_kind='steel_grade'
     ) as same_page_observations,
     case
       when p.source_url ~* '(10219|10210|structural|hollow|dimension|tub[ioe]|pipes?|sections?|spessori|technical)' then 0
       when p.source_url ~* '(sostenibil|sustainab|careers?|lavora-con-noi|criteri-ambientali)' then 2
       else 1
     end as relevance_bucket
   from private.network_producer_auto1_product_pages p
   join private.network_producer_auto1_sources q on q.company_id=p.company_id
   join public.network_companies c on c.id=p.company_id
   where p.status in ('processed','candidate_review')
     and p.last_sha256 ~ '^[a-f0-9]{64}$'
     and p.last_checked_at>=now()-interval '35 days'
     and p.next_check_at>now()
     and p.root_sha256=q.last_sha256
     and p.root_source_url=q.source_url
     and p.canonical_domain=q.canonical_domain
     and q.last_checked_at>=now()-interval '35 days'
     and q.source_url=c.website_url and q.canonical_domain=c.website_domain
     and c.country_code='IT' and c.publication_status='published'
     and c.archived_at is null
     and exists (
       select 1 from public.network_company_role_assignments a
       join public.network_company_roles r on r.id=a.role_id
       where a.company_id=c.id
         and r.canonical_key='producer' and r.status='active'
     )
 ), ranked as (
   select *,
     row_number() over (
       partition by canonical_domain
       order by
         case when same_page_observations then 0 else 1 end,
         relevance_bucket, last_checked_at desc, page_id
     ) as domain_rank
   from official_sources
 ), chosen as (
   select page_id,source_url,canonical_domain,source_sha256,
          domain_rank,relevance_bucket,same_page_observations
   from ranked
   where domain_rank<=2
   order by
     case when same_page_observations then 0 else 1 end,
     relevance_bucket,domain_rank,canonical_domain,page_id
   limit p_limit
 )
 select coalesce(jsonb_agg(
   jsonb_build_object(
     'page_id',page_id,'source_url',source_url,
     'canonical_domain',canonical_domain,'source_sha256',source_sha256
   )
   order by case when same_page_observations then 0 else 1 end,
            relevance_bucket,domain_rank,canonical_domain,page_id
 ),'[]'::jsonb)
 into v_items from chosen;

 return jsonb_build_object(
   'contract','netproducers-auto1a55-product-audit-sample-v1',
   'count',jsonb_array_length(v_items),'items',v_items
 );
end;
$body$;

-- Preserve explicit least privilege after replacement. The public invoker
-- façade installed in A5.5 stays unchanged and service_role-only.
revoke all on function private.netproducers1_auto1a55_product_audit_sample(integer)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a55_product_audit_sample(integer)
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a55_product_audit_sample(integer)
 to service_role;
grant execute on function public.netproducers1_auto1a55_product_audit_sample(integer)
 to service_role;

comment on function private.netproducers1_auto1a55_product_audit_sample(integer) is
 'A5.5.1 service-only read-only SHA-pinned sample: prioritise confirmed source-local standard+grade mentions as observational hints, never exact SKU evidence.';
