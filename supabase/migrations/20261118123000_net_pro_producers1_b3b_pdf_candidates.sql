-- NET-PRO-PRODUCERS1.AUTO1.B3.B: bounded producer-authorised PDF evidence.
-- New quarantine only; no PDF web fetch, no exact-manufacturability claim.
-- The only grant remains B2's independently verified first-party PDF grant.

create table private.network_producer_catalog_pdf_candidates (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null,
  company_id uuid not null,
  document_sha256 text not null,
  source_locator text not null
    check (source_locator ~ '^pdf_page:([1-9]|1[0-5]):line:([1-9]|[1-9][0-9]{1,2})$'),
  source_page integer not null check (source_page between 1 and 15),
  source_line integer not null check (source_line between 1 and 500),
  source_line_sha256 text not null check (source_line_sha256 ~ '^[a-f0-9]{64}$'),
  standard text not null check (standard ~ '^EN10(219|210)(-[12])?$'),
  grade text not null check
    (grade ~ '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$'),
  shape text not null check (shape in ('CHS','SHS','RHS')),
  dimensions_mm jsonb not null check (jsonb_typeof(dimensions_mm)='array'),
  evidence_status text not null default 'pending_verification'
    check (evidence_status in ('pending_verification','stale')),
  extraction_method text not null default 'pypdf_layout_exact_line_v1'
    check (extraction_method='pypdf_layout_exact_line_v1'),
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (catalog_id,company_id,document_sha256)
    references private.network_producer_catalog_grants
      (catalog_id,company_id,document_sha256),
  unique (catalog_id,source_locator),
  check (source_locator=format('pdf_page:%s:line:%s',source_page,source_line))
);
create index network_producer_catalog_pdf_candidates_company
  on private.network_producer_catalog_pdf_candidates(company_id,evidence_status);

create table private.network_producer_catalog_pdf_events (
  id bigint generated always as identity primary key,
  catalog_id uuid not null
    references private.network_producer_catalog_grants(catalog_id),
  event_type text not null
    check (event_type in ('pdf_candidates_staged','pdf_candidates_staled')),
  event_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_summary)='object'),
  happened_at timestamptz not null default now()
);

create function private.netproducers1_b3b_pdf_events_immutable() returns trigger
language plpgsql set search_path='' as $body$
begin
  raise exception 'PDF audit events are immutable' using errcode='42501';
end;
$body$;
create trigger netproducers1_b3b_pdf_events_immutable
  before update or delete on private.network_producer_catalog_pdf_events
  for each row execute function private.netproducers1_b3b_pdf_events_immutable();

create function private.netproducers1_b3b_pdf_invalidate_on_revoke() returns trigger
language plpgsql security definer set search_path='' as $body$
declare v_staled integer:=0;
begin
  if old.status='approved' and new.status='revoked' then
    update private.network_producer_catalog_pdf_candidates
    set evidence_status='stale', updated_at=now()
    where catalog_id=new.catalog_id and evidence_status='pending_verification';
    get diagnostics v_staled = row_count;
    if v_staled>0 then
      insert into private.network_producer_catalog_pdf_events
        (catalog_id,event_type,event_summary)
      values(new.catalog_id,'pdf_candidates_staled',
             jsonb_build_object('count',v_staled,'reason','grant_revoked'));
    end if;
  end if;
  return new;
end;
$body$;
create trigger netproducers1_b3b_pdf_invalidate_on_revoke
  after update of status on private.network_producer_catalog_grants
  for each row execute function private.netproducers1_b3b_pdf_invalidate_on_revoke();

alter table private.network_producer_catalog_pdf_candidates enable row level security;
alter table private.network_producer_catalog_pdf_events enable row level security;
revoke all on private.network_producer_catalog_pdf_candidates
  from public,anon,authenticated,service_role;
revoke all on private.network_producer_catalog_pdf_events
  from public,anon,authenticated,service_role;

