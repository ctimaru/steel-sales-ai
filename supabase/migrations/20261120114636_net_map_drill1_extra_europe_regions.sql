-- NET-MAP-DRILL1: non-EU administrative subdivisions with honest
-- published-facility-only geography. No mass geocoding or invented locations.
-- Sources: Eurostat GISCO NUTS2024 (CH/RS/TR), NUTS2021 (GB);
-- Ukraine 2020 provinces (CC BY 4.0, slawomirmatuszak/ukrainian_geodata).
-- Existing EU NUTS 2024 and Italian administrative region searches unchanged.
create table if not exists public.network_europe2_extra_regions (
  code text primary key check (code ~ '^[A-Z0-9]{3,6}$'),
  country_code text not null check (country_code in ('CH','GB','RS','TR','UA')),
  name_latn text not null check (length(name_latn) between 1 and 140),
  reference_year integer not null,
  nuts_level smallint not null check(nuts_level between 1 and 3),
  source text not null
);
create index if not exists network_europe2_extra_regions_country_idx
  on public.network_europe2_extra_regions(country_code,code);
alter table public.network_europe2_extra_regions enable row level security;
revoke all on public.network_europe2_extra_regions from public,anon,authenticated;
insert into public.network_europe2_extra_regions
  (code,country_code,name_latn,reference_year,nuts_level,source)
values
  ('CH01','CH','Région lémanique',2024,2,'Eurostat GISCO NUTS 2024'),
  ('CH06','CH','Zentralschweiz',2024,2,'Eurostat GISCO NUTS 2024'),
  ('CH02','CH','Espace Mittelland',2024,2,'Eurostat GISCO NUTS 2024'),
  ('CH03','CH','Nordwestschweiz',2024,2,'Eurostat GISCO NUTS 2024'),
  ('CH07','CH','Ticino',2024,2,'Eurostat GISCO NUTS 2024'),
  ('CH05','CH','Ostschweiz',2024,2,'Eurostat GISCO NUTS 2024'),
  ('CH04','CH','Zürich',2024,2,'Eurostat GISCO NUTS 2024'),
  ('RS22','RS','Region Južne i Istočne Srbije',2024,2,'Eurostat GISCO NUTS 2024'),
  ('RS21','RS','Region Šumadije i Zapadne Srbije',2024,2,'Eurostat GISCO NUTS 2024'),
  ('RS11','RS','City of Belgrade',2024,2,'Eurostat GISCO NUTS 2024'),
  ('RS12','RS','Autonomous Province of Vojvodina',2024,2,'Eurostat GISCO NUTS 2024'),
  ('TR6','TR','Akdeniz',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TRC','TR','Güneydoğu Anadolu',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR3','TR','Ege',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TRB','TR','Ortadoğu Anadolu',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR5','TR','Batı Anadolu',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR7','TR','Orta Anadolu',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR4','TR','Doğu Marmara',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TRA','TR','Kuzeydoğu Anadolu',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR2','TR','Batı Marmara',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR9','TR','Doğu Karadeniz',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR8','TR','Batı Karadeniz',2024,1,'Eurostat GISCO NUTS 2024'),
  ('TR1','TR','İstanbul',2024,1,'Eurostat GISCO NUTS 2024'),
  ('GBK','GB','South West (England)',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBJ','GB','South East (England)',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBI','GB','London',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBH','GB','East of England',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBL','GB','Wales',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBG','GB','West Midlands (England)',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBF','GB','East Midlands (England)',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBE','GB','Yorkshire and the Humber',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBD','GB','North West (England)',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBN','GB','Northern Ireland',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBC','GB','North East (England)',2021,1,'Eurostat GISCO NUTS 2021'),
  ('GBM','GB','Scotland',2021,1,'Eurostat GISCO NUTS 2021'),
  ('UA01','UA','Crimea',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA02','UA','Vinnytsia',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA03','UA','Volyn',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA04','UA','Dnipropetrovsk',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA05','UA','Donetsk',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA06','UA','Zhytomyr',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA07','UA','Zakarpattia',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA08','UA','Zaporizhzhia',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA09','UA','Ivano-Frankivsk',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA10','UA','Kirovohrad',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA11','UA','Luhansk',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA12','UA','Lviv',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA13','UA','Mykolaiv',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA14','UA','Odesa',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA15','UA','Poltava',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA16','UA','Rivne',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA17','UA','Sumy',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA18','UA','Ternopil',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA19','UA','Kharkiv',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA20','UA','Khmelnytskyi',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA21','UA','Cherkasy',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA22','UA','Chernivtsi',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA23','UA','Chernihiv',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA24','UA','Kherson',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA25','UA','Kyiv Oblast',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)'),
  ('UA26','UA','Sevastopol',2020,1,'Ukrainian administrative regions (CC BY 4.0, 2020)')
