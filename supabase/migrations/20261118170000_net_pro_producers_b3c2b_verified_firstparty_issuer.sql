-- NET-PRO-PRODUCERS1.B3.C2.B: automatically verify first-party byte identity
-- and issue B2 document rights only for independently verified producer admins.
-- Service-only. Never approve from link_only, checkbox alone, domain alone or
-- file hash alone. Trusted worker must rehash BOTH private and official bytes.

alter table private.network_producer_catalog_submissions
  drop constraint network_producer_catalog_submissions_state_check;
alter table private.network_producer_catalog_submissions
  add constraint network_producer_catalog_submissions_state_check
  check(state in (
    'awaiting_upload','pending_provenance','verifying',
    'in_analysis','needs_review','withdrawn'
  ));

alter table private.network_producer_catalog_submissions
  add column verification_attempts integer not null default 0
    check(verification_attempts between 0 and 4),
  add column verification_lease_token uuid,
  add column verification_lease_until timestamptz,
  add column verification_next_attempt_at timestamptz not null default now(),
  add column source_checked_at timestamptz,
  add column source_match_sha256 text
    check(source_match_sha256 ~ '^[a-f0-9]{64}$'),
  add column verification_error_code text
    check (verification_error_code in (
      'source_unreachable','storage_unavailable','hash_mismatch',
      'unsafe_source','unsupported_document','rights_changed','unexpected'
    )),
  add constraint netproducers1_b3c2b_lease_consistency check(
    (state='verifying' and verification_lease_token is not null
      and verification_lease_until is not null)
    or (state<>'verifying' and verification_lease_token is null
      and verification_lease_until is null)
  );
-- C2.A revocation may happen while the issuer holds a transient lease.
-- Ensure immediate withdrawal clears it, instead of violating the CHECK.
create function private.netproducers1_b3c2b_clear_lease_on_withdraw()
returns trigger language plpgsql set search_path=''
as $body$
begin
  if new.state='withdrawn' and old.state<>'withdrawn' then
    new.verification_lease_token:=null;
    new.verification_lease_until:=null;
  end if;
  return new;
end;
$body$;
create trigger netproducers1_b3c2b_clear_lease_on_withdraw
  before update of state on private.network_producer_catalog_submissions
  for each row execute function private.netproducers1_b3c2b_clear_lease_on_withdraw();

create index netproducers1_b3c2b_claim_order
  on private.network_producer_catalog_submissions(
    state,verification_next_attempt_at,created_at
  );

create table private.network_producer_catalog_source_verification_events (
  id bigint generated always as identity primary key,
  catalog_id uuid not null
    references private.network_producer_catalog_submissions(catalog_id),
  event_type text not null check(
    event_type in ('leased','granted_and_enqueued','retry','needs_review')
  ),
  event_summary jsonb not null default '{}'::jsonb
    check(jsonb_typeof(event_summary)='object'),
  occurred_at timestamptz not null default now()
);
alter table private.network_producer_catalog_source_verification_events
  enable row level security;
revoke all on private.network_producer_catalog_source_verification_events
  from public,anon,authenticated,service_role;

create function private.netproducers1_b3c2b_no_event_mutation()
returns trigger language plpgsql set search_path=''
as $body$
begin
  raise exception 'Catalogue source-verification audit is immutable'
    using errcode='42501';
end;
$body$;
create trigger netproducers1_b3c2b_events_append_only
  before update or delete on private.network_producer_catalog_source_verification_events
  for each row execute function private.netproducers1_b3c2b_no_event_mutation();