-- Narrow PDF service-only staging. The PDF bytes and grant never originate
-- in public/browser APIs. No SQL read returns technical rows to clients.
create function private.netproducers1_b3b_pdf_catalog(
  p_operation text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_grant private.network_producer_catalog_grants%rowtype;
  v_present private.network_producer_catalog_pdf_candidates%rowtype;
  v_company uuid;
  v_catalog uuid;
  v_sha text;
  v_items jsonb;
  v_item jsonb;
  v_locator text;
  v_page integer;
  v_line integer;
  v_line_sha text;
  v_standard text;
  v_grade text;
  v_shape text;
  v_dims jsonb;
  v_d1 numeric;
  v_d2 numeric;
  v_wall numeric;
  v_new integer:=0;
  v_replayed integer:=0;
  v_count integer:=0;
  v_now timestamptz:=now();
begin
  if p_operation not in ('stage','stats')
    or p_payload is null
    or jsonb_typeof(p_payload) is distinct from 'object'
    or pg_column_size(p_payload)>150000 then
    raise exception 'Invalid B3.B PDF command' using errcode='22023';
  end if;

  v_company:=(p_payload->>'company_id')::uuid;
  v_catalog:=(p_payload->>'catalog_id')::uuid;
  v_sha:=p_payload->>'sha256';
  if v_company is null or v_catalog is null
    or v_sha is null or v_sha !~ '^[a-f0-9]{64}$' then
    raise exception 'B3.B exact identity and document SHA required' using errcode='22023';
  end if;

  -- Locks serialize against B2 revocation of the same grant.
  select * into v_grant
    from private.network_producer_catalog_grants
    where catalog_id=v_catalog and company_id=v_company
      and document_sha256=v_sha for update;
  if not found or v_grant.document_format<>'pdf'
    or v_grant.status<>'approved' or v_grant.revoked_at is not null
    or v_grant.verified_at>v_now or v_grant.expires_at<=v_now
    or not (v_grant.rights @> array[
       'extract','store_derived','use_in_producer_search']::text[])
    or not exists (
      select 1 from public.network_companies c
      where c.id=v_company and c.country_code='IT'
        and c.publication_status='published' and c.archived_at is null
        and c.website_domain is not null
        and regexp_replace(lower(split_part(v_grant.source_url,'/',3)),'^www\.','')=
            regexp_replace(lower(c.website_domain),'^www\.','')
        and exists (
          select 1 from public.network_company_role_assignments a
          join public.network_company_roles r on r.id=a.role_id
          where a.company_id=c.id and r.canonical_key='producer'
            and r.status='active'
        )
    ) then
      raise exception 'B3.B requires current independently verified PDF rights'
        using errcode='42501';
  end if;

  if p_operation='stats' then
    select count(*) into v_count
    from private.network_producer_catalog_pdf_candidates c
    where c.catalog_id=v_catalog and c.company_id=v_company
      and c.document_sha256=v_sha
      and c.evidence_status='pending_verification';
    return jsonb_build_object('contract','netproducers-b3b-v1',
      'status','private_stats','pending_pdf_candidates',v_count,
      'published_claims',0);
  end if;

  if jsonb_typeof(p_payload->'candidates') is distinct from 'array' then
    raise exception 'B3.B bounded candidate array required' using errcode='22023';
  end if;
  v_items:=p_payload->'candidates';
  if jsonb_array_length(v_items)<1 or jsonb_array_length(v_items)>50 then
    raise exception 'B3.B batch must contain 1-50 rows' using errcode='22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or v_item->>'company_id' is distinct from v_company::text
      or v_item->>'catalog_id' is distinct from v_catalog::text
      or v_item->>'document_sha256' is distinct from v_sha
      or v_item->>'source_url' is distinct from v_grant.source_url
      or v_item->>'edition' is distinct from v_grant.edition
      or v_item->>'evidence_status' is distinct from 'pending_verification'
      or v_item->>'interpretation' is distinct from 'pdf_extracted_exact_line_candidate'
    then
      raise exception 'B3.B rejected cross-document PDF candidate'
        using errcode='42501';
    end if;

    v_locator:=v_item->>'source_locator';
    v_line_sha:=v_item->>'source_line_sha256';
    v_standard:=v_item->>'standard';
    v_grade:=v_item->>'grade';
    v_shape:=v_item->>'shape';
    v_dims:=v_item->'dimensions_mm';

    if v_locator is null
       or v_locator !~ '^pdf_page:([1-9]|1[0-5]):line:([1-9]|[1-9][0-9]{1,2})$'
       or jsonb_typeof(v_item->'source_page') is distinct from 'number'
       or jsonb_typeof(v_item->'source_line') is distinct from 'number'
       or (v_item->>'source_page') !~ '^[0-9]{1,2}$'
       or (v_item->>'source_line') !~ '^[0-9]{1,3}$'
       or v_line_sha is null or v_line_sha !~ '^[a-f0-9]{64}$'
       or v_standard is null or v_standard !~ '^EN10(219|210)(-[12])?$'
       or v_grade is null
       or v_grade !~ '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$'
       or v_shape is null or v_shape not in ('CHS','SHS','RHS')
       or jsonb_typeof(v_dims) is distinct from 'array'
       or jsonb_array_length(v_dims)<>(case when v_shape='CHS' then 2 else 3 end)
    then
      raise exception 'B3.B incomplete PDF technical row' using errcode='22023';
    end if;
    v_page:=(v_item->>'source_page')::integer;
    v_line:=(v_item->>'source_line')::integer;
    if v_page not between 1 and 15 or v_line not between 1 and 500
       or v_locator is distinct from
           format('pdf_page:%s:line:%s',v_page,v_line) then
      raise exception 'B3.B invalid page-line provenance' using errcode='22023';
    end if;

    if exists(
      select 1 from jsonb_array_elements(v_dims) d
      where jsonb_typeof(d.value) is distinct from 'number'
        or d.value::text !~ '^[0-9]+(\.[0-9]+)?$'
    ) then
      raise exception 'B3.B nonnumeric PDF dimensions' using errcode='22023';
    end if;
    v_d1:=(v_dims->>0)::numeric;
    v_d2:=(v_dims->>1)::numeric;
    v_wall:=(v_dims->>(case when v_shape='CHS' then 1 else 2 end))::numeric;
    if v_d1 not between 10 and 4000
      or (v_shape<>'CHS' and v_d2 not between 10 and 4000)
      or v_wall not between 0.1 and 100
      or v_wall >= (case when v_shape='CHS'
                        then v_d1 else least(v_d1,v_d2) end)/2
      or (v_shape='SHS' and v_d1<>v_d2)
      or (v_shape='RHS' and v_d1=v_d2)
    then
      raise exception 'B3.B incoherent PDF technical dimensions'
        using errcode='22023';
    end if;

    select * into v_present
    from private.network_producer_catalog_pdf_candidates c
    where c.catalog_id=v_catalog and c.source_locator=v_locator for update;
    if found then
      if v_present.company_id is distinct from v_company
        or v_present.document_sha256 is distinct from v_sha
        or v_present.source_page is distinct from v_page
        or v_present.source_line is distinct from v_line
        or v_present.source_line_sha256 is distinct from v_line_sha
        or v_present.standard is distinct from v_standard
        or v_present.grade is distinct from v_grade
        or v_present.shape is distinct from v_shape
        or v_present.dimensions_mm is distinct from v_dims
        or v_present.evidence_status<>'pending_verification' then
          raise exception 'B3.B conflicting or stale PDF row cannot be replayed'
            using errcode='42501';
      end if;
      v_replayed:=v_replayed+1;
    else
      insert into private.network_producer_catalog_pdf_candidates
        (catalog_id,company_id,document_sha256,source_locator,
         source_page,source_line,source_line_sha256,
         standard,grade,shape,dimensions_mm)
      values(v_catalog,v_company,v_sha,v_locator,v_page,v_line,v_line_sha,
             v_standard,v_grade,v_shape,v_dims)
      on conflict (catalog_id,source_locator) do nothing;
      if not found then
        raise exception 'B3.B concurrent PDF stage conflict'
          using errcode='40001';
      end if;
      v_new:=v_new+1;
    end if;
  end loop;

  if v_new>0 then
    insert into private.network_producer_catalog_pdf_events
      (catalog_id,event_type,event_summary)
    values(v_catalog,'pdf_candidates_staged',
      jsonb_build_object('added',v_new,'method','pypdf_layout_exact_line_v1'));
  end if;
  return jsonb_build_object('contract','netproducers-b3b-v1',
    'status','staged','added',v_new,'replayed',v_replayed,
    'published_claims',0,'source_verified',0,'manufacturer_confirmed',0);
end;
$body$;

create function public.netproducers1_b3b_pdf_catalog(
  p_operation text, p_payload jsonb
) returns jsonb language sql security definer set search_path=''
as $body$
  select private.netproducers1_b3b_pdf_catalog(p_operation,p_payload);
$body$;
revoke all on function private.netproducers1_b3b_pdf_catalog(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.netproducers1_b3b_pdf_catalog(text,jsonb)
  from public,anon,authenticated;
grant execute on function private.netproducers1_b3b_pdf_catalog(text,jsonb)
  to service_role;
grant execute on function public.netproducers1_b3b_pdf_catalog(text,jsonb)
  to service_role;
revoke all on function private.netproducers1_b3b_pdf_events_immutable()
  from public,anon,authenticated;
revoke all on function private.netproducers1_b3b_pdf_invalidate_on_revoke()
  from public,anon,authenticated;

-- No data migration, no upgrade of legacy link_only catalogues, no public reader.