on conflict (code) do update set
  country_code=excluded.country_code,
  name_latn=excluded.name_latn,
  reference_year=excluded.reference_year,
  nuts_level=excluded.nuts_level,
  source=excluded.source;

create or replace function public.net_europe2_region_coverage(
  p_organization_id uuid,p_access text,p_country text
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_country text:=upper(btrim(coalesce(p_country,'')));
  v_rows jsonb:='[]'::jsonb;
  v_mapped integer:=0;v_total integer:=0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_access='free' then
    perform private.netux11_require_active_company(p_organization_id);
  elsif p_access='pro' then
    perform private.pa1_3_require_network_access(p_organization_id);
  else
    raise exception 'Invalid access' using errcode='22023';
  end if;
  if not exists(select 1 from public.network_europe2_extra_regions r
    where r.country_code=v_country) then
    raise exception 'Unsupported country' using errcode='22023';
  end if;
  with eligible as (
    select f.company_id,f.region
    from public.network_facilities f
    join public.network_companies c on c.id=f.company_id
    where f.country_code=v_country and f.publication_status='published'
      and f.archived_at is null and c.publication_status='published'
      and c.archived_at is null
  ), mapped as (
    select distinct e.company_id,r.code
    from eligible e
    join public.network_europe2_extra_regions r on r.country_code=v_country
     and lower(btrim(coalesce(e.region,'')))=lower(btrim(r.name_latn))
  ), per_region as (
    select r.code,r.name_latn,count(distinct m.company_id)::integer company_count
    from public.network_europe2_extra_regions r
    left join mapped m on m.code=r.code
    where r.country_code=v_country
    group by r.code,r.name_latn
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object(
      'code',code,'name',name_latn,'count',company_count)
      order by name_latn,code) from per_region),'[]'::jsonb),
    (select count(distinct company_id)::integer from mapped),
    (select count(distinct company_id)::integer from eligible)
  into v_rows,v_mapped,v_total;
  return jsonb_build_object('contract','net-europe1c-coverage-v1',
    'country',v_country,'regions',v_rows,'mapped_companies',v_mapped,
    'facility_companies',v_total,'coverage_complete',false,
    'scope','published_facilities_only');
end;
$$;

