-- NET-PRODUCERS DISCOVERY1 — dynamic published producer cohort, private queue,
-- no PDF-byte copies, first-party source only; local disposable DB acceptance.
\set ON_ERROR_STOP on
begin;
do $cohort$
declare
 v_expected integer;
 v_actual integer;
 v_rows integer;
begin
 select count(distinct c.id) into v_expected
 from public.network_companies c
 where c.country_code in ('IT','RO') and c.publication_status='published'
 and c.archived_at is null and c.website_domain is not null
 and c.website_domain ~* '^[a-z0-9][a-z0-9.-]{3,200}[.][a-z]{2,}$'
 and exists(select 1 from public.network_company_role_assignments a
 join public.network_company_roles r on r.id=a.role_id
 where a.company_id=c.id and r.canonical_key='producer' and r.status='active');
 select count(*) into v_actual
 from private.network_producer_catalog_discovery_queue;
 if v_expected<>v_actual then
   raise exception 'All published IT/RO producer-role leads must be in queue: % / %',v_actual,v_expected;
 end if;
 select count(*) into v_rows from private.network_producer_pdf_size_rows;
 if v_rows<>116 then
  raise exception 'Expected 116 factual PDF size rows from 4 first-party producers: %',v_rows;end if;
 if (select count(distinct company_id) from private.network_producer_pdf_size_rows)<>4 then
  raise exception 'Expected four independently attributed first-party PDF catalogues';end if;
 if (select count(*) from private.network_producer_pdf_size_rows
     where standard='CATALOGUE_UNSPECIFIED')<>72 then
  raise exception 'Unknown standards must remain UNKNOWN for Padana/CSM';end if;
 if exists(select 1 from private.network_producer_pdf_size_rows where thickness_mm is not null)
  then raise exception 'Unverified PDF weight column was misread as thickness';end if;
 if not (select relrowsecurity from pg_class
  where oid='private.network_producer_catalog_discovery_queue'::regclass)
  or has_table_privilege('anon','private.network_producer_catalog_discovery_queue','SELECT')
  or has_table_privilege('authenticated','private.network_producer_catalog_discovery_queue','SELECT')
  then raise exception 'Catalogue discovery queue leaked to browsers';end if;
 if has_function_privilege('anon','public.netproducers_catalog_discovery(text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.netproducers_catalog_discovery(text,jsonb)','EXECUTE')
 or not has_function_privilege('service_role','public.netproducers_catalog_discovery(text,jsonb)','EXECUTE')
  then raise exception 'Catalog discovery RPC role grant violated';end if;
end;
$cohort$;

set local role anon;
do $browser$
declare v jsonb;
begin
 v:=public.netproducers_c3_pdf_public('',180);
 if (v->>'total')::int<>116 or (v->>'count')::int<>116
  or (v->>'producers')::int<>4
  or v->>'verified_manufacturer_skus'<>'0'
  or v->>'mirrored_pdf_copies'<>'0'
  or exists(select 1 from jsonb_array_elements(v->'items') x
    where x->>'review_status'<>'pending_producer_confirmation')
 then raise exception 'Public dimensions do not match source-only observed contract';end if;
 if (public.netproducers_c3_pdf_public('CSM',180)->>'count')::int<>30 then
  raise exception 'CSM tube PDF numbers not searchable as individual rows';end if;
 if (public.netproducers_c3_pdf_public('Padana',180)->>'count')::int<>42 then
  raise exception 'Padana tube PDF numbers not searchable as individual rows';end if;
 if (public.netproducers_c3_pdf_public('Acciaitubi',180)->>'count')::int<>29 then
  raise exception 'Acciaitubi tube PDF numbers not searchable as individual rows';end if;
end;
$browser$;
reset role;

set local role service_role;
do $queue$
declare v jsonb;v_claim jsonb;v_one jsonb;v_complete jsonb;
begin
 v:=public.netproducers_catalog_discovery('stats','{}');
 if v->>'contract'<>'netproducers-catalog-discovery-v1' then
  raise exception 'Queue stats contract invalid';end if;
 v_claim:=public.netproducers_catalog_discovery('claim','{"limit":1}');
 if v_claim->>'count' not in ('0','1') then
  raise exception 'Discovery claim exceeds batch cap';end if;
 if v_claim->>'count'='1' then
  v_one:=v_claim->'items'->0;
  if v_one->>'lease_token' is null then
   raise exception 'Discovery claim missing lease';end if;
  v_complete:=public.netproducers_catalog_discovery('complete',
   jsonb_build_object('company_id',v_one->>'company_id',
    'lease_token',v_one->>'lease_token','status','none_found'));
  if v_complete->>'status'<>'none_found' then
   raise exception 'Lease completion failed';end if;
 end if;
end;
$queue$;
reset role;
rollback;
select 'ALL PRODUCERS PASS — 4 catalogues/116 sizes, durable IT+RO discovery, role boundary' result;
