-- NET-UX COMPACT4D: service-only source confidence and next-batch selection.
-- No publications, facilities, verification states or user-facing source leaks.
create or replace function public.netcompact4d_next_discovered_geo_batch(
  p_limit integer default 25
) returns jsonb
language plpgsql stable security invoker
set search_path=''
as $function$
declare v_items jsonb;
declare v_eligible bigint;
begin
  if current_user <> 'service_role' then
    raise exception 'Service-role only geographic acquisition' using errcode='42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'Batch must contain 1 to 25 companies' using errcode='22023';
  end if;
  with eligible as (
    select d.id, d.company_name, d.website_url, d.domain, d.created_at,
      row_number() over (
        partition by lower(regexp_replace(d.domain,'^www[.]',''))
        order by d.created_at, d.id
      ) as domain_rank
    from private.netfast_discovered_records d
    join public.network_core_target_leads t on t.id=d.id
    where d.origin='official_company_research'
      and d.role_key='end_user'
      and t.status='needs_review' and t.proposed_role='end_user'
      and d.domain is not null and d.website_url like 'https://%'
      and lower(regexp_replace(split_part(d.website_url,'/',3),'^www[.]',''))
        = lower(regexp_replace(d.domain,'^www[.]',''))
      and not exists (
        select 1 from public.network_neteima2_provisional_geo g where g.target_id=d.id
      )
  ),
  distinct_domains as (
    select id, company_name, website_url, domain, created_at
    from eligible where domain_rank=1
  ),
  chosen as (
    select * from distinct_domains order by created_at,id limit p_limit
  )
  select (select count(*) from distinct_domains),
    coalesce(jsonb_agg(jsonb_build_object(
      'kind','discovered','company_id',x.id,'company_name',x.company_name,
      'site',x.website_url,'domain',x.domain
    ) order by x.created_at,x.id),'[]'::jsonb)
  into v_eligible,v_items
  from chosen x;
  return jsonb_build_object(
    'contract','netcompact4d-next-geo-v1',
    'eligible',v_eligible,'limit',p_limit,'items',v_items
  );
end;
$function$;

revoke all on function public.netcompact4d_next_discovered_geo_batch(integer)
  from public,anon,authenticated;
grant execute on function public.netcompact4d_next_discovered_geo_batch(integer)
  to service_role;

create or replace function public.netcompact4d_geo_quality_audit(
  p_limit integer default 50
) returns jsonb
language plpgsql stable security invoker
set search_path=''
as $function$
declare v_json jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'Service-role only evidence audit' using errcode='42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Audit limit out of range' using errcode='22023';
  end if;
  with sources as (
    select g.company_id id, c.legal_name company_name, 'canonical'::text kind,
      g.source_url, g.evidence_snippet excerpt, g.city, g.region, g.status,
      (lower(regexp_replace(split_part(g.source_url,'/',3),'^www[.]',''))=
        lower(regexp_replace(c.website_domain,'^www[.]',''))) same_domain
    from public.network_it_geo_evidence_candidates g
    join public.network_companies c on c.id=g.company_id
    where g.status='pending_review'
    union all
    select g.target_id id, d.company_name, 'discovered'::text kind,
      g.source_url, g.source_excerpt excerpt, g.city, g.region, g.status,
      (lower(regexp_replace(split_part(g.source_url,'/',3),'^www[.]',''))=
        lower(regexp_replace(d.domain,'^www[.]',''))) same_domain
    from public.network_neteima2_provisional_geo g
    join private.netfast_discovered_records d on d.id=g.target_id
    where g.status='source_observed'
  ),
  assessed as (
    select s.*,
      case
        when coalesce(excerpt,'') ~* 'sede legale|registered office'
          then 'registered_office'
        when coalesce(excerpt,'') ~* 'sede principale|sede centrale|headquarter'
          then 'main_office'
        when coalesce(excerpt,'') ~* 'stabilimento|factory|production plant|unità produttiva'
          then 'plant'
        when coalesce(excerpt,'') ~* 'uffici|offices|sede commerciale'
          then 'office'
        else 'unspecified'
      end address_context,
      (coalesce(excerpt,'') ~* 'divisione|div[.] |gruppo srl|business unit'
        or coalesce(company_name,'') ~* 'pec[.]it') as identity_review
    from sources s
  )
  select jsonb_build_object(
    'contract','netcompact4d-quality-v1',
    'total',count(*),
    'same_domain',count(*) filter (where same_domain),
    'identity_review',count(*) filter (where identity_review),
    'non_primary',count(*) filter (where address_context in ('office','plant','unspecified')),
    'review_items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'company_id',review.id,'name',review.company_name,'kind',review.kind,
        'city',review.city,'region',review.region,
        'address_context',review.address_context,
        'identity_review',review.identity_review,
        'same_domain',review.same_domain,
        'source_url',review.source_url,
        'status',review.status
      ) order by review.company_name)
      from (
        select * from assessed
        where identity_review or not same_domain or
          address_context in ('office','plant','unspecified')
        order by identity_review desc,same_domain,company_name,id limit p_limit
      ) review
    ),'[]'::jsonb)
  ) into v_json from assessed;
  return v_json;
end;
$function$;

revoke all on function public.netcompact4d_geo_quality_audit(integer)
  from public,anon,authenticated;
grant execute on function public.netcompact4d_geo_quality_audit(integer)
  to service_role;

comment on function public.netcompact4d_next_discovered_geo_batch(integer)
  is 'Service-only, bounded, idempotent selection of exact-domain end-user companies without source-observed geography';
comment on function public.netcompact4d_geo_quality_audit(integer)
  is 'Service-only quality review indicators, no automatic verification or office-type inference for public profiles';
