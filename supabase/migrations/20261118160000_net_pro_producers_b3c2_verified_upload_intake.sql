-- NET-PRO-PRODUCERS1.B3.C2.A — verified corporate catalogue submissions.
-- A company representative may upload to private quarantine only after a
-- separately approved claim+proof. This DOES NOT issue a B2 grant or enqueue
-- manufacturer technical evidence. Rights and source must be independently
-- verified before the trusted issuer calls B2/C1.

create table private.network_producer_catalog_submissions (
  catalog_id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id),
  organization_id uuid not null references public.organizations(id),
  submitted_by uuid not null references auth.users(id),
  source_url text not null check (
    length(source_url) between 14 and 1200 and
    source_url ~ '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/%-]+)?(\?[A-Za-z0-9._~/%=&-]+)?$'
  ),
  edition text not null check (length(edition) between 1 and 80),
  original_name text not null check (
    length(original_name) between 5 and 140 and original_name ~ '^[a-zA-Z0-9 ._-]+$'
  ),
  document_format text not null check(document_format in ('pdf','csv')),
  document_sha256 text not null check(document_sha256 ~ '^[a-f0-9]{64}$'),
  object_path text not null unique,
  -- Immutable declaration of the three distinct derivative-use rights.
  rights_declared_at timestamptz not null default now(),
  state text not null default 'awaiting_upload' check(
    state in ('awaiting_upload','pending_provenance','withdrawn')
  ),
  upload_deadline timestamptz not null default (now() + interval '30 minutes'),
  uploaded_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  check(object_path=(
    company_id::text||'/'||catalog_id::text||'/'||
    document_sha256||'.'||document_format
  )),
  check (
    (state='withdrawn' and withdrawn_at is not null)
    or (state<>'withdrawn' and withdrawn_at is null)
  )
);
create index network_producer_catalog_submissions_company_idx
  on private.network_producer_catalog_submissions(
    company_id,organization_id,created_at desc
  );
alter table private.network_producer_catalog_submissions enable row level security;
revoke all on private.network_producer_catalog_submissions
  from public,anon,authenticated,service_role;

-- Identity is verified by the existing company-claim process, not merely
-- by an e-mail domain match or a frontend "rights" checkbox.
create function private.netproducers1_b3c2_is_authorized_company_admin(
  p_company uuid
) returns boolean
language sql stable security definer set search_path=''
as $body$
  select (select auth.uid()) is not null
   and exists (
    select 1
    from public.network_companies c
    join public.network_company_role_assignments a on a.company_id=c.id
    join public.network_company_roles r on r.id=a.role_id
    join public.network_company_claims cl
      on cl.network_company_id=c.id
    join public.organization_memberships m
      on m.organization_id=cl.organization_id
    where c.id=p_company and c.country_code='IT'
      and c.publication_status='published' and c.archived_at is null
      and c.website_domain is not null
      and r.canonical_key='producer' and r.status='active'
      and cl.status='approved' and cl.proof_status='verified'
      and cl.revoked_at is null
      and m.user_id=(select auth.uid())
      and m.role='admin' and m.status='active'
  );
$body$;
revoke all on function private.netproducers1_b3c2_is_authorized_company_admin(uuid)
  from public,anon;
grant execute on function private.netproducers1_b3c2_is_authorized_company_admin(uuid)
  to authenticated;

create function private.netproducers1_b3c2_can_insert_object(p_path text)
returns boolean
language sql stable security definer set search_path=''
as $body$
  select (select auth.uid()) is not null and exists(
    select 1 from private.network_producer_catalog_submissions s
    where s.object_path=p_path
      and s.submitted_by=(select auth.uid())
      and s.state='awaiting_upload'
      and s.upload_deadline>now()
      and private.netproducers1_b3c2_is_authorized_company_admin(s.company_id)
  );
$body$;
revoke all on function private.netproducers1_b3c2_can_insert_object(text)
  from public,anon;
grant execute on function private.netproducers1_b3c2_can_insert_object(text)
  to authenticated;

