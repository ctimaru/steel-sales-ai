-- NET-PRO-PRODUCERS1.AUTO1.B3.A: documentary source-row verification.
-- No producer capability / SKU / stock publication; rights are validated by B2.
-- Apply once only after protected merge and local SQL/RLS review.

create table private.network_producer_catalog_verifications (
  candidate_row_id uuid primary key
    references private.network_producer_catalog_candidate_rows(id),
  catalog_id uuid not null,
  company_id uuid not null,
  document_sha256 text not null,
  source_locator text not null,
  evidence_status text not null default 'source_verified'
    check (evidence_status in ('source_verified','stale')),
  verification_method text not null default 'licensed_csv_exact_row_v1'
    check (verification_method='licensed_csv_exact_row_v1'),
  verified_at timestamptz not null default now(),
  stale_at timestamptz,
  check ((evidence_status='source_verified' and stale_at is null) or
         (evidence_status='stale' and stale_at is not null)),
  foreign key (catalog_id,company_id,document_sha256)
    references private.network_producer_catalog_grants
      (catalog_id,company_id,document_sha256),
  unique (catalog_id,source_locator)
);
create index network_producer_catalog_verifications_company
  on private.network_producer_catalog_verifications(company_id,evidence_status);

create table private.network_producer_catalog_verification_events (
  id bigint generated always as identity primary key,
  catalog_id uuid not null references private.network_producer_catalog_grants(catalog_id),
  event_type text not null check (event_type in ('source_rows_verified','verifications_staled')),
  event_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_summary)='object'),
  happened_at timestamptz not null default now()
);

create function private.netproducers1_b3_events_immutable() returns trigger
language plpgsql set search_path='' as $body$
begin
  raise exception 'B3 verification audit is append-only' using errcode='42501';
end;
$body$;
create trigger netproducers1_b3_events_immutable
  before update or delete on private.network_producer_catalog_verification_events
  for each row execute function private.netproducers1_b3_events_immutable();

-- Atomic invalidation during B2 revocation, without rewriting B2's service RPC.
-- Expired grants are also excluded by every read and verification RPC.
create function private.netproducers1_b3_invalidate_on_revoke() returns trigger
language plpgsql security definer set search_path='' as $body$
declare
  v_staled integer:=0;
begin
  if old.status='approved' and new.status='revoked' then
    update private.network_producer_catalog_verifications
      set evidence_status='stale', stale_at=now()
      where catalog_id=new.catalog_id and evidence_status='source_verified';
    get diagnostics v_staled = row_count;
    if v_staled>0 then
      insert into private.network_producer_catalog_verification_events
        (catalog_id,event_type,event_summary)
      values(new.catalog_id,'verifications_staled',
        jsonb_build_object('count',v_staled,'reason','grant_revoked'));
    end if;
  end if;
  return new;
end;
$body$;
create trigger netproducers1_b3_invalidate_on_revoke
  after update of status on private.network_producer_catalog_grants
  for each row execute function private.netproducers1_b3_invalidate_on_revoke();

alter table private.network_producer_catalog_verifications enable row level security;
alter table private.network_producer_catalog_verification_events enable row level security;
revoke all on private.network_producer_catalog_verifications
  from public,anon,authenticated,service_role;
revoke all on private.network_producer_catalog_verification_events
  from public,anon,authenticated,service_role;
-- Deliberate deny-all RLS; even the worker accesses via narrow service RPC.

