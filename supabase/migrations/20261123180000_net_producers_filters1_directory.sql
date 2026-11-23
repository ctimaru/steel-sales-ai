-- NET-PRODUCERS-FILTERS1 (fase 2 di NET-PRODUCERS-UX3) — founder decisions, 23 Nov 2026:
--   * filters work on ALL published producers of the country, not only the visible page;
--   * filters use ONLY first-party documented technical claims; source mentions
--     ("da qualificare") join the match only through a separate, explicit switch;
--   * Italy first (other countries later, their evidence lives in other tables);
--   * «Prodotto» uses the values as written in the sources (no controlled categories yet).
-- netpro1b_scoped_directory is NOT modified: the page falls back to it if this
-- function is unavailable, so a frontend revert is always safe.
-- Read-only: no insert, update or delete. No inference of SKU, stock or capability.

-- ---------------------------------------------------------------- normalisation
create or replace function private.netproducers2_norm_standard(p_value text)
returns text language plpgsql immutable set search_path=''
as $fn$
declare
  v text := upper(regexp_replace(btrim(coalesce(p_value,'')),'\s+',' ','g'));
begin
  -- «UNI EN 10219-1:2006» and «EN 10219» both belong to EN 10219.
  v := regexp_replace(v,'^UNI EN ?','EN ');
  if v ~ '^(EN|UNI|ISO|ASTM|API|DIN|ASME) ?[A-Z]? ?[0-9]' then
    v := regexp_replace(v,'^(EN|UNI|ISO|ASTM|API|DIN|ASME) ?([A-Z]?) ?([0-9]+[A-Z]*).*$','\1 \2\3');
  end if;
  return nullif(v,'');
end;
$fn$;

create or replace function private.netproducers2_norm_value(p_kind text,p_value text)
returns text language sql immutable set search_path=''
as $fn$
  select case p_kind
    when 'technical_standard' then private.netproducers2_norm_standard(p_value)
    when 'steel_grade' then nullif(upper(regexp_replace(coalesce(p_value,''),'\s+','','g')),'')
    else nullif(lower(regexp_replace(btrim(coalesce(p_value,'')),'\s+',' ','g')),'')
  end;
$fn$;

-- ---------------------------------------------------------------- evidence rows
-- One row per (company, kind, normalised value) for published Italian producers.
-- Documented = first-party technical claims (same rules as netproducers1_technical_claims).
-- Mention = confirmed source mentions (same rules as netproducers1_auto1b_mentions).
create or replace function private.netproducers2_evidence_impl(p_country text)
returns table(company_id uuid,claim_kind text,norm text,label text,level text)
language sql stable security definer set search_path=''
as $fn$
  with base as (
    select c.id,c.website_url,c.website_domain
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and c.country_code=p_country and p_country='IT'
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
  ), documented as (
    select e.company_id,e.claim_kind,
      private.netproducers2_norm_value(e.claim_kind,e.claim_value) as norm,
      e.claim_value as label,'documented'::text as level
    from private.network_producer_technical_claims e
    join base b on b.id=e.company_id
    where e.evidence_status='first_party_observed' and e.rights_status='link_only'
  ), mentioned as (
    select a.company_id,a.claim_kind,
      private.netproducers2_norm_value(a.claim_kind,a.claim_value) as norm,
      a.claim_value as label,'mention'::text as level
    from private.network_producer_auto1_candidates a
    join base b on b.id=a.company_id
    join private.network_producer_auto1_sources q on q.company_id=a.company_id
    left join private.network_producer_auto1_product_pages pg
      on pg.company_id=a.company_id and pg.source_url=a.source_url
    where a.evidence_status='confirmed'
      and a.evidence_level='source_mention_only'
      and q.source_url=b.website_url and q.canonical_domain=b.website_domain
      and q.last_checked_at>=now()-interval '35 days'
      and (
        (a.verifier_version='netproducers-auto1b-v1'
         and a.source_url=q.source_url and a.source_sha256=q.last_sha256)
        or
        (a.verifier_version='netproducers-auto1a3-v1'
         and pg.id is not null and a.source_url=pg.source_url
         and a.source_sha256=pg.last_sha256
         and pg.status in ('candidate_review','processed','unchanged')
         and pg.last_checked_at>=now()-interval '35 days'
         and pg.root_sha256=q.last_sha256 and pg.root_source_url=q.source_url
         and pg.canonical_domain=q.canonical_domain)
      )
  )
  select company_id,claim_kind,norm,label,level from documented where norm is not null
  union all
  select company_id,claim_kind,norm,label,level from mentioned where norm is not null;
