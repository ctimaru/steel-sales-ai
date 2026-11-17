-- NET-PRO-PRODUCERS1.AUTO1.B2: licensed producer catalogues, private candidates.
-- Forward only, empty tables, no migration of link_only records, no PDF fetch.
-- Deploy only after B1 merge/required gate and migration-history reconciliation.

create table private.network_producer_catalog_grants (
  catalog_id uuid primary key,
  company_id uuid not null references public.network_companies(id),
  source_url text not null
    check (length(source_url) between 14 and 1200
      and source_url ~ '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/%-]+)?(\?[A-Za-z0-9._~/%=&-]+)?$'),
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  edition text not null check (length(edition) between 1 and 80),
  document_format text not null check (document_format in ('csv','pdf')),
  rights text[] not null check (
    rights @> array['extract','store_derived','use_in_producer_search']::text[]
    and cardinality(rights)=3),
  verification_method text not null
    check (verification_method in ('producer_signed_license','verified_company_authorization')),
  verification_reference text not null check (verification_reference ~ '^rights-[a-z0-9_-]{12,120}$'),
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'approved' check (status in ('approved','revoked')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (catalog_id,company_id,document_sha256),
  check (verified_at <= created_at and verified_at < expires_at),
  check ((status='approved' and revoked_at is null) or
         (status='revoked' and revoked_at is not null))
);

create table private.network_producer_catalog_candidate_rows (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null,
  company_id uuid not null,
  document_sha256 text not null,
  source_locator text not null check (source_locator ~ '^csv_row:([2-9]|[1-9][0-9]{1,2})$' or source_locator='csv_row:1000'),
  standard text not null check (standard ~ '^EN10(219|210)(-[12])?$'),
  grade text not null check (grade ~ '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$'),
  shape text not null check (shape in ('CHS','SHS','RHS')),
  dimensions_mm jsonb not null check (jsonb_typeof(dimensions_mm)='array'),
  evidence_status text not null default 'pending_verification'
    check (evidence_status in ('pending_verification','stale')),
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (catalog_id,company_id,document_sha256)
    references private.network_producer_catalog_grants(catalog_id,company_id,document_sha256),
  unique (catalog_id,source_locator)
);

create index network_producer_catalog_candidate_by_company
  on private.network_producer_catalog_candidate_rows(company_id,evidence_status);
create index network_producer_catalog_grants_by_company
  on private.network_producer_catalog_grants(company_id,status,expires_at);

-- A changed document hash at the same official URL requires explicit prior
-- revocation: two simultaneously approved versions would create false matches.
create unique index network_producer_catalog_grants_one_active_source
  on private.network_producer_catalog_grants(company_id,source_url)
  where status='approved';

create table private.network_producer_catalog_events (
  id bigint generated always as identity primary key,
  catalog_id uuid not null references private.network_producer_catalog_grants(catalog_id),
  event_type text not null check (event_type in ('grant_registered','candidate_rows_staged','grant_revoked')),
  event_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_summary)='object'),
  happened_at timestamptz not null default now()
);

-- The audit ledger is append-only, including for service-role direct operations.
create function private.netproducers1_b2_forbid_event_edit() returns trigger
language plpgsql set search_path='' as $body$
begin
  raise exception 'B2 audit events are immutable' using errcode='42501';
end;
$body$;
create trigger netproducers1_b2_events_immutable
  before update or delete on private.network_producer_catalog_events
  for each row execute function private.netproducers1_b2_forbid_event_edit();

alter table private.network_producer_catalog_grants enable row level security;
alter table private.network_producer_catalog_candidate_rows enable row level security;
alter table private.network_producer_catalog_events enable row level security;
revoke all on private.network_producer_catalog_grants from public,anon,authenticated,service_role;
revoke all on private.network_producer_catalog_candidate_rows from public,anon,authenticated,service_role;
revoke all on private.network_producer_catalog_events from public,anon,authenticated,service_role;
-- No direct read or write for service_role; use the audited service-only RPC.
-- The SECURITY DEFINER owner accesses these tables inside the guarded function.

