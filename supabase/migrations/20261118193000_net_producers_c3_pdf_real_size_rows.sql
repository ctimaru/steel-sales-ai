
-- C3.DATA2.A: observable individual PDF table-size facts; not copied tables.
-- Company may hide each row. A stale crawler cannot reinsert a removed row.
create table private.network_producer_pdf_size_rows(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.network_companies(id),
 source_url text not null check(source_url ~ '^https://[^[:space:]<>]+$'),
 page integer not null check(page between 1 and 100),
 locator text not null check(length(locator) between 20 and 160),
 line_sha256 text not null check(line_sha256 ~ '^[a-f0-9]{64}$'),
 extraction_basis text not null check(extraction_basis in ('official_pdf_text_index','pypdf_page_layout')),
 standard text not null check(standard in ('EN 10219','EN 10210')),
 shape text not null check(shape in ('CHS','SHS','RHS')),
 width_mm numeric(9,2),height_mm numeric(9,2),diameter_mm numeric(9,2),
 thickness_mm numeric(7,2),
 owner_review text not null default 'pending' check(owner_review in ('pending','confirmed','removed')),
 reviewed_at timestamptz,reviewed_by uuid,created_at timestamptz not null default now(),
 unique(company_id,source_url,locator),
 check((shape='CHS' and diameter_mm between 1 and 1500 and width_mm is null and height_mm is null)
    or(shape in ('SHS','RHS') and width_mm between 1 and 1500 and height_mm between 1 and 1500 and diameter_mm is null)),
 check(shape<>'SHS' or width_mm=height_mm),
 check(thickness_mm is null or thickness_mm between 0.1 and 100)
);
alter table private.network_producer_pdf_size_rows enable row level security;
revoke all on private.network_producer_pdf_size_rows from public,anon,authenticated,service_role;
create index netproducers_c3_pdf_rows_public_idx on private.network_producer_pdf_size_rows(
 company_id,standard,shape) where owner_review<>'removed';
create table private.network_producer_pdf_row_events(
 id bigint generated always as identity primary key,
 row_id uuid not null references private.network_producer_pdf_size_rows(id),
 company_id uuid not null references public.network_companies(id),
 event text not null check(event in ('observed','confirmed','removed','restored')),
 actor_id uuid,at timestamptz not null default now()
);
alter table private.network_producer_pdf_row_events enable row level security;
revoke all on private.network_producer_pdf_row_events from public,anon,authenticated,service_role;
create function private.netproducers_c3_pdf_events_guard() returns trigger
language plpgsql set search_path='' as $q$
begin raise exception 'Immutable producer catalogue review history' using errcode='42501';end;
$q$;
create trigger netproducers_c3_pdf_events_append_only before update or delete
on private.network_producer_pdf_row_events for each row
execute function private.netproducers_c3_pdf_events_guard();

