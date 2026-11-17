-- AUTO1.A.5.5 — first-level HTML quality audit; READ-ONLY, service-only.
-- A5.4 runs on new pages; this diagnostic selects a bounded set of already
-- processed, SHA-pinned first-party PRODUCT pages without altering leases,
-- TTLs, source state, or publishing any claim. No PDF is downloaded.

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

 with eligible as (
   select
     p.id as page_id, p.source_url, p.canonical_domain,
     p.last_sha256 as source_sha256,
     case
       when p.source_url ~* '(10219|10210|structural|hollow|dimension|tub[ioe]|pipes?|sections?|spessori|technical)' then 0
       when p.source_url ~* '(sostenibil|sustainab|careers?|lavora-con-noi|criteri-ambientali)' then 2
       else 1
     end as relevance_bucket,
     row_number() over (
       partition by p.canonical_domain
       order by
         case
           when p.source_url ~* '(10219|10210|structural|hollow|dimension|tub[ioe]|pipes?|sections?|spessori|technical)' then 0
           when p.source_url ~* '(sostenibil|sustainab|careers?|lavora-con-noi|criteri-ambientali)' then 2
           else 1
         end,
         p.last_checked_at desc,p.id
     ) as domain_rank
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
 ), chosen as (
   select page_id,source_url,canonical_domain,source_sha256,
          domain_rank,relevance_bucket
   from eligible where domain_rank<=2
   order by relevance_bucket,domain_rank,canonical_domain,page_id
   limit p_limit
 )
 select coalesce(jsonb_agg(
   jsonb_build_object(
     'page_id',page_id,'source_url',source_url,
     'canonical_domain',canonical_domain,'source_sha256',source_sha256
   )
   order by relevance_bucket,domain_rank,canonical_domain,page_id
 ),'[]'::jsonb) into v_items from chosen;

 return jsonb_build_object(
   'contract','netproducers-auto1a55-product-audit-sample-v1',
   'count',jsonb_array_length(v_items),'items',v_items
 );
end;
$body$;

create or replace function public.netproducers1_auto1a55_product_audit_sample(
 p_limit integer default 8
) returns jsonb language sql stable security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a55_product_audit_sample(p_limit);
$body$;

revoke all on function private.netproducers1_auto1a55_product_audit_sample(integer)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a55_product_audit_sample(integer)
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a55_product_audit_sample(integer)
 to service_role;
grant execute on function public.netproducers1_auto1a55_product_audit_sample(integer)
 to service_role;

comment on function private.netproducers1_auto1a55_product_audit_sample(integer) is
 'A5.5 service-only bounded read-only current HTML product-page sample; no queue, evidence, or publication updates.';
