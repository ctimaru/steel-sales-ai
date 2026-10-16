-- NETFAST1: discovery-only read with the same active-company Free gate.
create or replace function private.netfast_free_directory_impl(
 p_organization_id uuid,p_query text default null,p_role text default null,
 p_region text default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.netux11_require_active_company(p_organization_id);
 if length(coalesce(p_query,''))>120 or length(coalesce(p_region,''))>90
 or (p_role is not null and p_role not in
 ('producer','trader_distributor','processor_service_provider','end_user'))
 then raise exception 'Invalid discovery filters' using errcode='22023';end if;
 with eligible as (
 select d.* from private.netfast_discovered_records d
 where (nullif(btrim(coalesce(p_query,'')),'') is null
 or strpos(lower(d.company_name),lower(btrim(p_query)))>0
 or strpos(lower(d.domain),lower(btrim(p_query)))>0)
 and (p_role is null or d.role_key=p_role)
 and nullif(btrim(coalesce(p_region,'')),'') is null
 ), chosen as (
 select * from eligible order by created_at desc,id desc
 limit least(greatest(coalesce(p_limit,50),1),50))
 select jsonb_build_object(
 'contract','netfast-discovery-v1',
 'total',(select count(*) from eligible),
 'items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',d.id,'legal_name',d.company_name,'trading_name',null,
  'country_code','IT','website_url',d.website_url,
  'claimed_status','unclaimed','verification_status','unverified',
  'discovery_status','unconfirmed','source_url',d.source_url,
  'origin',d.origin,'finished_only',d.finished_only,
  'roles',jsonb_build_array(jsonb_build_object(
   'key',d.role_key,'name',coalesce(
    (select rr.display_name from public.network_company_roles rr
     where rr.canonical_key=d.role_key and rr.status='active' limit 1),
    'Categoria indicativa'),'is_primary',true)),
  'products','[]'::jsonb,'location',null
 ) order by d.created_at desc,d.id desc) from chosen d),'[]'::jsonb)
 ) into v;
 return v;
end $$;
create or replace function public.netfast_free_directory(
 p_organization_id uuid,p_query text default null,p_role text default null,
 p_region text default null,p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netfast_free_directory_impl(p_organization_id,p_query,p_role,p_region,p_limit);';
revoke all on function private.netfast_free_directory_impl(uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.netfast_free_directory(uuid,text,text,text,integer) from public,anon;
grant execute on function private.netfast_free_directory_impl(uuid,text,text,text,integer) to authenticated;
grant execute on function public.netfast_free_directory(uuid,text,text,text,integer) to authenticated;