-- Service-only ingestion of short factual dimensions. The worker must supply
-- page/line hashes; source URL is checked against the real official PDF index.
create function private.netproducers_c3_pdf_stage(p_company uuid,p_source text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $q$
declare v_item jsonb;v_website text;v_id uuid;v_new int:=0;v_dupe int:=0;
v_page int;v_shape text;v_std text;v_w numeric;v_h numeric;v_d numeric;
v_locator text;
begin
 if p_company is null or p_source is null or jsonb_typeof(p_rows)<>'array'
    or jsonb_array_length(p_rows) not between 1 and 30
    or pg_column_size(p_rows)>20000 then
   raise exception 'Invalid PDF batch' using errcode='22023';end if;
 select regexp_replace(lower(c.website_domain),'^www[.]','') into v_website
 from public.network_companies c where c.id=p_company
 and c.publication_status='published' and c.country_code='IT'
 and c.archived_at is null and c.website_domain is not null
 and exists(select 1 from public.network_company_role_assignments a
 join public.network_company_roles r on r.id=a.role_id
 where a.company_id=c.id and r.canonical_key='producer' and r.status='active');
 if v_website is null or length(v_website)<4 or not exists(
   select 1 from private.network_producer_catalog_links l
   where l.company_id=p_company and l.source_url=p_source
    and l.document_type='official_pdf' and l.rights_status='link_only'
    and l.source_status='official_link_observed')
  or lower(split_part(p_source,'/',1))<>'https:'
  or not (regexp_replace(lower(split_part(p_source,'/',3)),'^www[.]','')=v_website
     or right(regexp_replace(lower(split_part(p_source,'/',3)),'^www[.]',''),
       length(v_website)+1)='.'||v_website) then
    raise exception 'Not an official published producer PDF source'
    using errcode='42501';end if;
 for v_item in select value from jsonb_array_elements(p_rows) as x(value) loop
   if jsonb_typeof(v_item)<>'object'
    or v_item->>'standard' not in ('EN 10219','EN 10210')
    or v_item->>'shape' not in ('CHS','SHS','RHS')
    or (v_item->>'page') !~ '^[1-9][0-9]?$'
    or (v_item->>'locator') !~ '^pdf_page:[1-9][0-9]?:table:(chs|rhs|shs)_en10(219|210):row:[a-zA-Z0-9x.-]+$'
    or (v_item->>'line_sha256') !~ '^[a-f0-9]{64}$'
    or v_item->>'extraction_basis' not in ('official_pdf_text_index','pypdf_page_layout')
   then raise exception 'Missing PDF page evidence' using errcode='22023';end if;
   v_page:=(v_item->>'page')::int;
   v_locator:=v_item->>'locator';
   v_shape:=v_item->>'shape';v_std:=v_item->>'standard';
   if split_part(v_locator,':',2)<>v_page::text
      or split_part(v_locator,':',4)<>lower(v_shape)||'_'||replace(lower(v_std),' ','')
   then raise exception 'Table/page/standard contradiction' using errcode='22023';end if;
   v_w:=(v_item->>'width_mm')::numeric;
   v_h:=(v_item->>'height_mm')::numeric;
   v_d:=(v_item->>'diameter_mm')::numeric;
   if (v_shape='CHS' and (v_d is null or v_w is not null or v_h is not null))
     or(v_shape<>'CHS' and(v_w is null or v_h is null or v_d is not null))
     or(v_shape='SHS' and v_w<>v_h)
     or coalesce(v_d,v_w,0) not between 1 and 1500
     or coalesce(v_d,v_h,0) not between 1 and 1500
     or v_item->>'thickness_mm' is not null then
    raise exception 'Unproven PDF dimensional row or thickness' using errcode='22023';end if;
   insert into private.network_producer_pdf_size_rows(
    company_id,source_url,page,locator,line_sha256,extraction_basis,
    standard,shape,width_mm,height_mm,diameter_mm
   ) values(p_company,p_source,v_page,v_locator,v_item->>'line_sha256',
     v_item->>'extraction_basis',v_std,v_shape,v_w,v_h,v_d)
   on conflict(company_id,source_url,locator) do nothing returning id into v_id;
   if v_id is not null then
      insert into private.network_producer_pdf_row_events(row_id,company_id,event)
       values(v_id,p_company,'observed');
      v_new:=v_new+1;
   else v_dupe:=v_dupe+1; end if;
   v_id:=null;
 end loop;
 return jsonb_build_object('contract','netproducers-c3-pdf-stage-v1',
 'added',v_new,'replayed',v_dupe,'source_verified',0,'manufacturer_confirmed',0);
end;
$q$;
create function public.netproducers_c3_pdf_stage(p_company uuid,p_source text,p_rows jsonb)
returns jsonb language sql security invoker set search_path='' as $q$
select private.netproducers_c3_pdf_stage(p_company,p_source,p_rows);
$q$;
revoke all on function private.netproducers_c3_pdf_stage(uuid,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_stage(uuid,text,jsonb)
 from public,anon,authenticated;
grant execute on function private.netproducers_c3_pdf_stage(uuid,text,jsonb) to service_role;
grant execute on function public.netproducers_c3_pdf_stage(uuid,text,jsonb) to service_role;

-- Observed first-party PDF rows: 3rd/4th physical page of the 2026 Alessio
-- catalogue (small factual canary, not a copied catalogue/table). The PDF
-- text index does NOT prove weight-column thickness alignment, hence NULL.
with first_party as (
select '51100000-0000-5000-8000-000000000002'::uuid company_id,
'https://alessiotubi.it/wp-content/uploads/2026/04/2026_04_ALESSIOTUBI_BrochureTabelle.pdf'::text source_url
), v(page,standard,shape,width_mm,height_mm,diameter_mm,line_text) as (
values
(3,'EN 10219','RHS',60,40,NULL,'60 40 5,45 6,56'),
(3,'EN 10219','RHS',100,60,NULL,'100 60 9,22 11,30 13,20 16,40 19,30'),
(3,'EN 10219','RHS',120,80,NULL,'120 80 11,7 14,4 17 21,4 25,6'),
(3,'EN 10219','RHS',200,100,NULL,'200 100 18 22,3 26,4 33,9 41,3'),
(3,'EN 10219','RHS',300,200,NULL,'300 200 38 45,2 59,1 72,70'),
(3,'EN 10219','RHS',400,250,NULL,'400 250 59,37 77,91 98,1'),
(3,'EN 10219','SHS',50,50,NULL,'50 50 5,45 6,56'),
(3,'EN 10219','SHS',100,100,NULL,'100 100 11,7 14,4 17 21,4 25,6'),
(3,'EN 10219','SHS',150,150,NULL,'150 150 18 22,3 26,4 33,9 41,3 48,7'),
(3,'EN 10219','SHS',200,200,NULL,'200 200 24,3 30,1 35,8 46,5 57'),
(3,'EN 10219','SHS',300,300,NULL,'300 300 54,7 71,6 88,4'),
(4,'EN 10219','CHS',NULL,NULL,114.3,'114,3 10,88 13,48 16,02 20,97 25,72'),
(4,'EN 10219','CHS',NULL,NULL,219.1,'219,1 21,22 26,4 31,53 41,65 51,56'),
(4,'EN 10219','CHS',NULL,NULL,323.9,'323,9 31,55 39,32 47,04 62,32 77,41'),
(4,'EN 10219','CHS',NULL,NULL,508,'508 74,28 77,94 98,65 122,81')
),seed as (
 insert into private.network_producer_pdf_size_rows(
 company_id,source_url,page,locator,line_sha256,extraction_basis,
 standard,shape,width_mm,height_mm,diameter_mm
 )
 select f.company_id,f.source_url,v.page,
 'pdf_page:'||v.page||':table:'||lower(v.shape)||'_'||
 replace(lower(v.standard),' ','')||':row:'||
 case when v.diameter_mm is not null
  then trim(trailing '.' from trim(trailing '0' from v.diameter_mm::text))
  else v.width_mm::int::text||'x'||v.height_mm::int::text end,
 encode(sha256(convert_to(v.line_text,'UTF8')),'hex'),
 'official_pdf_text_index',v.standard,v.shape,v.width_mm,v.height_mm,v.diameter_mm
 from v cross join first_party f
 where exists(select 1 from private.network_producer_catalog_links l
 where l.company_id=f.company_id and l.source_url=f.source_url
 and l.document_type='official_pdf' and l.source_status='official_link_observed')
 on conflict(company_id,source_url,locator) do nothing
 returning id,company_id
)
insert into private.network_producer_pdf_row_events(row_id,company_id,event)
select id,company_id,'observed' from seed;

-- Minimal public fact-only reader, no full document bytes/other user data.
create function sec1_public.netproducers_c3_pdf_public_impl(
 p_search text default '',p_limit int default 70
) returns jsonb language plpgsql stable security definer set search_path='' as $q$
declare v_items jsonb;v_count integer;v_firms integer;v_q text:=lower(trim(coalesce(p_search,'')));
begin
 if p_search is not null and length(p_search)>80
   or p_limit is null or p_limit not between 1 and 70 then
   raise exception 'PDF reader bounds' using errcode='22023';end if;
 select count(*),count(distinct r.company_id) into v_count,v_firms
 from private.network_producer_pdf_size_rows r
 join public.network_companies c on c.id=r.company_id
 where c.publication_status='published' and c.country_code='IT'
 and c.archived_at is null and r.owner_review<>'removed';
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
  where c.publication_status='published' and c.country_code='IT'
   and c.archived_at is null and r.owner_review<>'removed'
   and(v_q='' or position(v_q in lower(c.legal_name||' '||r.standard||' '||r.shape||
   ' '||coalesce(r.width_mm::text||'x'||r.height_mm::text,r.diameter_mm::text,'')))>0)
  order by c.legal_name,r.standard,r.shape,r.width_mm,r.height_mm,r.diameter_mm
  limit p_limit) s;
 return jsonb_build_object('contract','netproducers-c3-pdf-public-v1',
   'count',jsonb_array_length(v_items),'total',v_count,'producers',v_firms,
   'items',v_items,'verified_manufacturer_skus',0,'mirrored_pdf_copies',0);
end;
$q$;
create function public.netproducers_c3_pdf_public(p_search text default '',p_limit int default 70)
returns jsonb language sql stable security invoker set search_path='' as $q$
select sec1_public.netproducers_c3_pdf_public_impl(p_search,p_limit);
$q$;
revoke all on function sec1_public.netproducers_c3_pdf_public_impl(text,integer)
 from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_public(text,integer)
 from public,anon,authenticated;
grant execute on function sec1_public.netproducers_c3_pdf_public_impl(text,integer)
 to anon,authenticated,service_role;
grant execute on function public.netproducers_c3_pdf_public(text,integer)
 to anon,authenticated,service_role;

-- Independent verified claim + active admin: per-row veto or confirmation.
create function private.netproducers_c3_pdf_owner(
 p_action text,p_company uuid,p_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $q$
declare v_review text;v_rows jsonb;
begin
 if p_company is null
    or not private.netproducers1_b3c2_is_authorized_company_admin(p_company) then
  raise exception 'Verified producer admin required' using errcode='42501';end if;
 if p_action='list' and p_id is null then
  select coalesce(jsonb_agg(jsonb_build_object(
  'id',x.id,'standard',x.standard,'shape',x.shape,'width_mm',x.width_mm,
  'height_mm',x.height_mm,'diameter_mm',x.diameter_mm,'review_status',x.owner_review
  ) order by x.standard,x.shape,x.width_mm,x.height_mm,x.diameter_mm),'[]'::jsonb)
  into v_rows from (
   select id,standard,shape,width_mm,height_mm,diameter_mm,owner_review
   from private.network_producer_pdf_size_rows where company_id=p_company
   order by standard,shape limit 120) x;
  return jsonb_build_object('contract','netproducers-c3-pdf-owner-v1','items',v_rows);
 end if;
 if p_action not in ('confirm','remove','restore') or p_id is null then
   raise exception 'Invalid PDF owner action' using errcode='22023';end if;
 select owner_review into v_review from private.network_producer_pdf_size_rows
 where company_id=p_company and id=p_id for update;
 if not found or(p_action='confirm' and v_review='removed') then
   raise exception 'Not owned or first restore' using errcode='42501';end if;
 update private.network_producer_pdf_size_rows set
  owner_review=case p_action when 'confirm' then 'confirmed'
    when 'remove' then 'removed' else 'pending' end,
  reviewed_at=now(),reviewed_by=(select auth.uid())
 where id=p_id;
 insert into private.network_producer_pdf_row_events(row_id,company_id,actor_id,event)
 values(p_id,p_company,(select auth.uid()),
   case p_action when 'confirm' then 'confirmed'
   when 'remove' then 'removed' else 'restored' end);
 return jsonb_build_object('contract','netproducers-c3-pdf-owner-v1',
 'status',p_action,'row_id',p_id);
end;
$q$;
create function public.netproducers_c3_pdf_owner(
 p_action text,p_company uuid,p_id uuid default null
) returns jsonb language sql security invoker set search_path='' as $q$
select private.netproducers_c3_pdf_owner(p_action,p_company,p_id);
$q$;
revoke all on function private.netproducers_c3_pdf_owner(text,uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_owner(text,uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.netproducers_c3_pdf_owner(text,uuid,uuid)
 to authenticated;
grant execute on function public.netproducers_c3_pdf_owner(text,uuid,uuid)
 to authenticated;
revoke all on function private.netproducers_c3_pdf_events_guard() from public,anon,authenticated;
