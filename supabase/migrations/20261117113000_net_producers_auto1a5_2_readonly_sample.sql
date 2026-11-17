-- AUTO1.A.5.2 — strictly read-only, bounded historical snapshot sampling.
-- Depends on 20261117101500 A5; never requeues, changes TTL, mutates a candidate
-- or exposes a producer claim. Only service_role can enumerate official URLs.

create or replace function private.netproducers1_auto1a5_audit_sample(
 p_limit integer default 8
) returns jsonb
language plpgsql stable security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if p_limit is null or p_limit not between 1 and 12 then
   raise exception 'A5.2 sample limit must be 1..12' using errcode='22023';
 end if;

 with eligible as (
   select
     d.id as page_id, d.source_url, d.canonical_domain,
     d.last_sha256 as source_sha256, d.parent_page_id,
     case
       when d.source_url ~* '(10219|10210|structural|hollow|dimension|produzione|steel-pipes)' then 0
       when d.source_url ~* '(sostenibil|sustainab|lavora-con-noi|posizioni-aperte|careers?|criteri-ambientali)' then 2
       else 1
     end as relevance_bucket,
     row_number() over (
       partition by d.canonical_domain
       order by
         case
           when d.source_url ~* '(10219|10210|structural|hollow|dimension|produzione|steel-pipes)' then 0
           when d.source_url ~* '(sostenibil|sustainab|lavora-con-noi|posizioni-aperte|careers?|criteri-ambientali)' then 2
           else 1
         end,
         d.last_checked_at desc, d.id
     ) as domain_rank
   from private.network_producer_auto1_detail_pages d
   join private.network_producer_auto1_product_pages p
     on p.id=d.parent_page_id and p.company_id=d.company_id
   join private.network_producer_auto1_sources q
     on q.company_id=d.company_id
   join public.network_companies c on c.id=d.company_id
   where d.status='processed'
     and d.last_sha256 ~ '^[a-f0-9]{64}$'
     and d.last_checked_at>=now()-interval '35 days'
     and d.next_check_at>now()
     and d.parent_sha256=p.last_sha256
     and p.detail_discovery_sha256=p.last_sha256
     and p.status in ('processed','candidate_review','unchanged')
     and p.last_checked_at>=now()-interval '35 days'
     and p.root_sha256=q.last_sha256 and p.root_source_url=q.source_url
     and d.canonical_domain=p.canonical_domain
     and d.canonical_domain=q.canonical_domain
     and q.last_checked_at>=now()-interval '35 days'
     and q.source_url=c.website_url and q.canonical_domain=c.website_domain
     and c.country_code='IT' and c.publication_status='published'
     and c.archived_at is null
     and exists (
       select 1 from public.network_company_role_assignments a
       join public.network_company_roles r on r.id=a.role_id
       where a.company_id=c.id and r.canonical_key='producer'
         and r.status='active'
     )
 ), chosen as (
   select page_id,source_url,canonical_domain,source_sha256,
          parent_page_id,domain_rank,relevance_bucket
   from eligible
   where domain_rank<=2
   order by domain_rank,relevance_bucket,canonical_domain,page_id
   limit p_limit
 )
 select coalesce(jsonb_agg(
   jsonb_build_object(
     'page_id',page_id, 'source_url',source_url,
     'canonical_domain',canonical_domain,
     'source_sha256',source_sha256, 'parent_page_id',parent_page_id
   )
   order by domain_rank,relevance_bucket,canonical_domain,page_id
 ),'[]'::jsonb)
 into v_items from chosen;

 return jsonb_build_object(
   'contract','netproducers-auto1a5-audit-sample-v1',
   'count',jsonb_array_length(v_items),
   'items',v_items
 );
end;
$body$;

create or replace function public.netproducers1_auto1a5_audit_sample(
 p_limit integer default 8
) returns jsonb language sql stable security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a5_audit_sample(p_limit);
$body$;

revoke all on function private.netproducers1_auto1a5_audit_sample(integer)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a5_audit_sample(integer)
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a5_audit_sample(integer)
 to service_role;
grant execute on function public.netproducers1_auto1a5_audit_sample(integer)
 to service_role;

comment on function private.netproducers1_auto1a5_audit_sample(integer) is
 'A5.2 service-only read-only sample of up to 12 current canonical producer detail-page snapshots; never requeues, publishes, or changes source state.';
