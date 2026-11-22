-- EU1.E2.A: independent verification of complete licensed PDF source rows.
-- Observed exact DOCUMENT tuple != manufacturer confirmation or stock.
-- Reuses B2 grant + B3.B private candidate table; no new public catalogues.
create table private.network_producer_catalog_pdf_verifications(
  candidate_row_id uuid primary key
    references private.network_producer_catalog_pdf_candidates(id),
  catalog_id uuid not null,
  company_id uuid not null,
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  source_locator text not null,
  source_line_sha256 text not null check (source_line_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_status text not null default 'source_verified'
    check(evidence_status in ('source_verified','stale')),
  verification_method text not null default 'licensed_pdf_original_line_sha_v1'
    check(verification_method='licensed_pdf_original_line_sha_v1'),
  verified_at timestamptz not null default now(),
  stale_at timestamptz,
  foreign key(catalog_id,company_id,document_sha256)
    references private.network_producer_catalog_grants(catalog_id,company_id,document_sha256),
  unique(catalog_id,source_locator),
  check((evidence_status='source_verified' and stale_at is null)
     or (evidence_status='stale' and stale_at is not null))
);
create index network_producer_catalog_pdf_vfy_company
  on private.network_producer_catalog_pdf_verifications(company_id,evidence_status);

create table private.network_producer_catalog_pdf_verification_events(
  id bigint generated always as identity primary key,
  catalog_id uuid not null references private.network_producer_catalog_grants(catalog_id),
  event_type text not null check (event_type in ('pdf_rows_source_verified','pdf_verifications_staled')),
  event_summary jsonb not null default '{}'::jsonb check(jsonb_typeof(event_summary)='object'),
  happened_at timestamptz not null default now()
);
create function private.netproducers_e2_pdf_events_immutable()
returns trigger language plpgsql set search_path='' as $body$
begin
  raise exception 'PDF verification events are append-only' using errcode='42501';
end;
$body$;
create trigger netproducers_e2_pdf_events_immutable
  before update or delete on private.network_producer_catalog_pdf_verification_events
  for each row execute function private.netproducers_e2_pdf_events_immutable();

create function private.netproducers_e2_pdf_invalidate_on_revoke()
returns trigger language plpgsql security definer set search_path='' as $body$
declare v_count integer:=0;
begin
  if old.status='approved' and new.status='revoked' then
    update private.network_producer_catalog_pdf_verifications
      set evidence_status='stale',stale_at=now()
      where catalog_id=new.catalog_id and evidence_status='source_verified';
    get diagnostics v_count = row_count;
    if v_count>0 then
      insert into private.network_producer_catalog_pdf_verification_events
        (catalog_id,event_type,event_summary)
      values(new.catalog_id,'pdf_verifications_staled',
        jsonb_build_object('staled',v_count,'reason','grant_revoked'));
    end if;
  end if;
  return new;
end;
$body$;
create trigger netproducers_e2_pdf_invalidate_on_revoke
  after update of status on private.network_producer_catalog_grants
  for each row execute function private.netproducers_e2_pdf_invalidate_on_revoke();

alter table private.network_producer_catalog_pdf_verifications enable row level security;
alter table private.network_producer_catalog_pdf_verification_events enable row level security;
revoke all on private.network_producer_catalog_pdf_verifications from public,anon,authenticated,service_role;
revoke all on private.network_producer_catalog_pdf_verification_events from public,anon,authenticated,service_role;

create function private.netproducers_e2_pdf_verify(
 p_operation text,p_payload jsonb
)
returns jsonb
language plpgsql security definer set search_path=''
as $body$
declare
 v_company uuid;
 v_catalog uuid;
 v_sha text;
 v_grant private.network_producer_catalog_grants%rowtype;
 v_row private.network_producer_catalog_pdf_candidates%rowtype;
 v_existing private.network_producer_catalog_pdf_verifications%rowtype;
 v_items jsonb;
 v_item jsonb;
 v_new integer:=0;
 v_replayed integer:=0;
 v_total integer:=0;
 v_now timestamptz:=now();
begin
  -- The private definer is never a client authorizer. Only a verified
  -- service-role claim may invoke it; table RLS remains deny-all.
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'EU1.E2 PDF verification is service-only' using errcode='42501';
  end if;
  if p_operation not in ('verify','stats') or p_payload is null
    or jsonb_typeof(p_payload) is distinct from 'object'
    or pg_column_size(p_payload)>150000 then
    raise exception 'Invalid EU1.E2 PDF operation' using errcode='22023';
  end if;
  v_company:=(p_payload->>'company_id')::uuid;
  v_catalog:=(p_payload->>'catalog_id')::uuid;
  v_sha:=p_payload->>'sha256';
  if v_company is null or v_catalog is null or v_sha !~ '^[a-f0-9]{64}$'
    or v_sha is null then
    raise exception 'Exact catalogue/company/document required' using errcode='22023';
  end if;

  -- Grant lock serializes verification against owner revocation.
  select * into v_grant from private.network_producer_catalog_grants g
  where g.catalog_id=v_catalog and g.company_id=v_company and g.document_sha256=v_sha
  for update;
  if not found or v_grant.document_format<>'pdf'
    or v_grant.status<>'approved' or v_grant.revoked_at is not null
    or v_grant.verified_at>v_now or v_grant.expires_at<=v_now
    or not (v_grant.rights @> array[
      'extract','store_derived','use_in_producer_search']::text[])
    or not exists(
      select 1 from public.network_companies c
      where c.id=v_company and c.publication_status='published'
        and c.archived_at is null
        and private.netpro1b_europe_country(c.country_code)
        and c.website_domain is not null
        and lower(regexp_replace(split_part(v_grant.source_url,'/',3),'^www[.]',''))
          =lower(regexp_replace(c.website_domain,'^www[.]',''))
        and exists(
          select 1 from public.network_company_role_assignments a
          join public.network_company_roles r on r.id=a.role_id
          where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
        )
        and exists(
          select 1 from public.network_company_products cp
          join public.network_product_families pf on pf.id=cp.product_family_id
          where cp.company_id=c.id and cp.relationship_type='produces'
            and pf.canonical_key='tubes_pipes' and pf.status='active'
        )
    ) then
    raise exception 'Active first-party licensed tube producer required' using errcode='42501';
  end if;

  if p_operation='stats' then
    select count(*) into v_total
    from private.network_producer_catalog_pdf_verifications v
    join private.network_producer_catalog_pdf_candidates c on c.id=v.candidate_row_id
    where v.catalog_id=v_catalog and v.company_id=v_company and v.document_sha256=v_sha
      and v.evidence_status='source_verified' and v.stale_at is null
      and c.evidence_status='pending_verification';
    return jsonb_build_object('contract','netproducers-e2-pdf-v1',
      'status','private_stats','source_verified',v_total,
      'manufacturer_confirmed',0,'published_claims',0);
  end if;

  if jsonb_typeof(p_payload->'rows') is distinct from 'array'
    or jsonb_array_length(p_payload->'rows') not between 1 and 50 then
    raise exception 'Bounded PDF source rows required' using errcode='22023';
  end if;
  v_items:=p_payload->'rows';
  for v_item in select value from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or v_item->>'company_id' is distinct from v_company::text
      or v_item->>'catalog_id' is distinct from v_catalog::text
      or v_item->>'document_sha256' is distinct from v_sha
      or v_item->>'source_url' is distinct from v_grant.source_url
      or v_item->>'edition' is distinct from v_grant.edition
      or v_item->>'evidence_status' is distinct from 'pending_verification'
      or v_item->>'interpretation' is distinct from 'pdf_extracted_exact_line_candidate'
      or (v_item->>'source_locator') !~ '^pdf_page:([1-9]|1[0-5]):line:([1-9]|[1-9][0-9]{1,2})$'
      or (v_item->>'source_line_sha256') !~ '^[a-f0-9]{64}$'
    then
      raise exception 'Source locator or rights mismatch' using errcode='42501';
    end if;
    select * into v_row from private.network_producer_catalog_pdf_candidates c
    where c.catalog_id=v_catalog and c.company_id=v_company
      and c.document_sha256=v_sha and c.source_locator=v_item->>'source_locator'
    for update;
    if not found or v_row.evidence_status<>'pending_verification'
      or v_row.source_page::text is distinct from v_item->>'source_page'
      or v_row.source_line::text is distinct from v_item->>'source_line'
      or v_row.source_line_sha256 is distinct from v_item->>'source_line_sha256'
      or v_row.standard is distinct from v_item->>'standard'
      or v_row.grade is distinct from v_item->>'grade'
      or v_row.shape is distinct from v_item->>'shape'
      or v_row.dimensions_mm is distinct from v_item->'dimensions_mm'
    then
      raise exception 'PDF candidate differs from original document evidence' using errcode='42501';
    end if;

    insert into private.network_producer_catalog_pdf_verifications(
      candidate_row_id,catalog_id,company_id,document_sha256,
      source_locator,source_line_sha256)
    values(v_row.id,v_catalog,v_company,v_sha,v_row.source_locator,v_row.source_line_sha256)
    on conflict(candidate_row_id) do nothing;
    if found then
      v_new:=v_new+1;
    else
      select * into v_existing from private.network_producer_catalog_pdf_verifications
      where candidate_row_id=v_row.id for update;
      if not found
        or v_existing.catalog_id is distinct from v_catalog
        or v_existing.company_id is distinct from v_company
        or v_existing.document_sha256 is distinct from v_sha
        or v_existing.source_locator is distinct from v_row.source_locator
        or v_existing.source_line_sha256 is distinct from v_row.source_line_sha256
        or v_existing.evidence_status<>'source_verified' or v_existing.stale_at is not null
      then
        raise exception 'Stale or conflicting PDF verification may not be revived' using errcode='42501';
      end if;
      v_replayed:=v_replayed+1;
    end if;
  end loop;
  if v_new>0 then
    insert into private.network_producer_catalog_pdf_verification_events
      (catalog_id,event_type,event_summary)
    values(v_catalog,'pdf_rows_source_verified',
      jsonb_build_object('verified',v_new,'method','licensed_pdf_original_line_sha_v1'));
  end if;
  return jsonb_build_object('contract','netproducers-e2-pdf-v1',
    'status','source_verified','verified',v_new,'replayed',v_replayed,
    'manufacturer_confirmed',0,'published_claims',0);
end;
$body$;

create function public.netproducers_e2_pdf_verify(p_operation text,p_payload jsonb)
returns jsonb language sql security definer set search_path=''
as $sql$
  select private.netproducers_e2_pdf_verify(p_operation,p_payload);
$sql$;

revoke all on function private.netproducers_e2_pdf_verify(text,jsonb)
 from public,anon,authenticated,service_role;
revoke all on function public.netproducers_e2_pdf_verify(text,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function private.netproducers_e2_pdf_verify(text,jsonb) to service_role;
grant execute on function public.netproducers_e2_pdf_verify(text,jsonb) to service_role;
revoke all on function private.netproducers_e2_pdf_events_immutable()
 from public,anon,authenticated,service_role;
revoke all on function private.netproducers_e2_pdf_invalidate_on_revoke()
 from public,anon,authenticated,service_role;

comment on function public.netproducers_e2_pdf_verify(text,jsonb)
 is 'Service-only documentary verification: full tuple is observed in ONE authorised PDF line; NOT confirmation of manufacturing, stock or availability.';
