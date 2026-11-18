-- NET-PRODUCERS: anonymous discovery is bounded, source-only, read-only.
\set ON_ERROR_STOP on
begin;
do $guard$
declare
  f oid;
begin
  select p.oid into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='netproducers1_catalog_observed_preview';
  if f is null or not has_function_privilege('anon',f,'EXECUTE') then
    raise exception 'Anonymous preview missing';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid=f) then
    raise exception 'Public preview facade must be SECURITY INVOKER';
  end if;
  if has_table_privilege('anon','private.network_producer_catalog_links','SELECT')
    or has_table_privilege('anon','private.network_producer_technical_claims','SELECT')
    or has_table_privilege('anon','private.network_producer_catalog_submissions','SELECT')
    or has_table_privilege('anon','private.network_producer_catalog_grants','SELECT') then
    raise exception 'Anonymous browser obtained raw private table access';
  end if;
end;
$guard$;
set local role anon;
do $public$
declare v jsonb;
begin
  v:=public.netproducers1_catalog_observed_preview('',24);
  if v->>'contract'<>'netproducers-catalog-preview-v1'
    or v->>'manufacturer_confirmed'<>'0'
    or v->>'exact_skus_verified'<>'0'
    or v->>'document_copies'<>'0'
    or jsonb_typeof(v->'items')<>'array'
    or (v->>'count')::int>24
    or exists(
       select 1 from jsonb_array_elements(v->'items') i
       where i->>'status'<>'producer_confirmation_pending'
          or i->>'source_url' not like 'https://%'
          or jsonb_array_length(i->'observations')>25
    ) then
    raise exception 'Public source-only catalogue preview contract invalid';
  end if;
  if (public.netproducers1_catalog_observed_preview('non-esiste-test',24)
      ->>'count')::int<>0 then
    raise exception 'Public catalogue substring filtering failed';
  end if;
end;
$public$;
reset role;
rollback;
select 'NET-PRODUCERS PREVIEW PASS — anon read-only metadata, no capability proofs' result;
