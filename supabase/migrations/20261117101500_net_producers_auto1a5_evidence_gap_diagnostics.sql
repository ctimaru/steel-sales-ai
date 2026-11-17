-- NET-PRODUCERS-AUTO1.A.5 — source-local rejection diagnostics, never technical assertions.
-- Install once before enabling NETPRODUCERS_A5_ENABLED in the Railway worker.
-- No rescan/requeue, public reader, provenance weakening, or published capacity.

create table if not exists private.network_producer_auto1a5_diagnostics (
  detail_page_id uuid primary key
    references private.network_producer_auto1_detail_pages(id) on delete cascade,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  reason text not null check (reason in (
    'exact_candidate','no_table_rows','no_eligible_rows',
    'missing_standard','missing_grade','missing_shape',
    'missing_dimensions','split_across_rows',
    'ambiguous_or_rejected','no_exact_row'
  )),
  metrics jsonb not null check (
    jsonb_typeof(metrics)='object'
    and octet_length(metrics::text)<=1400
  ),
  observed_at timestamptz not null default now()
);

alter table private.network_producer_auto1a5_diagnostics enable row level security;
revoke all on table private.network_producer_auto1a5_diagnostics
  from public, anon, authenticated;
create index if not exists network_producer_auto1a5_reason
  on private.network_producer_auto1a5_diagnostics(reason);

create or replace function private.netproducers1_auto1a5_record_diagnostic(
 p_page_id uuid, p_source_sha256 text, p_diagnostic jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_page private.network_producer_auto1_detail_pages%rowtype;
declare v_key text;
declare v_n int;
declare v_expected int;
begin
 if p_page_id is null or p_source_sha256 is null
    or p_source_sha256 !~ '^[a-f0-9]{64}$'
    or p_diagnostic is null or jsonb_typeof(p_diagnostic)<>'object'
    or octet_length(p_diagnostic::text)>1400
    or p_diagnostic->>'contract' is distinct from 'netproducers-auto1a5-diagnostic-v1'
    or coalesce(p_diagnostic->>'reason','') not in (
      'exact_candidate','no_table_rows','no_eligible_rows',
      'missing_standard','missing_grade','missing_shape',
      'missing_dimensions','split_across_rows',
      'ambiguous_or_rejected','no_exact_row'
    )
    or (select count(*) from jsonb_object_keys(p_diagnostic))<>11
 then
   raise exception 'Invalid bounded A5 diagnostic' using errcode='22023';
 end if;
 foreach v_key in array array[
    'table_rows','eligible_rows','standard_rows','grade_rows',
    'shape_rows','dimension_rows','same_row_all_fields',
    'pdf_links','exact_candidates'
 ] loop
   if coalesce(jsonb_typeof(p_diagnostic->v_key),'')<>'number'
      or coalesce(p_diagnostic->>v_key,'') !~ '^[0-9]{1,4}$'
   then
     raise exception 'Non-numeric A5 metric' using errcode='22023';
   end if;
   v_n:=(p_diagnostic->>v_key)::int;
   if v_n<0 or v_n>1000 then
     raise exception 'Out-of-bounds A5 metric' using errcode='22023';
   end if;
 end loop;
 if (p_diagnostic->>'table_rows')::int>120
    or (p_diagnostic->>'eligible_rows')::int>(p_diagnostic->>'table_rows')::int
    or (p_diagnostic->>'exact_candidates')::int>20
    or (p_diagnostic->>'same_row_all_fields')::int>(p_diagnostic->>'eligible_rows')::int
    or exists (
      select 1 from unnest(array['standard_rows','grade_rows',
          'shape_rows','dimension_rows']) a(key)
      where (p_diagnostic->>a.key)::int>(p_diagnostic->>'eligible_rows')::int
    )
    or ((p_diagnostic->>'reason'='exact_candidate')
        is distinct from ((p_diagnostic->>'exact_candidates')::int>0))
 then
   raise exception 'Inconsistent A5 metrics' using errcode='22023';
 end if;

 select * into v_page from private.network_producer_auto1_detail_pages
  where id=p_page_id for update;
 if not found or v_page.status<>'processed'
    or v_page.last_sha256 is distinct from p_source_sha256
    or v_page.last_checked_at<now()-interval '35 days'
    or v_page.last_checked_at is null
 then
   raise exception 'Current processed depth-two source required' using errcode='42501';
 end if;

 -- Independently check current producer rights and source identity.
 if not exists (
   select 1 from private.network_producer_auto1_product_pages p
   join private.network_producer_auto1_sources q on q.company_id=p.company_id
   join public.network_companies c on c.id=q.company_id
   where p.id=v_page.parent_page_id
     and p.company_id=v_page.company_id
     and p.last_sha256=v_page.parent_sha256
     and p.detail_discovery_sha256=v_page.parent_sha256
     and p.root_sha256=q.last_sha256 and p.root_source_url=q.source_url
     and p.canonical_domain=q.canonical_domain
     and v_page.canonical_domain=q.canonical_domain
     and q.source_url=c.website_url and q.canonical_domain=c.website_domain
     and c.country_code='IT' and c.publication_status='published'
     and c.archived_at is null
     and p.last_checked_at>=now()-interval '35 days'
     and q.last_checked_at>=now()-interval '35 days'
     and exists (
       select 1 from public.network_company_role_assignments a
       join public.network_company_roles r on r.id=a.role_id
       where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
     )
 ) then
   raise exception 'Canonical producer evidence no longer current' using errcode='42501';
 end if;

 select count(*)::int into v_expected
 from private.network_producer_auto1_detail_candidates c
 where c.detail_page_id=p_page_id and c.source_sha256=p_source_sha256
   and c.evidence_status='pending_verification';
 if v_expected is distinct from (p_diagnostic->>'exact_candidates')::int then
   raise exception 'A5 candidate count does not match recorded evidence' using errcode='22023';
 end if;

 insert into private.network_producer_auto1a5_diagnostics
   (detail_page_id,source_sha256,reason,metrics,observed_at)
 values(p_page_id,p_source_sha256,p_diagnostic->>'reason',p_diagnostic,now())
 on conflict (detail_page_id) do update set
   source_sha256=excluded.source_sha256,
   reason=excluded.reason,
   metrics=excluded.metrics,
   observed_at=excluded.observed_at
 where private.network_producer_auto1a5_diagnostics.source_sha256
       is distinct from excluded.source_sha256
    or private.network_producer_auto1a5_diagnostics.metrics
       is distinct from excluded.metrics;

 return jsonb_build_object(
   'contract','netproducers-auto1a5-record-v1',
   'recorded',true,'reason',p_diagnostic->>'reason',
   'published_capabilities',0
 );
end;
$body$;

create or replace function public.netproducers1_auto1a5_record_diagnostic(
 p_page_id uuid, p_source_sha256 text, p_diagnostic jsonb
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a5_record_diagnostic(
   p_page_id,p_source_sha256,p_diagnostic
 );
$body$;

revoke all on function private.netproducers1_auto1a5_record_diagnostic(uuid,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a5_record_diagnostic(uuid,text,jsonb)
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a5_record_diagnostic(uuid,text,jsonb)
 to service_role;
grant execute on function public.netproducers1_auto1a5_record_diagnostic(uuid,text,jsonb)
 to service_role;

comment on table private.network_producer_auto1a5_diagnostics is
 'A5 private structural HTML metrics tied to exact source SHA. No texts, URLs, manufacturing claims or public access.';
