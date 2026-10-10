-- PLR2 acceptance (read-only transaction after migrations).
begin;
do $plr2$
declare
  v text;
begin
  select pg_get_functiondef(p.oid) into v from pg_proc p
    where p.oid='public.pl1_private_lab_explorer_items(uuid)'::regprocedure;
  if position('private.is_platform_superadmin()' in coalesce(v,''))=0 then
    raise exception 'Private Lab items not owner gated';
  end if;
  select pg_get_functiondef(p.oid) into v from pg_proc p
    where p.oid='public.pl1_private_lab_explorer_version(uuid)'::regprocedure;
  if position('private.is_platform_superadmin()' in coalesce(v,''))=0 then
    raise exception 'Private Lab version not owner gated';
  end if;
  if has_function_privilege('anon','public.pl1_private_lab_explorer_items(uuid)','EXECUTE') then
    raise exception 'Anon must not execute private lab items';
  end if;
  if has_function_privilege('anon','public.pl1_private_lab_explorer_version(uuid)','EXECUTE') then
    raise exception 'Anon must not execute private lab version';
  end if;
end
$plr2$;
rollback;