create or replace function public.net_europe2_region_search(
  p_organization_id uuid,p_access text,p_country text,p_region_code text,
  p_query text default null,p_role text default null,
  p_product text default null,p_capability text default null,p_market text default null,
  p_page integer default 1,p_limit integer default 18
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_country text:=upper(btrim(coalesce(p_country,'')));
  v_code text:=upper(btrim(coalesce(p_region_code,'')));
  v_name text;
  v_count integer:=0; v_items jsonb:='[]'::jsonb;
  v_page integer:=coalesce(p_page,1);v_limit integer:=coalesce(p_limit,18);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_access='free' then
    perform private.netux11_require_active_company(p_organization_id);
  elsif p_access='pro' then
    perform private.pa1_3_require_network_access(p_organization_id);
  else
    raise exception 'Invalid access' using errcode='22023';
  end if;
  if v_page<1 or v_page>100000 or v_limit<1 or v_limit>18
    or length(coalesce(p_query,''))>120 or length(coalesce(p_role,''))>90
    or length(coalesce(p_product,''))>100 or length(coalesce(p_capability,''))>100
    or length(coalesce(p_market,''))>100
    or (nullif(p_role,'') is not null and p_role not in
      ('producer','trader_distributor','processor_service_provider','end_user'))
  then
    raise exception 'Invalid region filters' using errcode='22023';
  end if;
  select r.name_latn into v_name
  from public.network_europe2_extra_regions r
  where r.country_code=v_country and r.code=v_code;
  if v_name is null then
    raise exception 'Unsupported European region' using errcode='22023';
  end if;

  with matched_facilities as (
    select distinct on (f.company_id)
      f.company_id,f.id facility_id,f.city,f.region
    from public.network_facilities f
    where f.country_code=v_country and f.publication_status='published'
      and f.archived_at is null
      and lower(btrim(coalesce(f.region,'')))=lower(btrim(v_name))
    order by f.company_id,f.created_at,f.id
  ), eligible as (
    select c.id,c.legal_name,c.trading_name,c.country_code,c.website_url,
      c.verification_status,c.claimed_status,mf.facility_id,mf.city,mf.region
    from public.network_companies c
    join matched_facilities mf on mf.company_id=c.id
    where c.publication_status='published' and c.archived_at is null
      and (nullif(btrim(coalesce(p_query,'')),'') is null
        or strpos(lower(c.legal_name),lower(btrim(p_query)))>0
        or strpos(lower(coalesce(c.trading_name,'')),lower(btrim(p_query)))>0
        or strpos(lower(coalesce(c.website_domain,'')),lower(btrim(p_query)))>0)
      and (nullif(p_role,'') is null or exists(
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key=p_role and r.status='active'))
      and (nullif(p_product,'') is null or exists(
        select 1 from public.network_company_products cp
        join public.network_product_families pf on pf.id=cp.product_family_id
        where cp.company_id=c.id and pf.canonical_key=p_product and pf.status='active'))
      and (nullif(p_market,'') is null or exists(
        select 1 from public.network_company_markets cm
        join public.network_markets m on m.id=cm.market_id
        where cm.company_id=c.id and m.canonical_key=p_market))
      and (nullif(p_capability,'') is null or exists(
        select 1 from public.network_facility_capabilities fc
        join public.network_capabilities cap on cap.id=fc.capability_id
        where fc.facility_id=mf.facility_id and cap.canonical_key=p_capability
          and cap.status='active'))
  ), picked as (
    select * from eligible order by lower(legal_name),id
    limit v_limit offset (v_page-1)*v_limit
  )
  select (select count(*)::integer from eligible),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id',x.id,'legal_name',x.legal_name,'trading_name',x.trading_name,
      'country_code',x.country_code,'website_url',x.website_url,
      'claimed_status',x.claimed_status,'verification_status',x.verification_status,
      'location',jsonb_build_object('region',x.region,'city',x.city),
      'geography_status','published',
      'roles',coalesce((select jsonb_agg(jsonb_build_object(
        'key',cr.canonical_key,'name',cr.display_name,'is_primary',a.is_primary)
        order by a.is_primary desc,cr.display_name)
        from public.network_company_role_assignments a
        join public.network_company_roles cr on cr.id=a.role_id
        where a.company_id=x.id and cr.status='active'),'[]'::jsonb),
      'products',coalesce((select jsonb_agg(distinct pf.display_name)
        from public.network_company_products cp
        join public.network_product_families pf on pf.id=cp.product_family_id
        where cp.company_id=x.id and pf.status='active'),'[]'::jsonb),
      'capabilities',coalesce((select jsonb_agg(distinct jsonb_build_object(
        'key',cap.canonical_key,'name',cap.display_name))
        from public.network_facility_capabilities fc
        join public.network_capabilities cap on cap.id=fc.capability_id
        where fc.facility_id=x.facility_id and cap.status='active'),'[]'::jsonb)
    ) order by lower(x.legal_name),x.id) from picked x),'[]'::jsonb)
  into v_count,v_items;
  return jsonb_build_object('contract','net-europe1c-region-v1',
    'country',v_country,'region_code',v_code,'scope','published_facilities_only',
    'total',v_count,'page',v_page,'page_size',v_limit,'items',v_items);
end;
$$;

revoke all on function public.net_europe2_region_coverage(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.net_europe2_region_coverage(uuid,text,text) to authenticated;
revoke all on function public.net_europe2_region_search(
 uuid,text,text,text,text,text,text,text,text,integer,integer)
 from public,anon,authenticated;
grant execute on function public.net_europe2_region_search(
 uuid,text,text,text,text,text,text,text,text,integer,integer) to authenticated;

comment on table public.network_europe2_extra_regions is
  'Read-only sourced non-EU regional codes; not evidence of a company location.';
comment on function public.net_europe2_region_search(
 uuid,text,text,text,text,text,text,text,text,integer,integer) is
  'NET-MAP-DRILL1: tenant-guarded published-facility regional filtering outside EU.';
