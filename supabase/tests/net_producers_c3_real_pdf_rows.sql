-- Run on a disposable migrated Supabase database. No persistent fixture mutations.
\set ON_ERROR_STOP on
begin;
do $contract$
declare v_count integer;v_facts integer;v_probe jsonb;
begin
 select count(*) into v_count from private.network_producer_pdf_size_rows;
 if v_count<>15 then raise exception 'Expected 15 real PDF source rows: %',v_count;end if;
 select count(*) into v_facts from private.network_producer_pdf_size_rows
 where shape='RHS' and standard='EN 10219' and width_mm=200
 and height_mm=100 and thickness_mm is null and owner_review='pending'
 and page=3;
 if v_facts<>1 then raise exception 'RHS 200x100 must be exact page-local source row';end if;
 if exists(select 1 from private.network_producer_pdf_size_rows
 where thickness_mm is not null) then
   raise exception 'Unproven PDF weight-column thickness was invented';end if;
 if has_table_privilege('anon','private.network_producer_pdf_size_rows','SELECT')
    or has_table_privilege('authenticated','private.network_producer_pdf_size_rows','SELECT')
 then raise exception 'Direct private PDF size data leaked';end if;
end;
$contract$;

set local role anon;
do $anonymous$
declare v jsonb;
begin
 v:=public.netproducers_c3_pdf_public('',70);
 if v->>'contract'<>'netproducers-c3-pdf-public-v1'
    or v->>'total'<>'15' or v->>'count'<>'15'
    or v->>'verified_manufacturer_skus'<>'0'
    or v->>'mirrored_pdf_copies'<>'0'
    or exists(select 1 from jsonb_array_elements(v->'items') x
      where x->>'review_status'<>'pending_producer_confirmation')
 then raise exception 'Public PDF preview promoted a capability';end if;
 if (public.netproducers_c3_pdf_public('Alessio',70)->>'count')::int<>15 then
   raise exception 'PDF company search failed';end if;
end;
$anonymous$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $noowner$
declare denied boolean:=false;
begin
 begin
 perform public.netproducers_c3_pdf_owner(
   'remove','51100000-0000-5000-8000-000000000002'::uuid,
   (select id from private.network_producer_pdf_size_rows limit 1));
 exception when sqlstate '42501' then denied:=true;
 end;
 if not denied then raise exception 'Unverified admin removed PDF factual row';end if;
end;
$noowner$;
reset role;

-- No resurrection when the source worker rediscovers a company-removed row.
do $veto$
declare v_id uuid;v_data private.network_producer_pdf_size_rows%rowtype;
v_answer jsonb;
begin
 select * into v_data from private.network_producer_pdf_size_rows
 where shape='RHS' and width_mm=200 and height_mm=100 limit 1;
 v_id:=v_data.id;
 update private.network_producer_pdf_size_rows set owner_review='removed' where id=v_id;
 v_answer:=private.netproducers_c3_pdf_stage(
 v_data.company_id,v_data.source_url,jsonb_build_array(jsonb_build_object(
   'page',v_data.page,'standard',v_data.standard,'shape',v_data.shape,
   'width_mm',v_data.width_mm,'height_mm',v_data.height_mm,
   'locator',v_data.locator,'line_sha256',v_data.line_sha256,
   'extraction_basis','pypdf_page_layout'
 )));
 if v_answer->>'replayed'<>'1' then
    raise exception 'Crawler replay inserted a duplicate PDF row';end if;
 if (select owner_review from private.network_producer_pdf_size_rows
 where id=v_id)<>'removed' then
    raise exception 'Crawler resurrected producer-removed PDF row';end if;
end;
$veto$;
rollback;
select 'C3.DATA2 PASS — 15 real PDF rows, source provenance, public read and owner veto' result;
