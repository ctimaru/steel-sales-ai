-- B3.D.3: private candidate thickness slots tied to an existing official PDF size row.
-- The source document is not copied; no manufacturer capability is certified.
create table private.network_producer_pdf_thickness_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id),
  size_row_id uuid not null references private.network_producer_pdf_size_rows(id),
  source_url text not null,
  source_page integer not null check (source_page between 1 and 100),
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  geometry_sha256 text not null check (geometry_sha256 ~ '^[a-f0-9]{64}$'),
  thickness_mm numeric(7,2) not null check (thickness_mm between 0.1 and 100),
  steel_grade text check (steel_grade is null or steel_grade ~ '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H
  evidence_status text not null default 'pending_producer_confirmation'
      check(evidence_status='pending_producer_confirmation'),
  created_at timestamptz not null default now(),
  unique (size_row_id,document_sha256,thickness_mm)
);
alter table private.network_producer_pdf_thickness_evidence enable row level security;
revoke all on private.network_producer_pdf_thickness_evidence from public,anon,authenticated,service_role;
create index netproducers_pdf_thickness_source_idx
 on private.network_producer_pdf_thickness_evidence(company_id,size_row_id);

-- This is an append-only private observation, not a verified SKU or grade.
create function private.netproducers_c3_pdf_stage_geometry(
 p_company uuid, p_source text, p_document_sha text, p_candidates jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare r jsonb; v_parent private.network_producer_pdf_size_rows%rowtype;
 v_added int:=0;v_replayed int:=0; v_id uuid;v_width text;
begin
 if p_company is null or p_source is null
    or p_document_sha !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_candidates)<>'array'
    or jsonb_array_length(p_candidates) not between 1 and 30
    or pg_column_size(p_candidates)>20000 then
    raise exception 'Invalid PDF geometry staging request' using errcode='22023';
 end if;
 if not exists(
  select 1 from private.network_producer_catalog_links l
  join public.network_companies c on c.id=l.company_id
  where l.company_id=p_company and l.source_url=p_source
    and l.document_type='official_pdf'
    and l.source_status='official_link_observed'
    and c.publication_status='published' and c.archived_at is null
    and c.website_domain is not null
    and c.country_code='IT'
    and (lower(split_part(p_source,'/',3))=
          regexp_replace(lower(c.website_domain),'^www[.]','')
      or lower(split_part(p_source,'/',3))=
          'www.'||regexp_replace(lower(c.website_domain),'^www[.]',''))
 ) then
    raise exception 'PDF source not indexed for published producer' using errcode='42501';
 end if;
 for r in select value from jsonb_array_elements(p_candidates) as e(value) loop
    if jsonb_typeof(r)<>'object'
       or r->>'geometry_sha256' !~ '^[a-f0-9]{64}$'
       or r->>'status'<>'pending_producer_confirmation'
       or (r->>'page') !~ '^[1-9][0-9]?$'
       or (r->>'thickness_mm') !~ '^\\d{1,3}([.]\\d{1,2})?$'
       or (r->>'thickness_mm')::numeric not between 0.1 and 100
       or length(coalesce(r->>'source_locator','')) not between 20 and 160
    then raise exception 'Invalid geometry candidate' using errcode='22023'; end if;
    select * into v_parent
    from private.network_producer_pdf_size_rows s
    where s.company_id=p_company and s.source_url=p_source
      and s.locator=r->>'source_locator' and s.page=(r->>'page')::int
      and s.standard=r->>'standard' and s.shape=r->>'shape'
      and s.owner_review<>'removed';
    if not found then
      raise exception 'PDF size row not found or withdrawn' using errcode='42501';
    end if;
    if (v_parent.shape='CHS'
       and (r->>'diameter_mm')::numeric is distinct from v_parent.diameter_mm)
       or (v_parent.shape<>'CHS' and (
          (r->>'width_mm')::numeric is distinct from v_parent.width_mm or
          (r->>'height_mm')::numeric is distinct from v_parent.height_mm))
    then raise exception 'PDF dimensions do not match original evidence' using errcode='22023'; end if;
    if r->>'grade' is not null and (r->>'grade') !~
       '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H
    on conflict(size_row_id,document_sha256,thickness_mm) do nothing returning id into v_id;
    if v_id is null then v_replayed:=v_replayed+1;else v_added:=v_added+1;end if;
    v_id:=null;
 end loop;
 return jsonb_build_object('contract','netproducers-c3-geometry-stage-v1',
  'added',v_added,'replayed',v_replayed,'source_verified',0,
  'manufacturer_confirmed',0);
end;
$fn$;
create function public.netproducers_c3_pdf_stage_geometry(
 p_company uuid,p_source text,p_document_sha text,p_candidates jsonb
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.netproducers_c3_pdf_stage_geometry(
   p_company,p_source,p_document_sha,p_candidates);
$fn$;
revoke all on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
grant execute on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
),
  evidence_status text not null default 'pending_producer_confirmation'
      check(evidence_status='pending_producer_confirmation'),
  created_at timestamptz not null default now(),
  unique (size_row_id,document_sha256,thickness_mm)
);
alter table private.network_producer_pdf_thickness_evidence enable row level security;
revoke all on private.network_producer_pdf_thickness_evidence from public,anon,authenticated,service_role;
create index netproducers_pdf_thickness_source_idx
 on private.network_producer_pdf_thickness_evidence(company_id,size_row_id);

