-- B3.D.3: private observations; never manufacturer-confirmed.
create table private.network_producer_pdf_thickness_evidence (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.network_companies(id),
 size_row_id uuid not null references private.network_producer_pdf_size_rows(id),
 source_url text not null,
 source_page integer not null check(source_page between 1 and 100),
 document_sha256 text not null check(length(document_sha256)=64),
 geometry_sha256 text not null check(length(geometry_sha256)=64),
 thickness_mm numeric(7,2) not null check(thickness_mm between 0.1 and 100),
 steel_grade text,
 evidence_status text not null default 'pending_producer_confirmation'
  check(evidence_status='pending_producer_confirmation'),
 created_at timestamptz not null default now(),
 unique (size_row_id,document_sha256,thickness_mm)
);
alter table private.network_producer_pdf_thickness_evidence enable row level security;
revoke all on private.network_producer_pdf_thickness_evidence from public,anon,authenticated,service_role;
create index netproducers_pdf_thickness_source_idx on private.network_producer_pdf_thickness_evidence(company_id,size_row_id);

create function private.netproducers_c3_pdf_stage_geometry(
 p_company uuid,p_source text,p_document_sha text,p_candidates jsonb
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare r jsonb; parent private.network_producer_pdf_size_rows%rowtype;
 n_added int:=0;n_replay int:=0;new_id uuid;
begin
 if p_company is null or p_source is null
 or p_document_sha !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_candidates)<>'array'
 or jsonb_array_length(p_candidates) not between 1 and 30
 or pg_column_size(p_candidates)>20000 then
 raise exception 'Invalid PDF geometry batch' using errcode='22023';
 end if;
 if not exists (
  select 1 from private.network_producer_catalog_links l
  join public.network_companies c on c.id=l.company_id
  where l.company_id=p_company and l.source_url=p_source
   and l.document_type='official_pdf'
   and l.source_status='official_link_observed'
   and c.publication_status='published'
   and c.archived_at is null and c.country_code='IT'
   and lower(split_part(p_source,'/',3)) in (
    regexp_replace(lower(c.website_domain),'^www[.]',''),
    'www.'||regexp_replace(lower(c.website_domain),'^www[.]','')
   )
 ) then raise exception 'Official source missing' using errcode='42501';end if;
 for r in select value from jsonb_array_elements(p_candidates) x(value) loop
  if jsonb_typeof(r)<>'object'
   or (r->>'geometry_sha256') !~ '^[a-f0-9]{64}$'
   or (r->>'status')<>'pending_producer_confirmation'
   or (r->>'page') !~ '^[1-9][0-9]?$'
   or (r->>'thickness_mm') !~ '^[0-9]{1,3}([.][0-9]{1,2})?$'
   or (r->>'thickness_mm')::numeric not between 0.1 and 100
   or length(coalesce(r->>'source_locator','')) not between 20 and 160
   or (r->>'grade' is not null and (r->>'grade') !~ '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$')
  then raise exception 'Invalid geometry evidence' using errcode='22023';end if;
  select * into parent from private.network_producer_pdf_size_rows s
   where s.company_id=p_company and s.source_url=p_source
    and s.page=(r->>'page')::int
    and s.locator=r->>'source_locator'
    and s.standard=r->>'standard' and s.shape=r->>'shape'
    and s.owner_review<>'removed' for update;
  if not found then raise exception 'Size evidence absent or removed' using errcode='42501';end if;
  if (parent.shape='CHS' and ((r->>'diameter_mm')::numeric is distinct from parent.diameter_mm))
   or (parent.shape<>'CHS' and ((r->>'width_mm')::numeric is distinct from parent.width_mm
      or (r->>'height_mm')::numeric is distinct from parent.height_mm))
  then raise exception 'Dimension contradicts source row' using errcode='22023';end if;
  insert into private.network_producer_pdf_thickness_evidence(
    company_id,size_row_id,source_url,source_page,document_sha256,
    geometry_sha256,thickness_mm,steel_grade)
  values(p_company,parent.id,p_source,parent.page,p_document_sha,
    r->>'geometry_sha256',(r->>'thickness_mm')::numeric,r->>'grade')
  on conflict(size_row_id,document_sha256,thickness_mm) do nothing
  returning id into new_id;
  if new_id is null then n_replay:=n_replay+1;
  else n_added:=n_added+1;end if;
  new_id:=null;
 end loop;
 return jsonb_build_object('contract','netproducers-c3-geometry-stage-v1',
  'added',n_added,'replayed',n_replay,'source_verified',0,'manufacturer_confirmed',0);
end;
$fn$;
create function public.netproducers_c3_pdf_stage_geometry(
 p_company uuid,p_source text,p_document_sha text,p_candidates jsonb
) returns jsonb language sql security invoker set search_path='' as $fn$
select private.netproducers_c3_pdf_stage_geometry(p_company,p_source,p_document_sha,p_candidates);
$fn$;
revoke all on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb) to service_role;
grant execute on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb) to service_role;
