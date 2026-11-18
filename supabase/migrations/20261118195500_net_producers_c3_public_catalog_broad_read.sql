-- C3.DATA2.B: public buyer display of source-observed dimensions for both
-- IT/RO published producer profiles, including PDF tables that do NOT state
-- a norm for their individual size rows. Do not infer EN 10219/10217-7.
create or replace function sec1_public.netproducers_c3_pdf_public_impl(
 p_search text default '',p_limit int default 70
) returns jsonb language plpgsql stable security definer set search_path='' as $q$
declare v_items jsonb;v_count integer;v_firms integer;v_q text:=lower(trim(coalesce(p_search,'')));
begin
 if p_search is not null and length(p_search)>80
   or p_limit is null or p_limit not between 1 and 180 then
   raise exception 'PDF reader bounds' using errcode='22023';end if;
 select count(*),count(distinct r.company_id) into v_count,v_firms
 from private.network_producer_pdf_size_rows r
 join public.network_companies c on c.id=r.company_id
 where c.publication_status='published' and c.country_code in ('IT','RO')
 and c.archived_at is null and r.owner_review<>'removed'
 and exists(
  select 1 from public.network_company_role_assignments a
  join public.network_company_roles rr on rr.id=a.role_id
  where a.company_id=c.id and rr.canonical_key='producer' and rr.status='active');
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',s.id,'company_id',s.company_id,'company_name',s.legal_name,
 'standard',s.standard,'shape',s.shape,'width_mm',s.width_mm,
 'height_mm',s.height_mm,'diameter_mm',s.diameter_mm,
 'thickness_mm',s.thickness_mm,'source_page',s.page,'source_url',s.source_url,
 'review_status',case when s.owner_review='confirmed'
  then 'single_row_confirmed' else 'pending_producer_confirmation' end
 ) order by s.legal_name,s.standard,s.shape,s.width_mm,s.height_mm,s.diameter_mm),'[]'::jsonb)
 into v_items
 from (select r.*,c.legal_name
  from private.network_producer_pdf_size_rows r
  join public.network_companies c on c.id=r.company_id
  where c.publication_status='published' and c.country_code in ('IT','RO')
   and c.archived_at is null and r.owner_review<>'removed'
   and exists(select 1 from public.network_company_role_assignments a
     join public.network_company_roles rr on rr.id=a.role_id
     where a.company_id=c.id and rr.canonical_key='producer' and rr.status='active')
   and(v_q='' or position(v_q in lower(c.legal_name||' '||
   case when r.standard='CATALOGUE_UNSPECIFIED' then 'norma non specificata'
    else r.standard end||' '||r.shape||
   ' '||coalesce(r.width_mm::text||'x'||r.height_mm::text,r.diameter_mm::text,'')))>0)
  order by c.legal_name,r.standard,r.shape,r.width_mm,r.height_mm,r.diameter_mm
  limit p_limit) s;
 return jsonb_build_object('contract','netproducers-c3-pdf-public-v1',
   'count',jsonb_array_length(v_items),'total',v_count,'producers',v_firms,
   'items',v_items,'verified_manufacturer_skus',0,'mirrored_pdf_copies',0);
end;
$q$;