-- This is an append-only private observation, not a verified SKU or grade.
create function private.netproducers_c3_pdf_stage_geometry(
 p_company uuid, p_source text, p_document_sha text, p_candidates jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare r jsonb; v_parent private.network_producer_pdf_size_rows%rowtype;
 v_added int:=0;v_replayed int:=0; v_id uuid;v_width text;
begin
 if p_company is null or p_source is null
    or p_document_sha !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_candidates)<>'array'
    or jsonb_array_length(p_candidates) not between 1 and 30
    or pg_column_size(p_candidates)>20000 then
    raise exception 'Invalid PDF geometry staging request' using errcode='22023';
 end if;
 if not exists(
  select 1 from private.network_producer_catalog_links l
  join public.network_companies c on c.id=l.company_id
  where l.company_id=p_company and l.source_url=p_source
    and l.document_type='official_pdf'
    and l.source_status='official_link_observed'
    and c.publication_status='published' and c.archived_at is null
    and c.website_domain is not null
    and c.country_code='IT'
    and (lower(split_part(p_source,'/',3))=
          regexp_replace(lower(c.website_domain),'^www[.]','')
      or lower(split_part(p_source,'/',3))=
          'www.'||regexp_replace(lower(c.website_domain),'^www[.]',''))
 ) then
    raise exception 'PDF source not indexed for published producer' using errcode='42501';
 end if;
 for r in select value from jsonb_array_elements(p_candidates) as e(value) loop
    if jsonb_typeof(r)<>'object'
       or r->>'geometry_sha256' !~ '^[a-f0-9]{64}$'
       or r->>'status'<>'pending_producer_confirmation'
       or (r->>'page') !~ '^[1-9][0-9]?$'
       or (r->>'thickness_mm') !~ '^\\d{1,3}([.]\\d{1,2})?$'
       or (r->>'thickness_mm')::numeric not between 0.1 and 100
       or length(coalesce(r->>'source_locator','')) not between 20 and 160
    then raise exception 'Invalid geometry candidate' using errcode='22023'; end if;
    select * into v_parent
    from private.network_producer_pdf_size_rows s
    where s.company_id=p_company and s.source_url=p_source
      and s.locator=r->>'source_locator' and s.page=(r->>'page')::int
      and s.standard=r->>'standard' and s.shape=r->>'shape'
      and s.owner_review<>'removed';
    if not found then
      raise exception 'PDF size row not found or withdrawn' using errcode='42501';
    end if;
    if (v_parent.shape='CHS'
       and (r->>'diameter_mm')::numeric is distinct from v_parent.diameter_mm)
       or (v_parent.shape<>'CHS' and (
          (r->>'width_mm')::numeric is distinct from v_parent.width_mm or
          (r->>'height_mm')::numeric is distinct from v_parent.height_mm))
    then raise exception 'PDF dimensions do not match original evidence' using errcode='22023'; end if;
    insert into private.network_producer_pdf_thickness_evidence(
      company_id,size_row_id,source_url,source_page,document_sha256,
      geometry_sha256,thickness_mm)
    values(p_company,v_parent.id,p_source,v_parent.page,p_document_sha,
      r->>'geometry_sha256',(r->>'thickness_mm')::numeric)
    on conflict(size_row_id,document_sha256,thickness_mm) do nothing returning id into v_id;
    if v_id is null then v_replayed:=v_replayed+1;else v_added:=v_added+1;end if;
    v_id:=null;
 end loop;
 return jsonb_build_object('contract','netproducers-c3-geometry-stage-v1',
  'added',v_added,'replayed',v_replayed,'source_verified',0,
  'manufacturer_confirmed',0);
end;
$fn$;
create function public.netproducers_c3_pdf_stage_geometry(
 p_company uuid,p_source text,p_document_sha text,p_candidates jsonb
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.netproducers_c3_pdf_stage_geometry(
   p_company,p_source,p_document_sha,p_candidates);
$fn$;
revoke all on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
grant execute on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
 then
      raise exception 'Unproven PDF grade' using errcode='22023';
    end if;
    insert into private.network_producer_pdf_thickness_evidence(
      company_id,size_row_id,source_url,source_page,document_sha256,
      geometry_sha256,thickness_mm,steel_grade)
    values(p_company,v_parent.id,p_source,v_parent.page,p_document_sha,
      r->>'geometry_sha256',(r->>'thickness_mm')::numeric,r->>'grade')
    on conflict(size_row_id,document_sha256,thickness_mm) do nothing returning id into v_id;
    if v_id is null then v_replayed:=v_replayed+1;else v_added:=v_added+1;end if;
    v_id:=null;
 end loop;
 return jsonb_build_object('contract','netproducers-c3-geometry-stage-v1',
  'added',v_added,'replayed',v_replayed,'source_verified',0,
  'manufacturer_confirmed',0);
end;
$fn$;
create function public.netproducers_c3_pdf_stage_geometry(
 p_company uuid,p_source text,p_document_sha text,p_candidates jsonb
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.netproducers_c3_pdf_stage_geometry(
   p_company,p_source,p_document_sha,p_candidates);
$fn$;
revoke all on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
grant execute on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
),
  evidence_status text not null default 'pending_producer_confirmation'
      check(evidence_status='pending_producer_confirmation'),
  created_at timestamptz not null default now(),
  unique (size_row_id,document_sha256,thickness_mm)
);
alter table private.network_producer_pdf_thickness_evidence enable row level security;
revoke all on private.network_producer_pdf_thickness_evidence from public,anon,authenticated,service_role;
create index netproducers_pdf_thickness_source_idx
 on private.network_producer_pdf_thickness_evidence(company_id,size_row_id);