$fn$;

-- ---------------------------------------------------------------- directory
create or replace function private.netproducers2_directory_impl(
  p_organization_id uuid,p_country text,p_query text,
  p_products text[],p_standards text[],p_grades text[],p_region text,
  p_documented_only boolean,p_include_mentions boolean,p_sort text,
  p_page integer,p_limit integer
)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_country text := upper(coalesce(p_country,''));
  v_query text := btrim(coalesce(p_query,''));
  v_region text := nullif(btrim(coalesce(p_region,'')),'');
  v_sort text := coalesce(nullif(p_sort,''),'name');
  v_docs_only boolean := coalesce(p_documented_only,false);
  v_mentions boolean := coalesce(p_include_mentions,false);
  v_page integer := greatest(1,least(coalesce(p_page,1),10000));
  v_limit integer := greatest(1,least(coalesce(p_limit,18),24));
  v_products text[];
  v_standards text[];
  v_grades text[];
  v_rows jsonb;
  v_total integer;
begin
  if v_country<>'IT' or char_length(v_query)>120 or char_length(coalesce(v_region,''))>90
     or v_sort not in ('name','documented')
     or coalesce(cardinality(p_products),0)>10 or coalesce(cardinality(p_standards),0)>10
     or coalesce(cardinality(p_grades),0)>10
     or exists(select 1 from unnest(coalesce(p_products,'{}')||coalesce(p_standards,'{}')||coalesce(p_grades,'{}')) x
               where x is null or char_length(x) not between 1 and 80) then
    raise exception 'Invalid producer filter parameters' using errcode='22023';
  end if;
  if not private.netpro1b_allowed_for(p_organization_id,'producers',v_country) then
    raise exception 'Network PRO producer/country entitlement required' using errcode='42501';
  end if;

  select coalesce(array_agg(distinct private.netproducers2_norm_value('manufacturing_process',x)),'{}')
    into v_products from unnest(coalesce(p_products,'{}')) x;
  select coalesce(array_agg(distinct private.netproducers2_norm_value('technical_standard',x)),'{}')
    into v_standards from unnest(coalesce(p_standards,'{}')) x;
  select coalesce(array_agg(distinct private.netproducers2_norm_value('steel_grade',x)),'{}')
    into v_grades from unnest(coalesce(p_grades,'{}')) x;

  with base as (
    select c.id,c.legal_name,c.trading_name,c.country_code,c.website_url
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and c.country_code=v_country
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
      and (v_query='' or position(lower(v_query) in
        lower(c.legal_name||' '||coalesce(c.trading_name,'')||' '||coalesce(c.website_domain,'')))>0)
      and (v_region is null or exists (
        select 1 from public.network_facilities f
        where f.company_id=c.id and f.publication_status='published'
          and f.archived_at is null and f.country_code='IT'
          and lower(btrim(f.region))=lower(v_region)
      ))
  ), ev as (
    select e.* from private.netproducers2_evidence_impl(v_country) e
    join base b on b.id=e.company_id
  ), matchable as (
    -- Filters match documented values; mentions only when the user switches them on.
    select * from ev where level='documented' or v_mentions
  ), filtered as (
    select b.* from base b
    where (cardinality(v_products)=0 or exists (select 1 from matchable m
             where m.company_id=b.id and m.claim_kind in ('manufacturing_process','section_shape')
               and m.norm=any(v_products)))
      and (cardinality(v_standards)=0 or exists (select 1 from matchable m
             where m.company_id=b.id and m.claim_kind='technical_standard' and m.norm=any(v_standards)))
      and (cardinality(v_grades)=0 or exists (select 1 from matchable m
             where m.company_id=b.id and m.claim_kind='steel_grade' and m.norm=any(v_grades)))
      and (not v_docs_only or exists (select 1 from ev d
             where d.company_id=b.id and d.level='documented'))
  ), scored as (
    select f.*,
      (select count(distinct d.claim_kind||':'||d.norm) from ev d
        where d.company_id=f.id and d.level='documented')::integer as documented_values,
      (select count(*) from private.network_producer_catalog_links l
        where l.company_id=f.id and l.source_status='official_link_observed')::integer as catalogs,
      (select count(distinct d.claim_kind||':'||d.norm) from ev d
        where d.company_id=f.id and d.level='mention')::integer as mentions
    from filtered f
  ), ordered as (
    select sc.*,row_number() over (order by
      case when v_sort='documented' then sc.documented_values else 0 end desc,
      case when v_sort='documented' then sc.catalogs else 0 end desc,
      case when v_sort='documented' then sc.mentions else 0 end desc,
      sc.legal_name,sc.id) as rn
    from scored sc
  ), summary as (
    select count(*)::integer as total from ordered
  ), numbered as (
    select * from ordered
    where rn>(v_page-1)*v_limit and rn<=v_page*v_limit
  )
  select s.total,coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'name',coalesce(n.trading_name,n.legal_name),
    'country_code',n.country_code,'website_url',n.website_url,
    'documented_values',n.documented_values,'catalogs',n.catalogs,'mentions',n.mentions
  ) order by n.rn) filter (where n.id is not null),'[]'::jsonb)
  into v_total,v_rows
  from summary s left join numbered n on true
  group by s.total;

  return jsonb_build_object('contract','netproducers2-directory-v1',
    'country',v_country,'total',coalesce(v_total,0),'page',v_page,'limit',v_limit,
    'sort',v_sort,'documented_only',v_docs_only,'include_mentions',v_mentions,
    'items',coalesce(v_rows,'[]'::jsonb),
    'manufacturer_confirmed',false,'exact_combination_confirmed',false);
