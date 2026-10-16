-- NET-LAUNCH1: Pro members and Platform superadmin get the same safe
-- provisional discovery feed even when their organization has no Free link.
-- Existing Pro entitlement RPC is the sole authority. Never expose private CRM.
create or replace function private.netlaunch1_pro_discovery_impl(
 p_organization_id uuid,p_query text default null,p_role text default null,
 p_region text default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.pa1_3_require_network_access(p_organization_id);
 if length(coalesce(p_query,''))>120 or length(coalesce(p_region,''))>90
  or (p_role is not null and p_role not in
    ('producer','trader_distributor','processor_service_provider','end_user'))
 then raise exception 'Invalid Network search filters' using errcode='22023';end if;
 with eligible as(
   select d.* from private.netfast_discovered_records d
   where (nullif(btrim(coalesce(p_query,'')),'') is null
      or strpos(lower(d.company_name),lower(btrim(p_query)))>0
      or strpos(lower(d.domain),lower(btrim(p_query)))>0)
     and (p_role is null or d.role_key=p_role)
     -- Region unknown: never claim provisional company geography.
     and nullif(btrim(coalesce(p_region,'')),'') is null
 ), chosen as(
   select * from eligible order by created_at desc,id desc
   limit least(greatest(coalesce(p_limit,50),1),50))
 select jsonb_build_object(
  'contract','netlaunch1-pro-discovery-v1',
  'total',(select count(*) from eligible),
  'discovered_total',(select count(*) from eligible),
  'viewer_role',null,'regions','[]'::jsonb,
  'items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',d.id,'legal_name',d.company_name,'trading_name',null,
   'country_code','IT','website_url',d.website_url,
   'claimed_status','unclaimed','verification_status','unverified',
   'discovery_status','unconfirmed','source_url',d.source_url,
   'origin',d.origin,'finished_only',d.finished_only,
   'roles',jsonb_build_array(jsonb_build_object(
    'key',d.role_key,'name','Categoria indicativa','is_primary',true)),
   'products','[]'::jsonb,'location',null
  ) order by d.created_at desc,d.id desc) from chosen d),'[]'::jsonb)
 ) into v;
 return v;
end $$;

create or replace function private.netlaunch1_pro_profile_impl(
 p_organization_id uuid,p_discovery_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.pa1_3_require_network_access(p_organization_id);
 select jsonb_build_object(
  'contract','netfast-discovery-profile-v1',
  'company',jsonb_build_object(
    'id',d.id,'legal_name',d.company_name,'trading_name',null,
    'country_code','IT','website_url',d.website_url,'description',null,
    'claimed_status','unclaimed','verification_status','unverified',
    'discovery_status','unconfirmed'),
  'roles',jsonb_build_array(jsonb_build_object('key',d.role_key,
      'name','Categoria indicativa','is_primary',true)),
  'products','[]'::jsonb,'facilities','[]'::jsonb,
  'source_url',d.source_url,'origin',d.origin,
  'license_url',case
    when d.origin='licensed_structured_feed' then
      (select g.license_url from public.network_netfast3_entities e
         join public.network_netfast3_feed_grants g on g.source_id=e.source_id
         where e.id=d.id and g.revoked_at is null and g.expires_at>now()
         limit 1)
    when d.origin='wikidata_cc0' then 'https://www.wikidata.org/wiki/Wikidata:Licensing'
    else null end,
  'finished_only',d.finished_only)
 into v from private.netfast_discovered_records d where d.id=p_discovery_id;
 return v;
end $$;

create or replace function public.netlaunch1_pro_discovery(
 p_organization_id uuid,p_query text default null,p_role text default null,
 p_region text default null,p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netlaunch1_pro_discovery_impl(p_organization_id,p_query,p_role,p_region,p_limit);';
create or replace function public.netlaunch1_pro_profile(
 p_organization_id uuid,p_discovery_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netlaunch1_pro_profile_impl(p_organization_id,p_discovery_id);';

revoke all on function private.netlaunch1_pro_discovery_impl(uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function private.netlaunch1_pro_profile_impl(uuid,uuid) from public,anon,authenticated;
revoke all on function public.netlaunch1_pro_discovery(uuid,text,text,text,integer) from public,anon;
revoke all on function public.netlaunch1_pro_profile(uuid,uuid) from public,anon;
grant execute on function private.netlaunch1_pro_discovery_impl(uuid,text,text,text,integer) to authenticated;
grant execute on function private.netlaunch1_pro_profile_impl(uuid,uuid) to authenticated;
grant execute on function public.netlaunch1_pro_discovery(uuid,text,text,text,integer) to authenticated;
grant execute on function public.netlaunch1_pro_profile(uuid,uuid) to authenticated;
