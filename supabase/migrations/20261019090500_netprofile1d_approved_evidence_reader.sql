-- NET-PROFILE1D: only reviewed evidence is visible in company profiles.
-- Company-facing RPC is tenant-gated; no private table access granted.
create or replace function public.netprofile1d_profile_evidence(
 p_organization_id uuid,p_company_id uuid,p_access text default 'free'
) returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v_items jsonb;
begin
 if p_access='free' then
   perform private.netux11_require_active_company(p_organization_id);
 elsif p_access='pro' then
   perform private.pa1_3_require_network_access(p_organization_id);
 else
   raise exception 'Invalid access mode' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'field_key',e.field_key,'field_value',e.field_value,
  'evidence_url',e.evidence_url,'fetched_at',e.fetched_at)
  order by e.field_key,e.fetched_at desc),'[]'::jsonb)
 into v_items
 from private.network_company_enrichment e
 where e.review_status='accepted'
   and (e.canonical_company_id=p_company_id or e.discovered_record_id=p_company_id);
 return jsonb_build_object('contract','netprofile1d-evidence-v1','items',v_items);
end $$;
revoke all on function public.netprofile1d_profile_evidence(uuid,uuid,text) from public,anon;
grant execute on function public.netprofile1d_profile_evidence(uuid,uuid,text) to authenticated;