end;
$fn$;

-- ---------------------------------------------------------------- facets
-- The values a filter can offer, with how many companies carry each one.
create or replace function private.netproducers2_facets_impl(
  p_organization_id uuid,p_country text,p_include_mentions boolean
)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_country text := upper(coalesce(p_country,''));
  v_mentions boolean := coalesce(p_include_mentions,false);
  v_result jsonb;
begin
  if v_country<>'IT' then
    raise exception 'Invalid producer facet parameters' using errcode='22023';
  end if;
  if not private.netpro1b_allowed_for(p_organization_id,'producers',v_country) then
    raise exception 'Network PRO producer/country entitlement required' using errcode='42501';
  end if;

  with ev as (
    select * from private.netproducers2_evidence_impl(v_country)
    where level='documented' or v_mentions
  ), grouped as (
    select case when claim_kind in ('manufacturing_process','section_shape') then 'products'
                when claim_kind='technical_standard' then 'standards'
                when claim_kind='steel_grade' then 'grades' end as facet,
      norm,
      -- Display: the spelling that is not all capitals when one exists, else the code itself.
      case when claim_kind='technical_standard' or claim_kind='steel_grade' then norm
           else (array_agg(label order by (label=upper(label)),label))[1] end as label,
      count(distinct company_id)::integer as companies
    from ev
    where claim_kind in ('manufacturing_process','section_shape','technical_standard','steel_grade')
    group by 1,2,claim_kind
  ), merged as (
    select facet,norm,min(label) as label,sum(companies)::integer as companies
    from grouped group by facet,norm
  ), ranked as (
    select m.*,row_number() over (partition by facet order by companies desc,label) as rn
    from merged m
  ), regions as (
    select btrim(f.region) as region,count(distinct f.company_id)::integer as companies
    from public.network_facilities f
    join public.network_companies c on c.id=f.company_id
    where f.publication_status='published' and f.archived_at is null and f.country_code='IT'
      and c.publication_status='published' and c.archived_at is null and c.country_code='IT'
      and nullif(btrim(f.region),'') is not null
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
    group by btrim(f.region)
  )
  select jsonb_build_object(
    'contract','netproducers2-facets-v1','country',v_country,'include_mentions',v_mentions,
    'products',coalesce((select jsonb_agg(jsonb_build_object('value',norm,'label',label,'companies',companies)
      order by companies desc,label) from ranked where facet='products' and rn<=40),'[]'::jsonb),
    'standards',coalesce((select jsonb_agg(jsonb_build_object('value',norm,'label',label,'companies',companies)
      order by companies desc,label) from ranked where facet='standards' and rn<=40),'[]'::jsonb),
    'grades',coalesce((select jsonb_agg(jsonb_build_object('value',norm,'label',label,'companies',companies)
      order by companies desc,label) from ranked where facet='grades' and rn<=40),'[]'::jsonb),
    'regions',coalesce((select jsonb_agg(jsonb_build_object('value',region,'label',region,'companies',companies)
      order by region) from regions),'[]'::jsonb),
    'documented_companies',(select count(distinct company_id)::integer
      from private.netproducers2_evidence_impl(v_country) where level='documented')
  ) into v_result;
  return v_result;
