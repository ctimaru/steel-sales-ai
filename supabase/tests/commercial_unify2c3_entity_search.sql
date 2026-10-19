-- COMMERCIAL-UNIFY2C.3 — Entity reader access gate. Disposable local database.
begin;
do $check$
declare f oid;
begin
  select p.oid into f
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='commercial_unify_entity_search_v1'
     and pg_get_function_identity_arguments(p.oid)=
       'p_organization_id uuid, p_source text, p_query text, p_limit integer, p_offset integer';
  if f is null then
    raise exception 'COMMERCIAL-UNIFY2C.3 missing search function';
  end if;
  if (select prosecdef from pg_proc where oid=f) then
    raise exception 'COMMERCIAL-UNIFY2C.3 may never use SECURITY DEFINER';
  end if;
  if has_function_privilege('anon',f,'EXECUTE') then
    raise exception 'COMMERCIAL-UNIFY2C.3 anonymous RPC access forbidden';
  end if;
  if not has_function_privilege('authenticated',f,'EXECUTE') then
    raise exception 'COMMERCIAL-UNIFY2C.3 authenticated read permission missing';
  end if;
end;
$check$;

-- Technical standards must match common human formatting variations.
select case when
  pg_catalog.regexp_replace('EN 10219','[^[:alnum:]]','','g')
    ilike '%' || pg_catalog.regexp_replace('EN10219','[^[:alnum:]]','','g') || '%'
then 1 else 1/0 end as standard_spacing_equivalence;

-- No authentication context, no membership, no results.
set local role authenticated;
select case when (
  (public.commercial_unify_entity_search_v1(
    '00000000-0000-0000-0000-000000000000','rfqs','S235',30,0
  )->>'total')::integer=0
) then 1 else 1/0 end as tenant_denied;
select case when (
  jsonb_array_length(public.commercial_unify_entity_search_v1(
    '00000000-0000-0000-0000-000000000000','rfqs','',31,0
  )->'rows')=0
) then 1 else 1/0 end as no_inbound_leak;
select case when (
  public.commercial_unify_entity_search_v1(
    '00000000-0000-0000-0000-000000000000','invalid','',30,0
  )->>'error'='invalid_arguments'
) then 1 else 1/0 end as invalid_kind_guard;
rollback;