create function private.netproducers1_b3c2b_verified_issuer(
  p_operation text,p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $body$
declare
  v_now timestamptz:=now();
  v_limit integer;
  v_item private.network_producer_catalog_submissions%rowtype;
  v_company public.network_companies%rowtype;
  v_token uuid;
  v_batch jsonb:='[]'::jsonb;
  v_reason text;
  v_sha text;
  v_reference text;
  v_b2 jsonb;
  v_c1 jsonb;
  v_lease uuid;
  v_eligible boolean;
  v_size bigint;
  v_mime text;
begin
  if p_operation not in ('claim','accept','reject','stats')
    or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or pg_column_size(p_payload)>12000 then
    raise exception 'Invalid trusted catalogue issuer operation'
      using errcode='22023';
  end if;

  if p_operation='stats' then
    return jsonb_build_object(
      'contract','netproducers-b3c2b-issuer-v1',
      'pending',(select count(*) from private.network_producer_catalog_submissions
        where state='pending_provenance'),
      'verifying',(select count(*) from private.network_producer_catalog_submissions
        where state='verifying'),
      'in_analysis',(select count(*) from private.network_producer_catalog_submissions
        where state='in_analysis'),
      'needs_review',(select count(*) from private.network_producer_catalog_submissions
        where state='needs_review'),'published_claims',0);
  end if;

  if p_operation='claim' then
    if p_payload->>'limit' is null or (p_payload->>'limit') !~ '^[1-3]
      raise exception 'Limit must be 1 to 3' using errcode='22023';
    end if;
    v_limit:=(p_payload->>'limit')::int;
    for v_item in
      select s.*
      from private.network_producer_catalog_submissions s
      join public.network_companies c on c.id=s.company_id
      where s.state in ('pending_provenance','verifying')
        and (s.state<>'verifying' or s.verification_lease_until<v_now)
        and s.verification_next_attempt_at<=v_now
        and s.verification_attempts<4
        and s.uploaded_at is not null
        and c.country_code='IT' and c.publication_status='published'
        and c.archived_at is null and c.website_domain is not null
        and regexp_replace(lower(split_part(s.source_url,'/',3)),'^www\.','')=
            regexp_replace(lower(c.website_domain),'^www\.','')
        and exists (
          select 1
          from public.network_company_claims cl
          join public.organization_memberships m
            on m.organization_id=cl.organization_id
          join public.network_company_role_assignments a on a.company_id=c.id
          join public.network_company_roles r on r.id=a.role_id
          where cl.network_company_id=c.id
            and cl.organization_id=s.organization_id
            and cl.status='approved' and cl.proof_status='verified'
            and cl.proof_verified_at is not null and cl.revoked_at is null
            and m.user_id=s.submitted_by
            and m.role='admin' and m.status='active'
            and r.canonical_key='producer' and r.status='active'
        )
        and exists (
          select 1 from storage.objects o
          where o.bucket_id='producer-authorized-catalogs'
            and o.name=s.object_path
            and o.created_at>=s.created_at
            and coalesce((o.metadata->>'size')::bigint,8388609)
                between 1 and case when s.document_format='pdf'
                             then 8388608 else 2097152 end
        )
      order by s.verification_next_attempt_at,s.created_at
      for update of s skip locked
      limit v_limit
    loop
      v_token:=gen_random_uuid();
      update private.network_producer_catalog_submissions
        set state='verifying',
          verification_attempts=verification_attempts+1,
          verification_lease_token=v_token,
          verification_lease_until=v_now+interval '8 minutes'
      where catalog_id=v_item.catalog_id;
      insert into private.network_producer_catalog_source_verification_events
        (catalog_id,event_type,event_summary)
      values(v_item.catalog_id,'leased',
             jsonb_build_object('attempt',v_item.verification_attempts+1));
      v_batch:=v_batch||jsonb_build_array(jsonb_build_object(
        'catalog_id',v_item.catalog_id,'company_id',v_item.company_id,
        'object_path',v_item.object_path,'format',v_item.document_format,
        'sha256',v_item.document_sha256,'source_url',v_item.source_url,
        'lease_token',v_token
      ));
    end loop;
    return jsonb_build_object('contract','netproducers-b3c2b-issuer-v1',
      'status','claimed','items',v_batch,
      'count',jsonb_array_length(v_batch),'published_claims',0);
  end if;

  select * into v_item
    from private.network_producer_catalog_submissions
    where catalog_id=(p_payload->>'catalog_id')::uuid
      and company_id=(p_payload->>'company_id')::uuid
    for update;
  v_lease:=(p_payload->>'lease_token')::uuid;
  if not found or v_item.state<>'verifying'
    or v_item.verification_lease_token is distinct from v_lease
    or v_item.verification_lease_until<=v_now then
    raise exception 'Expired or revoked issuer lease' using errcode='42501';
  end if;
  select * into v_company from public.network_companies
    where id=v_item.company_id for share;
  select exists(
    select 1 from public.network_company_claims cl
    join public.organization_memberships m on m.organization_id=cl.organization_id
    join public.network_company_role_assignments a on a.company_id=v_item.company_id
    join public.network_company_roles r on r.id=a.role_id
    where cl.network_company_id=v_item.company_id
      and cl.organization_id=v_item.organization_id
      and cl.status='approved' and cl.proof_status='verified'
      and cl.proof_verified_at is not null and cl.revoked_at is null
      and m.user_id=v_item.submitted_by and m.role='admin' and m.status='active'
      and r.canonical_key='producer' and r.status='active'
  ) into v_eligible;
  if not v_eligible or v_company.country_code<>'IT'
    or v_company.publication_status<>'published'
    or v_company.archived_at is not null
    or regexp_replace(lower(split_part(v_item.source_url,'/',3)),'^www\.','')
      is distinct from regexp_replace(lower(v_company.website_domain),'^www\.','')
  then
    raise exception 'Company rights changed during verification'
      using errcode='42501';
  end if;
  if p_operation='accept' then
    v_sha:=p_payload->>'source_sha256';
    if v_sha is distinct from v_item.document_sha256
      or v_sha !~ '^[a-f0-9]{64}$'
      or v_item.uploaded_at is null
      or not exists (
        select 1 from storage.objects o
        where o.bucket_id='producer-authorized-catalogs'
          and o.name=v_item.object_path and o.created_at>=v_item.created_at
          and coalesce((o.metadata->>'size')::bigint,0)
              between 1 and case when v_item.document_format='pdf'
                             then 8388608 else 2097152 end
      )
    then
      raise exception 'Current first-party and private matching file required'
        using errcode='42501';
    end if;
    v_reference:='rights-'||replace(v_item.catalog_id::text,'-','');
    v_b2:=private.netproducers1_b2_catalog('register',jsonb_build_object(
      'catalog_id',v_item.catalog_id,'company_id',v_item.company_id,
      'source_url',v_item.source_url,
      'sha256',v_item.document_sha256,'edition',v_item.edition,
      'format',v_item.document_format,
      'rights',jsonb_build_array('extract','store_derived','use_in_producer_search'),
      'verification_method','verified_company_authorization',
      'verification_reference',v_reference,
      'verified_at',v_now,'expires_at',v_now+interval '1 year'
    ));
    if coalesce(v_b2->>'status','') not in ('registered','already_registered') then
      raise exception 'B2 rights contract mismatch' using errcode='42501';
    end if;
    v_c1:=private.netproducers1_b3c_catalog_queue('enqueue',jsonb_build_object(
      'catalog_id',v_item.catalog_id,'company_id',v_item.company_id,
      'sha256',v_item.document_sha256,'object_path',v_item.object_path
    ));
    if coalesce(v_c1->>'status','') not in ('enqueued','already_enqueued') then
      raise exception 'C1 queue contract mismatch' using errcode='42501';
    end if;
    update private.network_producer_catalog_submissions
      set state='in_analysis',verification_lease_token=null,
          verification_lease_until=null,source_checked_at=v_now,
          source_match_sha256=v_sha,verification_error_code=null
    where catalog_id=v_item.catalog_id;
    insert into private.network_producer_catalog_source_verification_events
      (catalog_id,event_type,event_summary)
    values(v_item.catalog_id,'granted_and_enqueued',jsonb_build_object(
      'source_sha256',v_sha,'source_match','exact_same_bytes',
      'company_proof','approved_and_verified',
      'issuer','verified_first_party_file',
      'b2_registration',v_b2->>'status','c1_queue',v_c1->>'status'
    ));
    return jsonb_build_object('contract','netproducers-b3c2b-issuer-v1',
      'status','issued_and_enqueued','published_claims',0);
  end if;

  if p_operation='reject' then
    v_reason:=p_payload->>'error_code';
    if v_reason not in ('source_unreachable','storage_unavailable','hash_mismatch',
      'unsafe_source','unsupported_document','rights_changed','unexpected') then
      raise exception 'Only bounded opaque reason codes accepted'
        using errcode='22023';
    end if;
    update private.network_producer_catalog_submissions
    set state=case when v_reason in ('hash_mismatch','unsafe_source',
                                 'unsupported_document','rights_changed')
                          or verification_attempts>=4
                   then 'needs_review' else 'pending_provenance' end,
        verification_next_attempt_at=v_now+
          interval '15 minutes'*(case verification_attempts when 1 then 1
                                  when 2 then 4 else 16 end),
        verification_lease_token=null,verification_lease_until=null,
        verification_error_code=v_reason
    where catalog_id=v_item.catalog_id;
    insert into private.network_producer_catalog_source_verification_events
      (catalog_id,event_type,event_summary)
    values(v_item.catalog_id,
           case when v_reason in ('hash_mismatch','unsafe_source',
                                    'unsupported_document','rights_changed')
                           or v_item.verification_attempts>=4
                then 'needs_review' else 'retry' end,
           jsonb_build_object('error_code',v_reason,
                              'attempt',v_item.verification_attempts));
    return jsonb_build_object('contract','netproducers-b3c2b-issuer-v1',
      'status','failure_recorded','published_claims',0);
  end if;
  raise exception 'Unsupported trusted issuer operation' using errcode='22023';
end;
$body$;

create function public.netproducers1_b3c2b_verified_issuer(
  p_operation text,p_payload jsonb
) returns jsonb
language sql security definer set search_path=''
as $body$
  select private.netproducers1_b3c2b_verified_issuer(p_operation,p_payload);
$body$;
revoke all on function private.netproducers1_b3c2b_verified_issuer(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.netproducers1_b3c2b_verified_issuer(text,jsonb)
  from public,anon,authenticated;
grant execute on function private.netproducers1_b3c2b_verified_issuer(text,jsonb)
  to service_role;
grant execute on function public.netproducers1_b3c2b_verified_issuer(text,jsonb)
  to service_role;
revoke all on function private.netproducers1_b3c2b_no_event_mutation()
  from public,anon,authenticated;
-- Browser sees only own submission status via existing C2.A authenticated RPC.
-- No direct document, issue/grant or export is made public by C2.B.
 then
      raise exception 'Limit must be 1 to 3' using errcode='22023';
    end if;
    v_limit:=(p_payload->>'limit')::int;
    for v_item in
      select s.*
      from private.network_producer_catalog_submissions s
      join public.network_companies c on c.id=s.company_id
      where s.state in ('pending_provenance','verifying')
        and (s.state<>'verifying' or s.verification_lease_until<v_now)
        and s.verification_next_attempt_at<=v_now
        and s.verification_attempts<4
        and s.uploaded_at is not null
        and c.country_code='IT' and c.publication_status='published'
        and c.archived_at is null and c.website_domain is not null
        and regexp_replace(lower(split_part(s.source_url,'/',3)),'^www\.','')=
            regexp_replace(lower(c.website_domain),'^www\.','')
        and exists (
          select 1
          from public.network_company_claims cl
          join public.organization_memberships m
            on m.organization_id=cl.organization_id
          join public.network_company_role_assignments a on a.company_id=c.id
          join public.network_company_roles r on r.id=a.role_id
          where cl.network_company_id=c.id
            and cl.organization_id=s.organization_id
            and cl.status='approved' and cl.proof_status='verified'
            and cl.proof_verified_at is not null and cl.revoked_at is null
            and m.user_id=s.submitted_by
            and m.role='admin' and m.status='active'
            and r.canonical_key='producer' and r.status='active'
        )
        and exists (
          select 1 from storage.objects o
          where o.bucket_id='producer-authorized-catalogs'
            and o.name=s.object_path
            and o.created_at>=s.created_at
            and coalesce((o.metadata->>'size')::bigint,8388609)
                between 1 and case when s.document_format='pdf'
                             then 8388608 else 2097152 end
        )
      order by s.verification_next_attempt_at,s.created_at
      for update of s skip locked
      limit v_limit
    loop
      v_token:=gen_random_uuid();
      update private.network_producer_catalog_submissions
        set state='verifying',
          verification_attempts=verification_attempts+1,
          verification_lease_token=v_token,
          verification_lease_until=v_now+interval '8 minutes'
      where catalog_id=v_item.catalog_id;
      insert into private.network_producer_catalog_source_verification_events
        (catalog_id,event_type,event_summary)
      values(v_item.catalog_id,'leased',
             jsonb_build_object('attempt',v_item.verification_attempts+1));
      v_batch:=v_batch||jsonb_build_array(jsonb_build_object(
        'catalog_id',v_item.catalog_id,'company_id',v_item.company_id,
        'object_path',v_item.object_path,'format',v_item.document_format,
        'sha256',v_item.document_sha256,'source_url',v_item.source_url,
        'lease_token',v_token
      ));
    end loop;
    return jsonb_build_object('contract','netproducers-b3c2b-issuer-v1',
      'status','claimed','items',v_batch,
      'count',jsonb_array_length(v_batch),'published_claims',0);
  end if;

  select * into v_item
    from private.network_producer_catalog_submissions
    where catalog_id=(p_payload->>'catalog_id')::uuid
      and company_id=(p_payload->>'company_id')::uuid
    for update;
  v_lease:=(p_payload->>'lease_token')::uuid;
  if not found or v_item.state<>'verifying'
    or v_item.verification_lease_token is distinct from v_lease
    or v_item.verification_lease_until<=v_now then
    raise exception 'Expired or revoked issuer lease' using errcode='42501';
  end if;
  select * into v_company from public.network_companies
    where id=v_item.company_id for share;
  select exists(
    select 1 from public.network_company_claims cl
    join public.organization_memberships m on m.organization_id=cl.organization_id
    join public.network_company_role_assignments a on a.company_id=v_item.company_id
    join public.network_company_roles r on r.id=a.role_id
    where cl.network_company_id=v_item.company_id
      and cl.organization_id=v_item.organization_id
      and cl.status='approved' and cl.proof_status='verified'
      and cl.proof_verified_at is not null and cl.revoked_at is null
      and m.user_id=v_item.submitted_by and m.role='admin' and m.status='active'
      and r.canonical_key='producer' and r.status='active'
  ) into v_eligible;
  if not v_eligible or v_company.country_code<>'IT'
    or v_company.publication_status<>'published'
    or v_company.archived_at is not null
    or regexp_replace(lower(split_part(v_item.source_url,'/',3)),'^www\.','')
      is distinct from regexp_replace(lower(v_company.website_domain),'^www\.','')
  then
    raise exception 'Company rights changed during verification'
      using errcode='42501';
  end if;
  if p_operation='accept' then
    v_sha:=p_payload->>'source_sha256';
    if v_sha is distinct from v_item.document_sha256
      or v_sha !~ '^[a-f0-9]{64}$'
      or v_item.uploaded_at is null
      or not exists (
        select 1 from storage.objects o
        where o.bucket_id='producer-authorized-catalogs'
          and o.name=v_item.object_path and o.created_at>=v_item.created_at
          and coalesce((o.metadata->>'size')::bigint,0)
              between 1 and case when v_item.document_format='pdf'
                             then 8388608 else 2097152 end
      )
    then
      raise exception 'Current first-party and private matching file required'
        using errcode='42501';
    end if;
    v_reference:='rights-'||replace(v_item.catalog_id::text,'-','');
    v_b2:=private.netproducers1_b2_catalog('register',jsonb_build_object(
      'catalog_id',v_item.catalog_id,'company_id',v_item.company_id,
      'source_url',v_item.source_url,
      'sha256',v_item.document_sha256,'edition',v_item.edition,
      'format',v_item.document_format,
      'rights',jsonb_build_array('extract','store_derived','use_in_producer_search'),
      'verification_method','verified_company_authorization',
      'verification_reference',v_reference,
      'verified_at',v_now,'expires_at',v_now+interval '1 year'
    ));
    if v_b2->>'status'<>'registered' and v_b2->>'status'<>'already_registered' then
      raise exception 'B2 rights contract mismatch' using errcode='42501';
    end if;
    v_c1:=private.netproducers1_b3c_catalog_queue('enqueue',jsonb_build_object(
      'catalog_id',v_item.catalog_id,'company_id',v_item.company_id,
      'sha256',v_item.document_sha256,'object_path',v_item.object_path
    ));
    if v_c1->>'status' not in ('enqueued','already_enqueued') then
      raise exception 'C1 queue contract mismatch' using errcode='42501';
    end if;
    update private.network_producer_catalog_submissions
      set state='in_analysis',verification_lease_token=null,
          verification_lease_until=null,source_checked_at=v_now,
          source_match_sha256=v_sha,verification_error_code=null
    where catalog_id=v_item.catalog_id;
    insert into private.network_producer_catalog_source_verification_events
      (catalog_id,event_type,event_summary)
    values(v_item.catalog_id,'granted_and_enqueued',jsonb_build_object(
      'source_sha256',v_sha,'source_match','exact_same_bytes',
      'company_proof','approved_and_verified',
      'issuer','verified_first_party_file',
      'b2_registration',v_b2->>'status','c1_queue',v_c1->>'status'
    ));
    return jsonb_build_object('contract','netproducers-b3c2b-issuer-v1',
      'status','issued_and_enqueued','published_claims',0);
  end if;

  if p_operation='reject' then
    v_reason:=p_payload->>'error_code';
    if v_reason not in ('source_unreachable','storage_unavailable','hash_mismatch',
      'unsafe_source','unsupported_document','rights_changed','unexpected') then
      raise exception 'Only bounded opaque reason codes accepted'
        using errcode='22023';
    end if;
    update private.network_producer_catalog_submissions
    set state=case when v_reason in ('hash_mismatch','unsafe_source',
                                 'unsupported_document','rights_changed')
                          or verification_attempts>=4
                   then 'needs_review' else 'pending_provenance' end,
        verification_next_attempt_at=v_now+
          interval '15 minutes'*(case verification_attempts when 1 then 1
                                  when 2 then 4 else 16 end),
        verification_lease_token=null,verification_lease_until=null,
        verification_error_code=v_reason
    where catalog_id=v_item.catalog_id;
    insert into private.network_producer_catalog_source_verification_events
      (catalog_id,event_type,event_summary)
    values(v_item.catalog_id,
           case when v_reason in ('hash_mismatch','unsafe_source',
                                    'unsupported_document','rights_changed')
                           or v_item.verification_attempts>=4
                then 'needs_review' else 'retry' end,
           jsonb_build_object('error_code',v_reason,
                              'attempt',v_item.verification_attempts));
    return jsonb_build_object('contract','netproducers-b3c2b-issuer-v1',
      'status','failure_recorded','published_claims',0);
  end if;
  raise exception 'Unsupported trusted issuer operation' using errcode='22023';
end;
$body$;

create function public.netproducers1_b3c2b_verified_issuer(
  p_operation text,p_payload jsonb
) returns jsonb
language sql security definer set search_path=''
as $body$
  select private.netproducers1_b3c2b_verified_issuer(p_operation,p_payload);
$body$;
revoke all on function private.netproducers1_b3c2b_verified_issuer(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.netproducers1_b3c2b_verified_issuer(text,jsonb)
  from public,anon,authenticated;
grant execute on function private.netproducers1_b3c2b_verified_issuer(text,jsonb)
  to service_role;
grant execute on function public.netproducers1_b3c2b_verified_issuer(text,jsonb)
  to service_role;
revoke all on function private.netproducers1_b3c2b_no_event_mutation()
  from public,anon,authenticated;
-- Browser sees only own submission status via existing C2.A authenticated RPC.
-- No direct document, issue/grant or export is made public by C2.B.
