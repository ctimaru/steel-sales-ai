-- NET-UX-MAP1: repair the guarded country-statistics facade.
-- The first migration used SECURITY INVOKER for a public facade whose private
-- implementation denies authenticated EXECUTE. This reviewed SECURITY DEFINER
-- wrapper preserves the tenant entitlement gates and pinned empty search_path.
do $gate$ begin
  if to_regprocedure('public.netux_map1_country_stats(uuid,text)') is null
     or to_regprocedure('private.netux_map1_country_stats_impl(uuid,text)') is null then
    raise exception 'NET-UX-MAP1 country stats functions absent; refusing ACL repair';
  end if;
end $gate$;

alter function public.netux_map1_country_stats(uuid,text) security definer;
revoke all on function private.netux_map1_country_stats_impl(uuid,text)
  from public,anon,authenticated;
revoke all on function public.netux_map1_country_stats(uuid,text)
  from public,anon;
grant execute on function public.netux_map1_country_stats(uuid,text)
  to authenticated;

comment on function public.netux_map1_country_stats(uuid,text) is
  'NET-UX-MAP1 reviewed read-only SECURITY DEFINER facade, pinned empty search_path. Private implementation checks active company membership (Free) or current Network entitlement (Pro) and rejects other modes. Only aggregate directory counts; no private Romanian research candidates or PII; anon and private implementation EXECUTE revoked.';