create function private.netproducers1_b3_catalog_verify(
  p_operation text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_company uuid;
  v_catalog uuid;
  v_sha text;
  v_grant private.network_producer_catalog_grants%rowtype;
  v_row private.network_producer_catalog_candidate_rows%rowtype;
  v_existing private.network_producer_catalog_verifications%rowtype;
  v_item jsonb;
  v_rows jsonb;
  v_new integer:=0;
  v_replayed integer:=0;
  v_count integer:=0;
  v_now timestamptz:=now();
begin
  if p_operation not in ('verify','stats') or p_payload is null
    or jsonb_typeof(p_payload)<>'object'
    or pg_column_size(p_payload)>150000 then
    raise exception 'Invalid B3 operation' using errcode='22023';
  end if;
  v_company:=(p_payload->>'company_id')::uuid;
  v_catalog:=(p_payload->>'catalog_id')::uuid;
  v_sha:=p_payload->>'sha256';
  if v_company is null or v_catalog is null or v_sha is null
    or v_sha !~ '^[a-f0-9]{64}$' then
    raise exception 'B3 exact company, catalog and SHA required' using errcode='22023';
  end if;

  -- Exclusive grant row lock serialises with B2 revoke. Never auto-create grants.
  select * into v_grant from private.network_producer_catalog_grants
    where catalog_id=v_catalog and company_id=v_company
      and document_sha256=v_sha for update;
  if not found or v_grant.document_format<>'csv'
    or v_grant.status<>'approved' or v_grant.revoked_at is not null
    or v_grant.verified_at>v_now or v_grant.expires_at<=v_now
    or not (v_grant.rights @> array['extract','store_derived','use_in_producer_search']::text[])
    or not exists (
      select 1 from public.network_companies c
      where c.id=v_company and c.publication_status='published'
        and c.country_code='IT' and c.archived_at is null
        and c.website_domain is not null
        and regexp_replace(lower(split_part(v_grant.source_url,'/',3)),'^www\.','') =
            regexp_replace(lower(c.website_domain),'^www\.','')
        and exists (
          select 1 from public.network_company_role_assignments a
          join public.network_company_roles r on r.id=a.role_id
          where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
        )
    ) then
    raise exception 'Current licensed first-party producer required' using errcode='42501';
  end if;

  if p_operation='stats' then
    select count(*) into v_count
    from private.network_producer_catalog_verifications x
    join private.network_producer_catalog_candidate_rows c on c.id=x.candidate_row_id
    where x.catalog_id=v_catalog and x.company_id=v_company
      and x.document_sha256=v_sha
      and x.evidence_status='source_verified' and x.stale_at is null
      and c.evidence_status='pending_verification';
    return jsonb_build_object('contract','netproducers-b3-v1','status','private_stats',
      'active_source_verified',v_count,'published_claims',0);
  end if;

  if jsonb_typeof(p_payload->'rows')<>'array' then
    raise exception 'B3 exact candidate rows array required' using errcode='22023';
  end if;
  v_rows:=p_payload->'rows';
  if jsonb_array_length(v_rows)<1 or jsonb_array_length(v_rows)>50 then
    raise exception 'B3 candidate batch must contain 1-50 rows' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(v_rows) loop
    if jsonb_typeof(v_item)<>'object'
      or v_item->>'company_id' is distinct from v_company::text
      or v_item->>'catalog_id' is distinct from v_catalog::text
      or v_item->>'document_sha256' is distinct from v_sha
      or v_item->>'source_url' is distinct from v_grant.source_url
      or v_item->>'edition' is distinct from v_grant.edition
      or v_item->>'evidence_status' is distinct from 'pending_verification'
      or coalesce(v_item->>'source_locator','') !~ '^csv_row:([2-9]|[1-9][0-9]{1,2})$'
    then
      raise exception 'B3 cross-source or incomplete row refused' using errcode='42501';
    end if;
    select * into v_row
    from private.network_producer_catalog_candidate_rows c
    where c.catalog_id=v_catalog and c.company_id=v_company
      and c.document_sha256=v_sha
      and c.source_locator=v_item->>'source_locator'
      for update;
    if not found or v_row.evidence_status<>'pending_verification'
      or v_row.standard is distinct from v_item->>'standard'
      or v_row.grade is distinct from v_item->>'grade'
      or v_row.shape is distinct from v_item->>'shape'
      or v_row.dimensions_mm is distinct from v_item->'dimensions_mm' then
      raise exception 'B3 source row differs from quarantine' using errcode='42501';
    end if;

    insert into private.network_producer_catalog_verifications
      (candidate_row_id,catalog_id,company_id,document_sha256,source_locator)
    values(v_row.id,v_catalog,v_company,v_sha,v_row.source_locator)
    on conflict (candidate_row_id) do nothing;
    if found then
      v_new:=v_new+1;
    else
      select * into v_existing from private.network_producer_catalog_verifications
      where candidate_row_id=v_row.id for update;
      if not found
        or v_existing.catalog_id is distinct from v_catalog
        or v_existing.company_id is distinct from v_company
        or v_existing.document_sha256 is distinct from v_sha
        or v_existing.source_locator is distinct from v_row.source_locator
        or v_existing.evidence_status<>'source_verified'
        or v_existing.stale_at is not null then
        raise exception 'B3 stale or conflicting verification cannot be revived' using errcode='42501';
      end if;
      v_replayed:=v_replayed+1;
    end if;
  end loop;
  if v_new>0 then
    insert into private.network_producer_catalog_verification_events
      (catalog_id,event_type,event_summary)
    values(v_catalog,'source_rows_verified',jsonb_build_object(
      'new',v_new,'method','licensed_csv_exact_row_v1'));
  end if;
  return jsonb_build_object('contract','netproducers-b3-v1',
    'status','source_verified','verified',v_new,'replayed',v_replayed,
    'published_claims',0,'manufacturer_confirmed',0);
end;
$body$;

create function public.netproducers1_b3_catalog_verify(
  p_operation text, p_payload jsonb
) returns jsonb language sql security definer set search_path=''
as $body$
  select private.netproducers1_b3_catalog_verify(p_operation,p_payload);
$body$;

revoke all on function private.netproducers1_b3_catalog_verify(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.netproducers1_b3_catalog_verify(text,jsonb)
  from public,anon,authenticated;
grant execute on function private.netproducers1_b3_catalog_verify(text,jsonb) to service_role;
grant execute on function public.netproducers1_b3_catalog_verify(text,jsonb) to service_role;
revoke all on function private.netproducers1_b3_events_immutable()
  from public,anon,authenticated;
revoke all on function private.netproducers1_b3_invalidate_on_revoke()
  from public,anon,authenticated;

-- No B3 UI reader, PDF scraping, new SKU, or statement of manufacturability.
