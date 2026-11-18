-- NET-PRO-PRODUCERS1.B3.C.1: private, rights-gated catalogue intake queue.
-- Does not issue producer licences, download third-party URLs or publish claims.
-- A separate verified-company-rights issuer must register a B2 grant first.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('producer-authorized-catalogs','producer-authorized-catalogs',false,
        8388608,array['application/pdf','text/csv']::text[])
on conflict (id) do nothing;
-- No storage.objects INSERT/SELECT policies for anon or authenticated.
-- Only a trusted server-side issuer may write immutable objects into this bucket.
-- No automatic rights from existing link_only records.

create table private.network_producer_catalog_ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null unique,
  company_id uuid not null,
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  object_bucket text not null default 'producer-authorized-catalogs'
    check (object_bucket='producer-authorized-catalogs'),
  object_path text not null unique
    check (length(object_path) between 100 and 180
      and object_path !~ '\.\.' and object_path !~ '//'),
  state text not null default 'queued'
    check (state in ('queued','leased','retry','succeeded','blocked','failed')),
  attempts int not null default 0 check (attempts between 0 and 4),
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text check (
    last_error_code is null or last_error_code in (
      'storage_missing','size_or_digest','invalid_document',
      'grant_inactive','parse_error','rpc_rejected','unexpected'
    )
  ),
  candidate_rows int check (candidate_rows between 0 and 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (catalog_id,company_id,document_sha256)
    references private.network_producer_catalog_grants
      (catalog_id,company_id,document_sha256),
  check ((state='leased' and lease_token is not null and lease_until is not null)
    or (state<>'leased' and lease_token is null and lease_until is null))
);
create index network_producer_catalog_ingest_claim_idx
  on private.network_producer_catalog_ingest_jobs(state,next_attempt_at,created_at);

create table private.network_producer_catalog_ingest_events (
  id bigint generated always as identity primary key,
  catalog_id uuid not null
    references private.network_producer_catalog_grants(catalog_id),
  event_type text not null check(event_type in
    ('enqueued','leased','processed','retry','failed','blocked')),
  event_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_summary)='object'),
  happened_at timestamptz not null default now()
);
create function private.netproducers1_b3c_forbid_event_edit()
returns trigger language plpgsql set search_path='' as $body$
begin
  raise exception 'B3.C catalog audit is immutable' using errcode='42501';
end;
$body$;
create trigger netproducers1_b3c_audit_append_only
  before update or delete on private.network_producer_catalog_ingest_events
  for each row execute function private.netproducers1_b3c_forbid_event_edit();

create function private.netproducers1_b3c_block_on_revoke()
returns trigger language plpgsql security definer set search_path='' as $body$
declare
  v_blocked integer:=0;
begin
  if old.status='approved' and new.status='revoked' then
    update private.network_producer_catalog_ingest_jobs
    set state='blocked',lease_token=null,lease_until=null,
        last_error_code='grant_inactive',updated_at=now()
    where catalog_id=new.catalog_id and state in ('queued','retry','leased');
    get diagnostics v_blocked=row_count;
    if v_blocked>0 then
      insert into private.network_producer_catalog_ingest_events
        (catalog_id,event_type,event_summary)
      values (new.catalog_id,'blocked',
              jsonb_build_object('count',v_blocked,'reason','grant_revoked'));
    end if;
  end if;
  return new;
end;
$body$;
create trigger netproducers1_b3c_block_on_revoke
  after update of status on private.network_producer_catalog_grants
  for each row execute function private.netproducers1_b3c_block_on_revoke();

alter table private.network_producer_catalog_ingest_jobs enable row level security;
alter table private.network_producer_catalog_ingest_events enable row level security;
revoke all on private.network_producer_catalog_ingest_jobs
  from public,anon,authenticated,service_role;
revoke all on private.network_producer_catalog_ingest_events
  from public,anon,authenticated,service_role;