-- Only INSERT is allowed; no browser file list/download/replace/delete.
create policy netproducers1_b3c2_verified_company_catalog_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='producer-authorized-catalogs'
  and private.netproducers1_b3c2_can_insert_object(name)
);

create function private.netproducers1_b3c2_catalog_submission(
  p_operation text,p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $body$
declare
  v_company uuid;
  v_user uuid:=(select auth.uid());
  v_org uuid;
  v_catalog uuid;
  v_url text;
  v_site text;
  v_edition text;
  v_name text;
  v_sha text;
  v_format text;
  v_path text;
  v_size bigint;
  v_mime text;
  v_entry private.network_producer_catalog_submissions%rowtype;
  v_now timestamptz:=now();
begin
  if v_user is null or p_operation not in ('status','prepare','finalize','withdraw')
    or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or pg_column_size(p_payload)>12000
  then
    raise exception 'Verified producer session required' using errcode='42501';
  end if;
  v_company:=(p_payload->>'company_id')::uuid;
  if v_company is null
     or not private.netproducers1_b3c2_is_authorized_company_admin(v_company)
  then
    if p_operation='status' then
      return jsonb_build_object('contract','netproducers-b3c2-v1',
        'eligible',false,'items','[]'::jsonb);
    end if;
    raise exception 'An approved, independently verified producer claim and admin membership are required'
      using errcode='42501';
  end if;
  select cl.organization_id into v_org
  from public.network_company_claims cl
  join public.organization_memberships m
    on m.organization_id=cl.organization_id
  where cl.network_company_id=v_company and cl.status='approved'
    and cl.proof_status='verified' and cl.revoked_at is null
    and m.user_id=v_user and m.role='admin' and m.status='active'
  order by cl.reviewed_at desc nulls last
  limit 1;
  if v_org is null then
    raise exception 'Verified producer organization missing' using errcode='42501';
  end if;
  if p_operation='status' then
    return jsonb_build_object(
      'contract','netproducers-b3c2-v1','eligible',true,
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'catalog_id',s.catalog_id,'name',s.original_name,'edition',s.edition,
          'format',s.document_format,'state',s.state,
          'created_at',s.created_at,'uploaded_at',s.uploaded_at
        ) order by s.created_at desc)
        from (select * from private.network_producer_catalog_submissions
          where company_id=v_company and organization_id=v_org
          order by created_at desc limit 20) s
      ),'[]'::jsonb)
    );
  end if;

  if p_operation='prepare' then
    -- The provided URL must be on the *same first-party producer domain*.
    -- A public listing is not a licence; rights require a verified principal.
    v_url:=p_payload->>'source_url';
    v_edition:=p_payload->>'edition';
    v_name:=p_payload->>'name';
    v_sha:=p_payload->>'sha256';
    v_format:=p_payload->>'format';
    if p_payload->'rights_declaration' is distinct from 'true'::jsonb
       or v_url is null
       or v_url !~ '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/%-]+)?(\?[A-Za-z0-9._~/%=&-]+)?$'
       or length(v_url)>1200
       or length(coalesce(v_edition,'')) not between 1 and 80
       or length(coalesce(v_name,'')) not between 5 and 140
       or v_name !~ '^[a-zA-Z0-9 ._-]+$'
       or v_sha !~ '^[a-f0-9]{64}$'
       or v_format not in ('csv','pdf')
    then
      raise exception 'A specific official source and document rights declaration are required'
        using errcode='22023';
    end if;
    select website_domain into v_site
      from public.network_companies where id=v_company;
    if regexp_replace(lower(split_part(v_url,'/',3)),'^www\.','')
      is distinct from regexp_replace(lower(v_site),'^www\.','')
    then
      raise exception 'Only first-party producer domain is permitted'
        using errcode='42501';
    end if;
    if (
      select count(*) from private.network_producer_catalog_submissions
      where company_id=v_company and created_at>v_now-interval '24 hours'
    )>=5 then
      raise exception 'Daily secure-upload quota reached' using errcode='42501';
    end if;
    v_catalog:=gen_random_uuid();
    v_path:=v_company::text||'/'||v_catalog::text||'/'||
        v_sha||'.'||v_format;
    insert into private.network_producer_catalog_submissions
      (catalog_id,company_id,organization_id,submitted_by,
       source_url,edition,original_name,document_format,document_sha256,
       object_path)
    values
      (v_catalog,v_company,v_org,v_user,
       v_url,v_edition,v_name,v_format,v_sha,v_path);
    return jsonb_build_object('contract','netproducers-b3c2-v1',
      'status','prepared','catalog_id',v_catalog,'object_path',v_path,
      'bucket','producer-authorized-catalogs',
      'published_claims',0,'rights_verified',false);
  end if;

  v_catalog:=(p_payload->>'catalog_id')::uuid;
  select * into v_entry
  from private.network_producer_catalog_submissions
  where catalog_id=v_catalog and company_id=v_company
    and organization_id=v_org
  for update;
  if not found then
    raise exception 'No producer-controlled catalog submission' using errcode='42501';
  end if;

  if p_operation='withdraw' then
    if v_entry.state='withdrawn' then
      return jsonb_build_object('contract','netproducers-b3c2-v1',
        'status','already_withdrawn','published_claims',0);
    end if;
    -- A producer must be able to withdraw immediately even after a
    -- verified issuer has granted rights. Reuse B2 for atomic stale/cancel.
    if exists (
      select 1 from private.network_producer_catalog_grants g
      where g.catalog_id=v_catalog and g.company_id=v_company
        and g.status='approved'
    ) then
      perform private.netproducers1_b2_catalog('revoke',jsonb_build_object(
        'catalog_id',v_catalog,'company_id',v_company,
        'reason','owner_revoked'));
    end if;
    update private.network_producer_catalog_submissions
    set state='withdrawn',withdrawn_at=v_now where catalog_id=v_catalog;
    return jsonb_build_object('contract','netproducers-b3c2-v1',
      'status','withdrawn','published_claims',0);
  end if;

  if p_operation='finalize' then
    if v_entry.state='pending_provenance' then
      return jsonb_build_object('contract','netproducers-b3c2-v1',
        'status','already_submitted','rights_verified',false,'published_claims',0);
    end if;
    if v_entry.state<>'awaiting_upload'
      or v_entry.upload_deadline<=v_now
    then
      raise exception 'Upload permission expired or withdrawn' using errcode='42501';
    end if;
    select coalesce((o.metadata->>'size')::bigint,0),
           coalesce(o.metadata->>'mimetype','')
      into v_size,v_mime
      from storage.objects o
      where o.bucket_id='producer-authorized-catalogs'
        and o.name=v_entry.object_path
        and o.created_at>=v_entry.created_at
        and o.created_at<=v_entry.upload_deadline;
    if not found
      or v_size<=0
      or v_size>(case when v_entry.document_format='pdf'
                        then 8388608 else 2097152 end)
      or v_mime is distinct from
        (case when v_entry.document_format='pdf'
                then 'application/pdf' else 'text/csv' end)
    then
      raise exception 'Matching private file required' using errcode='42501';
    end if;
    update private.network_producer_catalog_submissions
    set state='pending_provenance',uploaded_at=v_now
    where catalog_id=v_catalog;
    return jsonb_build_object('contract','netproducers-b3c2-v1',
      'status','pending_provenance','rights_verified',false,
      'published_claims',0);
  end if;
  raise exception 'Unsupported producer submission command' using errcode='22023';
end;
$body$;

create function public.netproducers1_b3c2_catalog_submission(
  p_operation text,p_payload jsonb
) returns jsonb
language sql security definer set search_path=''
as $body$
  select private.netproducers1_b3c2_catalog_submission(p_operation,p_payload);
$body$;

revoke all on function private.netproducers1_b3c2_catalog_submission(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.netproducers1_b3c2_catalog_submission(text,jsonb)
  from public,anon,authenticated;
grant execute on function public.netproducers1_b3c2_catalog_submission(text,jsonb)
  to authenticated;
grant execute on function private.netproducers1_b3c2_catalog_submission(text,jsonb)
  to authenticated;
-- Do not expose direct private submission-table SELECT or file reads.
-- This intake never grants B2 rights or enqueues B3.C1 jobs.
