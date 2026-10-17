-- NET-LAUNCH4B. Server-side page windows for the published and provisional Network.
-- Reuse existing Free/Pro access guards; keep provenance and provisional labels intact.
-- Scores are role-based discovery order only, not proof of an actual buyer/supplier.
create or replace function private.netlaunch4b_browse_page_impl(
 p_organization_id uuid, p_access text, p_source text,
 p_query text default null, p_role text default null, p_region text default null,
 p_persona text default null, p_page integer default 1, p_limit integer default 18
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
 v_total bigint:=0;
 v_items jsonb:='[]'::jsonb;
 v_page integer:=coalesce(p_page,1);
 v_limit integer:=least(greatest(coalesce(p_limit,18),1),24);
 v_priorities text[];
begin
 if p_access='free' then
  perform private.netux11_require_active_company(p_organization_id);
 elsif p_access='pro' then
  perform private.pa1_3_require_network_access(p_organization_id);
 else
  raise exception 'Invalid Network access mode' using errcode='22023';
 end if;
 if p_source is null or p_source not in ('published','unconfirmed')
    or v_page<1 or v_page>100000
    or length(coalesce(p_query,''))>120
    or length(coalesce(p_region,''))>90
    or (nullif(p_role,'') is not null and p_role not in ('producer','trader_distributor','processor_service_provider','end_user'))
    or (nullif(p_persona,'') is not null and p_persona not in ('producer','trader_distributor','processor_service_provider','end_user'))
 then raise exception 'Invalid Network page filters' using errcode='22023'; end if;
 v_priorities:=case p_persona
  when 'end_user' then array['trader_distributor','processor_service_provider','producer','end_user']
  when 'trader_distributor' then array['end_user','processor_service_provider','producer','trader_distributor']
  when 'producer' then array['trader_distributor','end_user','processor_service_provider','producer']
  when 'processor_service_provider' then array['trader_distributor','end_user','producer','processor_service_provider']
  else array['trader_distributor','processor_service_provider','producer','end_user']
 end;
 if p_source='unconfirmed' then
  with eligible as (
   select d.*,
     coalesce(array_position(v_priorities,d.role_key),5) as role_priority,
     case when d.origin='official_company_research' then 0
          when d.finished_only then 3 else 1 end as source_priority
   from private.netfast_discovered_records d
   where (nullif(btrim(coalesce(p_query,'')),'') is null
      or strpos(lower(d.company_name),lower(btrim(p_query)))>0
      or strpos(lower(d.domain),lower(btrim(p_query)))>0)
     and (nullif(p_role,'') is null or d.role_key=p_role)
     -- Do not infer geographic positions from candidate company names.
     and nullif(btrim(coalesce(p_region,'')),'') is null
  ), chosen as (
   select * from eligible
   order by role_priority,source_priority,lower(company_name),id
   limit v_limit offset (v_page-1)*v_limit
  )
  select (select count(*) from eligible),
   coalesce((select jsonb_agg(jsonb_build_object(
    'id',d.id,'legal_name',d.company_name,'trading_name',null,
    'country_code','IT','website_url',d.website_url,
    'claimed_status','unclaimed','verification_status','unverified',
    'discovery_status','unconfirmed','source_url',d.source_url,
    'origin',d.origin,'finished_only',d.finished_only,
    'roles',jsonb_build_array(jsonb_build_object(
      'key',d.role_key,'name',coalesce(
       (select r.display_name from public.network_company_roles r where r.canonical_key=d.role_key and r.status='active' limit 1),
       'Categoria indicativa'),'is_primary',true)),
    'products','[]'::jsonb,'location',null
   ) order by d.role_priority,d.source_priority,lower(d.company_name),d.id)
    from chosen d),'[]'::jsonb)
  into v_total,v_items;
 else
  with eligible as (
   select c.id,c.legal_name,c.trading_name,c.country_code,c.website_url,c.verification_status,c.claimed_status,
     coalesce((select min(array_position(v_priorities,r.canonical_key))
       from public.network_company_role_assignments a
       join public.network_company_roles r on r.id=a.role_id
       where a.company_id=c.id and r.status='active'),5) as role_priority
   from public.network_companies c
   where c.publication_status='published' and c.archived_at is null and c.country_code='IT'
    and (nullif(btrim(coalesce(p_query,'')),'') is null
      or strpos(lower(c.legal_name),lower(btrim(p_query)))>0
      or strpos(lower(coalesce(c.trading_name,'')),lower(btrim(p_query)))>0
      or strpos(lower(coalesce(c.website_domain,'')),lower(btrim(p_query)))>0)
    and (nullif(p_role,'') is null or exists (
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key=p_role))
    and (nullif(btrim(coalesce(p_region,'')),'') is null or exists (
      select 1 from public.network_facilities f where f.company_id=c.id
       and f.publication_status='published' and f.archived_at is null
       and f.country_code='IT' and lower(btrim(f.region))=lower(btrim(p_region))))
  ), chosen as (
   select * from eligible
   order by role_priority,lower(legal_name),id
   limit v_limit offset (v_page-1)*v_limit
  )
  select (select count(*) from eligible),
   coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'legal_name',c.legal_name,'trading_name',c.trading_name,
    'country_code',c.country_code,'website_url',c.website_url,
    'claimed_status',c.claimed_status,'verification_status',c.verification_status,
    'roles',coalesce((select jsonb_agg(jsonb_build_object(
      'key',r.canonical_key,'name',r.display_name,'is_primary',a.is_primary
     ) order by a.is_primary desc,r.display_name)
     from public.network_company_role_assignments a
     join public.network_company_roles r on r.id=a.role_id
     where a.company_id=c.id and r.status='active'),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(distinct pf.display_name)
     from public.network_company_products cp join public.network_product_families pf on pf.id=cp.product_family_id
     where cp.company_id=c.id and pf.status='active'),'[]'::jsonb),
    'location',(select jsonb_build_object('region',f.region,'city',f.city)
     from public.network_facilities f where f.company_id=c.id
       and f.publication_status='published' and f.archived_at is null
       and f.country_code='IT' order by f.created_at,f.id limit 1)
   ) order by c.role_priority,lower(c.legal_name),c.id)
    from chosen c),'[]'::jsonb)
  into v_total,v_items;
 end if;
 return jsonb_build_object(
  'contract','netlaunch4b-page-v1','source',p_source,'total',v_total,
  'items',v_items,'page',v_page,'page_size',v_limit,
  'has_more',v_total::bigint>v_page::bigint*v_limit::bigint
 );
end $$;

-- Minimal public API; access is verified in the private implementation on every call.
create or replace function public.netlaunch4b_browse_page(
 p_organization_id uuid, p_access text, p_source text,
 p_query text default null, p_role text default null,p_region text default null,
 p_persona text default null,p_page integer default 1,p_limit integer default 18
) returns jsonb language sql stable set search_path=''
as $$select private.netlaunch4b_browse_page_impl(
 p_organization_id,p_access,p_source,p_query,p_role,p_region,p_persona,p_page,p_limit
)$$;

revoke all on function private.netlaunch4b_browse_page_impl(uuid,text,text,text,text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer) to authenticated;