-- This is an append-only private observation, not a verified SKU or grade.
create function private.netproducers_c3_pdf_stage_geometry(
 p_company uuid, p_source text, p_document_sha text, p_candidates jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare r jsonb; v_parent private.network_producer_pdf_size_rows%rowtype;
 v_added int:=0;v_replayed int:=0; v_id uuid;v_width text;
begin
 if p_company is null or p_source is null
    or p_document_sha !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_candidates)<>'array'
    or jsonb_array_length(p_candidates) not between 1 and 30
    or pg_column_size(p_candidates)>20000 then
    raise exception 'Invalid PDF geometry staging request' using errcode='22023';
 end if;
 if not exists(
  select 1 from private.network_producer_catalog_links l
  join public.network_companies c on c.id=l.company_id
  where l.company_id=p_company and l.source_url=p_source
    and l.document_type='official_pdf'
    and l.source_status='official_link_observed'
    and c.publication_status='published' and c.archived_at is null
    and c.website_domain is not null
    and c.country_code='IT'
    and (lower(split_part(p_source,'/',3))=
          regexp_replace(lower(c.website_domain),'^www[.]','')
      or lower(split_part(p_source,'/',3))=
          'www.'||regexp_replace(lower(c.website_domain),'^www[.]',''))
 ) then
    raise exception 'PDF source not indexed for published producer' using errcode='42501';
 end if;
 for r in select value from jsonb_array_elements(p_candidates) as e(value) loop
    if jsonb_typeof(r)<>'object'
       or r->>'geometry_sha256' !~ '^[a-f0-9]{64}$'
       or r->>'status'<>'pending_producer_confirmation'
       or (r->>'page') !~ '^[1-9][0-9]?$'
       or (r->>'thickness_mm') !~ '^\\d{1,3}([.]\\d{1,2})?$'
       or (r->>'thickness_mm')::numeric not between 0.1 and 100
       or length(coalesce(r->>'source_locator','')) not between 20 and 160
    then raise exception 'Invalid geometry candidate' using errcode='22023'; end if;
    select * into v_parent
    from private.network_producer_pdf_size_rows s
    where s.company_id=p_company and s.source_url=p_source
      and s.locator=r->>'source_locator' and s.page=(r->>'page')::int
      and s.standard=r->>'standard' and s.shape=r->>'shape'
      and s.owner_review<>'removed';
    if not found then
      raise exception 'PDF size row not found or withdrawn' using errcode='42501';
    end if;
    if (v_parent.shape='CHS'
       and (r->>'diameter_mm')::numeric is distinct from v_parent.diameter_mm)
       or (v_parent.shape<>'CHS' and (
          (r->>'width_mm')::numeric is distinct from v_parent.width_mm or
          (r->>'height_mm')::numeric is distinct from v_parent.height_mm))
    then raise exception 'PDF dimensions do not match original evidence' using errcode='22023'; end if;
    insert into private.network_producer_pdf_thickness_evidence(
      company_id,size_row_id,source_url,source_page,document_sha256,
      geometry_sha256,thickness_mm)
    values(p_company,v_parent.id,p_source,v_parent.page,p_document_sha,
      r->>'geometry_sha256',(r->>'thickness_mm')::numeric)
    on conflict(size_row_id,document_sha256,thickness_mm) do nothing returning id into v_id;
    if v_id is null then v_replayed:=v_replayed+1;else v_added:=v_added+1;end if;
    v_id:=null;
 end loop;
 return jsonb_build_object('contract','netproducers-c3-geometry-stage-v1',
  'added',v_added,'replayed',v_replayed,'source_verified',0,
  'manufacturer_confirmed',0);
end;
$fn$;
create function public.netproducers_c3_pdf_stage_geometry(
 p_company uuid,p_source text,p_document_sha text,p_candidates jsonb
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.netproducers_c3_pdf_stage_geometry(
   p_company,p_source,p_document_sha,p_candidates);
$fn$;
revoke all on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function private.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
grant execute on function public.netproducers_c3_pdf_stage_geometry(uuid,text,text,jsonb)
 to service_role;