end;
$fn$;

-- ---------------------------------------------------------------- public facades
create or replace function public.netproducers2_directory(
  p_organization_id uuid,p_country text,p_query text default null,
  p_products text[] default null,p_standards text[] default null,p_grades text[] default null,
  p_region text default null,p_documented_only boolean default false,
  p_include_mentions boolean default false,p_sort text default 'name',
  p_page integer default 1,p_limit integer default 18
)
returns jsonb language sql stable security invoker set search_path=''
as $fn$
  select private.netproducers2_directory_impl(
    p_organization_id,p_country,p_query,p_products,p_standards,p_grades,p_region,
    p_documented_only,p_include_mentions,p_sort,p_page,p_limit
  );
$fn$;

create or replace function public.netproducers2_facets(
  p_organization_id uuid,p_country text,p_include_mentions boolean default false
)
returns jsonb language sql stable security invoker set search_path=''
as $fn$
  select private.netproducers2_facets_impl(p_organization_id,p_country,p_include_mentions);
$fn$;

-- ---------------------------------------------------------------- privileges
revoke all on function private.netproducers2_norm_standard(text) from public,anon;
revoke all on function private.netproducers2_norm_value(text,text) from public,anon;
revoke all on function private.netproducers2_evidence_impl(text) from public,anon,authenticated;
revoke all on function private.netproducers2_directory_impl(uuid,text,text,text[],text[],text[],text,boolean,boolean,text,integer,integer) from public,anon;
revoke all on function private.netproducers2_facets_impl(uuid,text,boolean) from public,anon;
revoke all on function public.netproducers2_directory(uuid,text,text,text[],text[],text[],text,boolean,boolean,text,integer,integer) from public,anon;
revoke all on function public.netproducers2_facets(uuid,text,boolean) from public,anon;

grant execute on function private.netproducers2_directory_impl(uuid,text,text,text[],text[],text[],text,boolean,boolean,text,integer,integer) to authenticated;
grant execute on function private.netproducers2_facets_impl(uuid,text,boolean) to authenticated;
grant execute on function public.netproducers2_directory(uuid,text,text,text[],text[],text[],text,boolean,boolean,text,integer,integer) to authenticated;
grant execute on function public.netproducers2_facets(uuid,text,boolean) to authenticated;

-- Helps the value filters; the table is small but read on every filtered page.
create index if not exists network_producer_technical_claims_company_kind_idx
  on private.network_producer_technical_claims(company_id,claim_kind)
  where evidence_status='first_party_observed';

comment on function public.netproducers2_directory(uuid,text,text,text[],text[],text[],text,boolean,boolean,text,integer,integer)
is 'NET-PRODUCERS-FILTERS1: Italian producers filtered by documented first-party values (mentions only on explicit switch); fails closed without live producers/IT entitlement. Never asserts SKU, stock or manufacturer confirmation.';
comment on function public.netproducers2_facets(uuid,text,boolean)
is 'NET-PRODUCERS-FILTERS1: filter values with company counts for Italian producers; documented values only unless mentions are explicitly requested.';
