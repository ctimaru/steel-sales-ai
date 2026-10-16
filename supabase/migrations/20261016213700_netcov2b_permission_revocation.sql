-- NET-COV2B: immediate operator revocation of first-party website permission.
alter table public.network_netcov2b_domain_permissions
 add column if not exists revoked_by uuid references auth.users(id),
 add column if not exists revoked_reason text
  check(revoked_reason is null or length(btrim(revoked_reason)) between 15 and 1000);
create or replace function private.netcov2b_revoke_permission_impl(
 p_source_id uuid,p_domain text,p_reason text,p_attested boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare n integer;
begin
 perform private.require_platform_permission('discovery.governance_review');
 if auth.uid() is null or p_attested is distinct from true
   or length(btrim(coalesce(p_reason,''))) not between 15 and 1000
 then raise exception 'Authenticated, explained revocation required' using errcode='42501';end if;
 update public.network_netcov2b_domain_permissions p
  set revoked_at=now(),revoked_by=auth.uid(),revoked_reason=btrim(p_reason)
 where p.source_id=p_source_id
  and p.domain=lower(btrim(coalesce(p_domain,''))) and p.revoked_at is null;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Active permission not found for exact company/source' using errcode='22023';end if;
 return jsonb_build_object('status','revoked','revoked',n,'crawler_executed',false,'published',0);
end $$;
create or replace function public.netcov2b_revoke_permission(
 p_source_id uuid,p_domain text,p_reason text,p_attested boolean default false
) returns jsonb language sql security invoker set search_path=''
as 'select private.netcov2b_revoke_permission_impl(p_source_id,p_domain,p_reason,p_attested);';
revoke all on function private.netcov2b_revoke_permission_impl(uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.netcov2b_revoke_permission(uuid,text,text,boolean) from public,anon;
grant execute on function private.netcov2b_revoke_permission_impl(uuid,text,text,boolean) to authenticated;
grant execute on function public.netcov2b_revoke_permission(uuid,text,text,boolean) to authenticated;
