-- NET-UX3 permission safety smoke; no writes and no real companies touched.
begin;
create or replace function pg_temp.netux3_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-UX3: %',msg; end if; end $$;

select pg_temp.netux3_assert(
  has_function_privilege('authenticated','public.netux3_geographic_backlog()','EXECUTE')
  and not has_function_privilege('anon','public.netux3_geographic_backlog()','EXECUTE'),
  'privileged backlog must reject anonymous'
);
select pg_temp.netux3_assert(
  has_function_privilege('authenticated','public.netux3_stage_official_geo(uuid,text,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.netux3_stage_official_geo(uuid,text,text,text,text)','EXECUTE'),
  'evidence staging grants'
);
select pg_temp.netux3_assert(
  has_function_privilege('authenticated','public.netux3_publish_reviewed_geo(uuid,text)','EXECUTE')
  and not has_function_privilege('anon','public.netux3_publish_reviewed_geo(uuid,text)','EXECUTE'),
  'publication grants'
);
select pg_temp.netux3_assert(
  (select relrowsecurity from pg_class where oid='public.network_it_geo_publication_ledger'::regclass),
  'publication ledger must have RLS'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare blocked boolean;
begin
 blocked:=false;
 begin perform public.netux3_geographic_backlog();
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'backlog accepted unauthorized user'; end if;
 blocked:=false;
 begin perform public.netux3_stage_official_geo('00000000-0000-0000-0000-000000000001'::uuid,'https://example.com/','Roma','Lazio','Roma Roma location on official site');
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'stage accepted unauthorized user'; end if;
 blocked:=false;
 begin perform public.netux3_publish_reviewed_geo('00000000-0000-0000-0000-000000000001'::uuid,'Explicit publish review test');
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'publish accepted unauthorized user'; end if;
end $$;
rollback;
