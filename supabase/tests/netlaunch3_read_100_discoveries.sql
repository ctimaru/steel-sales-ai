-- NET-LAUNCH3 — bounded discovery capacity without widening authentication.
begin;
do $$
declare f text; p text; c text;
begin
  f := pg_get_functiondef('private.netfast_free_directory_impl(uuid,text,text,text,integer)'::regprocedure);
  p := pg_get_functiondef('private.netlaunch1_pro_discovery_impl(uuid,text,text,text,integer)'::regprocedure);
  c := pg_get_functiondef('private.netux11_free_directory_impl(uuid,text,text,text,integer)'::regprocedure);
  if position('limit least(greatest(coalesce(p_limit,50),1),100)' in f)=0
   or position('limit least(greatest(coalesce(p_limit,50),1),100)' in p)=0
   or position('limit least(greatest(coalesce(p_limit,50),1),100)' in c)=0
  then raise exception 'NET-LAUNCH3: 100 company bound missing'; end if;
  if position('private.netux11_require_active_company' in f)=0
    or position('private.netux11_require_active_company' in c)=0
    or position('private.pa1_3_require_network_access' in p)=0
  then raise exception 'NET-LAUNCH3: lost authorization guard'; end if;
  if has_function_privilege('anon','public.netfast_free_directory(uuid,text,text,text,integer)','EXECUTE')
     or has_function_privilege('anon','public.netlaunch1_pro_discovery(uuid,text,text,text,integer)','EXECUTE')
     or has_function_privilege('anon','public.netux11_free_directory(uuid,text,text,text,integer)','EXECUTE')
  then raise exception 'NET-LAUNCH3: anonymous reader became enabled'; end if;
end $$;
rollback;
