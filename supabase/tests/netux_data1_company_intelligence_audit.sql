-- NET-UX DATA1: readonly, service-only full Network audit.
begin;
do $test$
declare p oid := to_regprocedure('public.netdata1_company_audit(integer,integer)');
begin
 if p is null then raise exception 'DATA1 audit RPC missing'; end if;
 if has_function_privilege('anon',p,'EXECUTE') or
    has_function_privilege('authenticated',p,'EXECUTE') or
    not has_function_privilege('service_role',p,'EXECUTE') then
    raise exception 'DATA1 source audit must only be executable by service_role';
 end if;
 if (select not prosecdef or provolatile<>'s'
      from pg_proc where oid=p) then
    raise exception 'DATA1 must be stable security definer with fixed search path';
 end if;
 if (select pg_get_functiondef(p) not like '%current_setting(''role'',true) is distinct from ''service_role''%') then
    raise exception 'DATA1 missing service role runtime enforcement';
 end if;
end $test$;
-- A service-only definer must reject a caller with anon role.
set local role service_role;
do $test$
declare j jsonb;
begin
 j:=public.netdata1_company_audit(25,0);
 if j->>'contract'<>'netux-data1-audit-v1'
    or (j->>'profiles_total')::int<>(j->>'canonical_published')::int+(j->>'discovered')::int
    or jsonb_array_length(j->'items')>25
    or j->>'scope'<>'all-visible-network-profiles-dynamic' then
    raise exception 'DATA1 bounded counts/page contract invalid';
 end if;
 if (j->>'geographic_source_coverage')::int>(j->>'profiles_total')::int
    or (j->>'capability_published')::int>(j->>'canonical_published')::int then
    raise exception 'DATA1 published/source evidence aggregates inconsistent';
 end if;
end $test$;
rollback;