-- SECURITY DEFINER is constrained to this narrow service_role-only RPC.
create function private.netproducers1_b3c_catalog_queue(
  p_operation text,p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $body$
declare
  v_catalog uuid;
  v_company uuid;
  v_sha text;
  v_path text;
  v_grant private.network_producer_catalog_grants%rowtype;
  v_job private.network_producer_catalog_ingest_jobs%rowtype;
  v_lease uuid;
  v_expected text;
  v_items jsonb:='[]'::jsonb;
  v_limit integer;
  v_count integer:=0;
  v_rows integer;
  v_error text;
  v_now timestamptz:=now();
begin
  if p_operation not in ('enqueue','claim','complete','fail','stats')
    or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or pg_column_size(p_payload)>150000 then
    raise exception 'Invalid catalog queue operation' using errcode='22023';
  end if;
  if p_operation='stats' then
    return jsonb_build_object(
      'contract','netproducers-b3c-queue-v1',
      'status','private_stats',
      'queued',(select count(*) from private.network_producer_catalog_ingest_jobs
        where state in ('queued','retry')),
      'succeeded',(select count(*) from private.network_producer_catalog_ingest_jobs
        where state='succeeded'),
      'blocked',(select count(*) from private.network_producer_catalog_ingest_jobs
        where state='blocked'),
      'failed',(select count(*) from private.network_producer_catalog_ingest_jobs
        where state='failed'),
      'published_claims',0);
  end if;

  if p_operation='claim' then
    if jsonb_typeof(p_payload->'limit')<>'number'
      or (p_payload->>'limit') !~ '^[1-3]$' then
      raise exception 'Queue batch limit must be 1 to 3' using errcode='22023';
    end if;
    v_limit:=(p_payload->>'limit')::int;
    for v_job in
      select j.* from private.network_producer_catalog_ingest_jobs j
      join private.network_producer_catalog_grants g
        on g.catalog_id=j.catalog_id and g.company_id=j.company_id
          and g.document_sha256=j.document_sha256
      where j.state in ('queued','retry','leased')
        and j.next_attempt_at<=v_now
        and (j.state<>'leased' or j.lease_until<v_now)
        and j.attempts<4
        and g.status='approved' and g.revoked_at is null
        and g.verified_at<=v_now and g.expires_at>v_now
        and g.rights @> array['extract','store_derived',
                              'use_in_producer_search']::text[]
        and exists (
          select 1 from public.network_companies c
          where c.id=j.company_id and c.country_code='IT'
            and c.publication_status='published' and c.archived_at is null
            and c.website_domain is not null
            and regexp_replace(lower(split_part(g.source_url,'/',3)),'^www\.','')=
                regexp_replace(lower(c.website_domain),'^www\.','')
            and exists (
              select 1 from public.network_company_role_assignments a
              join public.network_company_roles r on r.id=a.role_id
              where a.company_id=c.id and r.canonical_key='producer'
                and r.status='active'
            )
        )
      order by j.next_attempt_at,j.created_at
      for update of j skip locked
      limit v_limit
    loop
      v_lease:=gen_random_uuid();
      update private.network_producer_catalog_ingest_jobs
        set state='leased',lease_token=v_lease,lease_until=v_now+interval '10 minutes',
            attempts=attempts+1,updated_at=v_now
        where id=v_job.id;
      insert into private.network_producer_catalog_ingest_events
        (catalog_id,event_type,event_summary)
      values (v_job.catalog_id,'leased',
              jsonb_build_object('attempt',v_job.attempts+1));
      select * into v_grant from private.network_producer_catalog_grants
        where catalog_id=v_job.catalog_id;
      v_items:=v_items || jsonb_build_array(jsonb_build_object(
        'job_id',v_job.id,'lease_token',v_lease,
        'catalog_id',v_job.catalog_id,'company_id',v_job.company_id,
        'sha256',v_job.document_sha256,'source_url',v_grant.source_url,
        'edition',v_grant.edition,'format',v_grant.document_format,
        'object_bucket',v_job.object_bucket,'object_path',v_job.object_path
      ));
      v_count:=v_count+1;
    end loop;
    return jsonb_build_object('contract','netproducers-b3c-queue-v1',
      'status','claimed','count',v_count,'items',v_items,'published_claims',0);
  end if;

  v_catalog:=(p_payload->>'catalog_id')::uuid;
  v_company:=(p_payload->>'company_id')::uuid;
  if v_catalog is null or v_company is null then
    raise exception 'Catalog and canonical producer required' using errcode='22023';
  end if;
  -- Lock grant and job in consistent order. Revocation takes the grant lock,
  -- so it cannot race with active queue state changes.
  select * into v_grant
    from private.network_producer_catalog_grants
    where catalog_id=v_catalog and company_id=v_company for update;
  if not found then
    raise exception 'Independent catalogue licence missing' using errcode='42501';
  end if;

  if p_operation='enqueue' then
    v_sha:=p_payload->>'sha256';
    v_path:=p_payload->>'object_path';
    v_expected:=v_company::text||'/'||v_catalog::text||'/'||
        v_grant.document_sha256||'.'||v_grant.document_format;
    if v_sha is distinct from v_grant.document_sha256
      or v_path is distinct from v_expected
      or v_grant.status<>'approved' or v_grant.revoked_at is not null
      or v_grant.expires_at<=v_now or v_grant.verified_at>v_now
      or not (v_grant.rights @> array[
       'extract','store_derived','use_in_producer_search']::text[])
      or not exists(
        select 1 from storage.objects o
        where o.bucket_id='producer-authorized-catalogs'
          and o.name=v_path
          and coalesce((o.metadata->>'size')::bigint,8388609)
              between 1 and (case when v_grant.document_format='pdf'
                                 then 8388608 else 2097152 end)
      )
      or not exists(
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
      )
    then
      raise exception 'Verified grant, immutable private object and producer required'
        using errcode='42501';
    end if;
    insert into private.network_producer_catalog_ingest_jobs
      (catalog_id,company_id,document_sha256,object_path)
    values(v_catalog,v_company,v_sha,v_path)
    on conflict(catalog_id) do nothing;
    if found then
      insert into private.network_producer_catalog_ingest_events
        (catalog_id,event_type) values(v_catalog,'enqueued');
      return jsonb_build_object('contract','netproducers-b3c-queue-v1',
        'status','enqueued','published_claims',0);
    end if;
    select * into v_job from private.network_producer_catalog_ingest_jobs
      where catalog_id=v_catalog for update;
    if not found or v_job.company_id is distinct from v_company
      or v_job.document_sha256 is distinct from v_sha
      or v_job.object_path is distinct from v_path then
      raise exception 'Catalogue job identity cannot be rebound' using errcode='42501';
    end if;
    return jsonb_build_object('contract','netproducers-b3c-queue-v1',
      'status','already_enqueued','published_claims',0);
  end if;

  select * into v_job from private.network_producer_catalog_ingest_jobs
  where catalog_id=v_catalog and company_id=v_company for update;
  if not found or v_job.state<>'leased'
    or v_job.lease_token is distinct from (p_payload->>'lease_token')::uuid
    or v_job.lease_until<=v_now then
    raise exception 'Missing or expired catalogue job lease' using errcode='42501';
  end if;

  if p_operation='complete' then
    v_rows:=(p_payload->>'candidate_rows')::integer;
    if v_rows is null or v_rows not between 0 and 500
      or v_grant.status<>'approved' or v_grant.revoked_at is not null
      or v_grant.verified_at>v_now or v_grant.expires_at<=v_now then
      raise exception 'Current rights and verified candidate count required'
        using errcode='42501';
    end if;
    -- If the parser failed before writing, the worker MUST call fail, not complete.
    update private.network_producer_catalog_ingest_jobs
    set state='succeeded',candidate_rows=v_rows,completed_at=v_now,
        lease_token=null,lease_until=null,updated_at=v_now,
        last_error_code=null
    where id=v_job.id;
    insert into private.network_producer_catalog_ingest_events
      (catalog_id,event_type,event_summary)
    values(v_catalog,'processed',jsonb_build_object(
      'candidate_rows',v_rows,'format',v_grant.document_format));
    return jsonb_build_object('contract','netproducers-b3c-queue-v1',
      'status','completed','published_claims',0);
  end if;

  if p_operation='fail' then
    v_error:=p_payload->>'error_code';
    if v_error not in ('storage_missing','size_or_digest','invalid_document',
      'grant_inactive','parse_error','rpc_rejected','unexpected') then
      raise exception 'Opaque bounded failure code required' using errcode='22023';
    end if;
    update private.network_producer_catalog_ingest_jobs
      set state=case when v_error='grant_inactive' then 'blocked'
                     when attempts>=4 then 'failed' else 'retry' end,
          last_error_code=v_error,lease_token=null,lease_until=null,
          next_attempt_at=v_now+(interval '15 minutes'*
            (case attempts when 1 then 1 when 2 then 4 else 16 end)),
          updated_at=v_now
      where id=v_job.id;
    insert into private.network_producer_catalog_ingest_events
      (catalog_id,event_type,event_summary)
    values(v_catalog,case when v_error='grant_inactive' then 'blocked'
                          when v_job.attempts>=4 then 'failed'
                          else 'retry' end,
      jsonb_build_object('attempt',v_job.attempts,'error_code',v_error));
    return jsonb_build_object('contract','netproducers-b3c-queue-v1',
      'status','failure_recorded','published_claims',0);
  end if;
  raise exception 'Unsupported queue operation' using errcode='22023';
end;
$body$;

create function public.netproducers1_b3c_catalog_queue(
  p_operation text,p_payload jsonb
) returns jsonb language sql security definer set search_path=''
as $body$
  select private.netproducers1_b3c_catalog_queue(p_operation,p_payload);
$body$;

revoke all on function private.netproducers1_b3c_catalog_queue(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.netproducers1_b3c_catalog_queue(text,jsonb)
  from public,anon,authenticated;
grant execute on function private.netproducers1_b3c_catalog_queue(text,jsonb)
  to service_role;
grant execute on function public.netproducers1_b3c_catalog_queue(text,jsonb)
  to service_role;
revoke all on function private.netproducers1_b3c_forbid_event_edit()
  from public,anon,authenticated;
revoke all on function private.netproducers1_b3c_block_on_revoke()
  from public,anon,authenticated;

-- No grant registration, no file download, no autonomous source scraping,
-- no public technical evidence / UI access in this migration.
