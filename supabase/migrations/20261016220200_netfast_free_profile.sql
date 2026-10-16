-- NETFAST1: provisional company detail, business facts only.
create or replace function private.netfast_free_profile_impl(
 p_organization_id uuid,p_discovery_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.netux11_require_active_company(p_organization_id);
 select jsonb_build_object(
 'contract','netfast-discovery-profile-v1',
 'company',jsonb_build_object(
  'id',d.id,'legal_name',d.company_name,'trading_name',null,
  'country_code','IT','website_url',d.website_url,'description',null,
  'claimed_status','unclaimed','verification_status','unverified',
  'discovery_status','unconfirmed'),
 'roles',jsonb_build_array(jsonb_build_object(
  'key',d.role_key,'name','Categoria indicativa','is_primary',true)),
 'products','[]'::jsonb,'facilities','[]'::jsonb,
 'source_url',d.source_url,'origin',d.origin,
 'finished_only',d.finished_only
 ) into v from private.netfast_discovered_records d where d.id=p_discovery_id;
 return v;
end $$;
create or replace function public.netfast_free_profile(
 p_organization_id uuid,p_discovery_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netfast_free_profile_impl(p_organization_id,p_discovery_id);';
revoke all on function private.netfast_free_profile_impl(uuid,uuid) from public,anon,authenticated;
revoke all on function public.netfast_free_profile(uuid,uuid) from public,anon;
grant execute on function private.netfast_free_profile_impl(uuid,uuid) to authenticated;
grant execute on function public.netfast_free_profile(uuid,uuid) to authenticated;