-- One narrow service-only command endpoint. Grant evidence must be verified by
-- a trusted issuer *before* 'register'; a client-provided rights flag is not proof.
create function private.netproducers1_b2_catalog(
  p_operation text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_grant private.network_producer_catalog_grants%rowtype;
  v_company uuid;
  v_catalog uuid;
  v_sha text;
  v_url text;
  v_edition text;
  v_format text;
  v_method text;
  v_reference text;
  v_verified timestamptz;
  v_expires timestamptz;
  v_now timestamptz:=now();
  v_rights text[]:=array['extract','store_derived','use_in_producer_search'];
  v_rows jsonb;
  v_item jsonb;
  v_dims jsonb;
  v_d1 numeric; v_d2 numeric; v_wall numeric;
  v_loc text; v_norm text; v_grade text; v_shape text;
  v_current private.network_producer_catalog_candidate_rows%rowtype;
  v_added integer:=0; v_replayed integer:=0; v_staled integer:=0;
  v_reason text;
begin
  if p_operation not in ('register','get','stage','revoke')
     or p_payload is null or jsonb_typeof(p_payload)<>'object'
     or pg_column_size(p_payload)>150000 then
    raise exception 'Invalid B2 operation' using errcode='22023';
  end if;

  -- UUID casts reject malformed identities. No product becomes accessible
  -- from a link-only catalogue record.
  v_catalog:=(p_payload->>'catalog_id')::uuid;
  v_company:=(p_payload->>'company_id')::uuid;
  if v_catalog is null or v_company is null then
    raise exception 'Catalog and company are mandatory' using errcode='22023';
  end if;

  if p_operation='register' then
    v_sha:=p_payload->>'sha256';
    v_url:=p_payload->>'source_url';
    v_edition:=p_payload->>'edition';
    v_format:=p_payload->>'format';
    v_method:=p_payload->>'verification_method';
    v_reference:=p_payload->>'verification_reference';
    v_verified:=(p_payload->>'verified_at')::timestamptz;
    v_expires:=(p_payload->>'expires_at')::timestamptz;
    if v_sha is null or v_sha !~ '^[a-f0-9]{64}$'
      or v_url is null
      or v_url !~ '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/%-]+)?(\?[A-Za-z0-9._~/%=&-]+)?$'
      or length(v_url)>1200
      or length(coalesce(v_edition,'')) not between 1 and 80
      or v_format not in ('csv','pdf')
      or v_method not in ('producer_signed_license','verified_company_authorization')
      or v_reference is null or v_reference !~ '^rights-[a-z0-9_-]{12,120}$'
      or v_verified is null or v_verified>v_now
      or v_expires is null or v_expires<=v_now
      or v_expires<=v_verified or v_expires>v_now+interval '5 years'
      or jsonb_typeof(p_payload->'rights')<>'array'
      or jsonb_array_length(p_payload->'rights')<>3
      or not (p_payload->'rights' @> '["extract","store_derived","use_in_producer_search"]'::jsonb)
    then
      raise exception 'Independent, active and exact document rights required' using errcode='42501';
    end if;
    if not exists (
      select 1 from public.network_companies c
      where c.id=v_company and c.country_code='IT' and c.publication_status='published'
        and c.archived_at is null and c.website_domain is not null
        and regexp_replace(lower(split_part(v_url,'/',3)),'^www\.','') =
            regexp_replace(lower(c.website_domain),'^www\.','')
        and exists (
          select 1 from public.network_company_role_assignments a
          join public.network_company_roles r on r.id=a.role_id
          where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
        )
    ) then
      raise exception 'Canonical first-party published producer required' using errcode='42501';
    end if;
    insert into private.network_producer_catalog_grants
      (catalog_id,company_id,source_url,document_sha256,edition,document_format,
       rights,verification_method,verification_reference,verified_at,expires_at)
    values
      (v_catalog,v_company,v_url,v_sha,v_edition,v_format,v_rights,
       v_method,v_reference,v_verified,v_expires)
    on conflict (catalog_id) do nothing;
    if found then
      insert into private.network_producer_catalog_events(catalog_id,event_type)
      values (v_catalog,'grant_registered');
      return jsonb_build_object('contract','netproducers-b2-v1','status','registered',
        'catalog_id',v_catalog,'db_writes',2,'published_claims',0);
    end if;
    select * into v_grant from private.network_producer_catalog_grants
    where catalog_id=v_catalog for update;
    if v_grant.company_id is distinct from v_company
      or v_grant.source_url is distinct from v_url
      or v_grant.document_sha256 is distinct from v_sha
      or v_grant.edition is distinct from v_edition
      or v_grant.document_format is distinct from v_format
      or v_grant.verification_reference is distinct from v_reference
      or v_grant.verification_method is distinct from v_method
      or v_grant.rights is distinct from v_rights
      or v_grant.verified_at is distinct from v_verified
      or v_grant.expires_at is distinct from v_expires
      or v_grant.status<>'approved' or v_grant.revoked_at is not null
    then
      raise exception 'Catalog identity cannot be rebound or revived' using errcode='42501';
    end if;
    return jsonb_build_object('contract','netproducers-b2-v1','status','already_registered',
      'catalog_id',v_catalog,'db_writes',0,'published_claims',0);
  end if;

  select * into v_grant from private.network_producer_catalog_grants
  where catalog_id=v_catalog and company_id=v_company
  for update;
  if not found then
    raise exception 'Verified catalog not found' using errcode='42501';
  end if;

  if p_operation='revoke' then
    v_reason:=p_payload->>'reason';
    if v_reason not in ('owner_revoked','superseded','rights_expired',
                        'compliance_request','source_mismatch','other') then
      raise exception 'Revocation reason required' using errcode='22023';
    end if;
    if v_grant.status='revoked' then
      return jsonb_build_object('contract','netproducers-b2-v1','status','already_revoked',
        'catalog_id',v_catalog,'db_writes',0,'published_claims',0);
    end if;
    update private.network_producer_catalog_grants
    set status='revoked',revoked_at=v_now where catalog_id=v_catalog;
    update private.network_producer_catalog_candidate_rows
    set evidence_status='stale',updated_at=v_now
    where catalog_id=v_catalog and evidence_status='pending_verification';
    get diagnostics v_staled = row_count;
    insert into private.network_producer_catalog_events
      (catalog_id,event_type,event_summary)
    values(v_catalog,'grant_revoked',jsonb_build_object('candidate_rows_staled',v_staled,'reason',v_reason));
    return jsonb_build_object('contract','netproducers-b2-v1','status','revoked',
      'catalog_id',v_catalog,'staled',v_staled,'published_claims',0);
  end if;

  -- No candidate can be staged or disclosed from an expired/revoked grant,
  -- or after producer status/publication has changed.
  if v_grant.status<>'approved' or v_grant.revoked_at is not null
    or v_grant.expires_at<=v_now or v_grant.verified_at>v_now
    or not (v_grant.rights @> v_rights)
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
    )
  then
    raise exception 'Current verified producer rights required' using errcode='42501';
  end if;

  if p_operation='get' then
    return jsonb_build_object('contract','netproducers-b2-v1','grant',
      jsonb_build_object('catalog_id',v_catalog,'company_id',v_company,
        'source_url',v_grant.source_url,'sha256',v_grant.document_sha256,
        'edition',v_grant.edition,'format',v_grant.document_format,
        'status',v_grant.status,'rights',v_grant.rights,
        'verified_at',v_grant.verified_at,'expires_at',v_grant.expires_at,
        'revoked_at',v_grant.revoked_at));
  end if;

  if p_operation='stage' then
    if v_grant.document_format<>'csv'
      or p_payload->>'sha256' is distinct from v_grant.document_sha256
      or jsonb_typeof(p_payload->'candidates')<>'array'
      or jsonb_array_length(p_payload->'candidates')>50
    then
      raise exception 'Only bounded same-document CSV candidates may be staged' using errcode='22023';
    end if;
    v_rows:=p_payload->'candidates';
    for v_item in select value from jsonb_array_elements(v_rows) loop
      if jsonb_typeof(v_item)<>'object'
        or v_item->>'catalog_id' is distinct from v_catalog::text
        or v_item->>'company_id' is distinct from v_company::text
        or v_item->>'document_sha256' is distinct from v_grant.document_sha256
        or v_item->>'source_url' is distinct from v_grant.source_url
        or v_item->>'edition' is distinct from v_grant.edition
        or v_item->>'evidence_status' is distinct from 'pending_verification'
      then
        raise exception 'Cross-source or unverified candidate rejected' using errcode='42501';
      end if;
      v_loc:=v_item->>'source_locator';
      v_norm:=v_item->>'standard';
      v_grade:=v_item->>'grade';
      v_shape:=v_item->>'shape';
      v_dims:=v_item->'dimensions_mm';
      if v_loc is null or v_loc !~ '^csv_row:([2-9]|[1-9][0-9]{1,2})$'
        or v_norm is null or v_norm !~ '^EN10(219|210)(-[12])?$'
        or v_grade is null or v_grade !~ '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$'
        or v_shape not in ('CHS','SHS','RHS')
        or jsonb_typeof(v_dims)<>'array'
        or jsonb_array_length(v_dims)<>(case when v_shape='CHS' then 2 else 3 end)
      then
        raise exception 'Invalid source-local technical row' using errcode='22023';
      end if;
      if exists(select 1 from jsonb_array_elements(v_dims) n
                where jsonb_typeof(n.value)<>'number'
                  or n.value::text !~ '^[0-9]+(\.[0-9]+)?$') then
        raise exception 'Invalid technical dimensions' using errcode='22023';
      end if;
      v_d1:=(v_dims->>0)::numeric;
      v_d2:=(v_dims->>1)::numeric;
      v_wall:=(v_dims->>(case when v_shape='CHS' then 1 else 2 end))::numeric;
      if v_d1 not between 10 and 4000
        or (v_shape<>'CHS' and v_d2 not between 10 and 4000)
        or v_wall not between 0.1 and 100
        or v_wall >= (case when v_shape='CHS' then v_d1 else least(v_d1,v_d2) end)/2
        or (v_shape='SHS' and v_d1<>v_d2)
        or (v_shape='RHS' and v_d1=v_d2)
      then
        raise exception 'Incoherent cross-section dimensions' using errcode='22023';
      end if;
      select * into v_current
      from private.network_producer_catalog_candidate_rows
      where catalog_id=v_catalog and source_locator=v_loc for update;
      if found then
        if v_current.company_id is distinct from v_company
          or v_current.document_sha256 is distinct from v_grant.document_sha256
          or v_current.standard is distinct from v_norm
          or v_current.grade is distinct from v_grade
          or v_current.shape is distinct from v_shape
          or v_current.dimensions_mm is distinct from v_dims
          or v_current.evidence_status<>'pending_verification'
        then
          raise exception 'Conflicting or stale catalog row cannot be overwritten' using errcode='42501';
        end if;
        v_replayed:=v_replayed+1;
      else
        insert into private.network_producer_catalog_candidate_rows
          (catalog_id,company_id,document_sha256,source_locator,
           standard,grade,shape,dimensions_mm)
        values (v_catalog,v_company,v_grant.document_sha256,v_loc,
                v_norm,v_grade,v_shape,v_dims)
        on conflict (catalog_id,source_locator) do nothing;
        if found then
          v_added:=v_added+1;
        else
          raise exception 'Concurrent conflicting catalog row; retry safely' using errcode='40001';
        end if;
      end if;
    end loop;
    if v_added>0 then
      insert into private.network_producer_catalog_events(catalog_id,event_type,event_summary)
      values (v_catalog,'candidate_rows_staged',jsonb_build_object('added',v_added));
    end if;
    return jsonb_build_object('contract','netproducers-b2-v1','status','staged',
      'catalog_id',v_catalog,'added',v_added,'replayed',v_replayed,
      'published_claims',0);
  end if;
  raise exception 'Unknown B2 operation' using errcode='22023';
end;
$body$;

create function public.netproducers1_b2_catalog(p_operation text,p_payload jsonb)
returns jsonb language sql security definer set search_path=''
as $body$
  select private.netproducers1_b2_catalog(p_operation,p_payload);
$body$;

revoke all on function private.netproducers1_b2_catalog(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.netproducers1_b2_catalog(text,jsonb)
  from public,anon,authenticated;
grant execute on function private.netproducers1_b2_catalog(text,jsonb) to service_role;
grant execute on function public.netproducers1_b2_catalog(text,jsonb) to service_role;
revoke all on function private.netproducers1_b2_forbid_event_edit()
  from public,anon,authenticated;

-- No public catalogue reader, no auto-grant, no transfer from link_only,
-- no PDF extraction, no statement of current manufacturability or stock.
