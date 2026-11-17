-- AUTO1.A.5.3 — private, provenance-bound comparisons of observed table rows.
-- Additive only: the full-source SHA stays authoritative for every A4/A5 claim.
-- No retroactive comparison of pages with missing prior technical fingerprints.

create table if not exists private.network_producer_auto1a53_fingerprints (
  detail_page_id uuid primary key
    references private.network_producer_auto1_detail_pages(id) on delete cascade,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  technical_sha256 text check (technical_sha256 ~ '^[0-9a-f]{64}$'),
  technical_rows int not null check (technical_rows between 0 and 120),
  previous_source_sha256 text check (previous_source_sha256 ~ '^[0-9a-f]{64}$'),
  previous_technical_sha256 text check (previous_technical_sha256 ~ '^[0-9a-f]{64}$'),
  comparison_status text not null check (comparison_status in (
    'baseline', 'same_observed_rows', 'changed_observed_rows',
    'no_comparable_rows'
  )),
  observed_at timestamptz not null default now(),
  constraint a53_technical_rows_digest_consistent
    check ((technical_rows = 0) = (technical_sha256 is null))
);

alter table private.network_producer_auto1a53_fingerprints enable row level security;
revoke all on table private.network_producer_auto1a53_fingerprints
 from public, anon, authenticated;

create or replace function private.netproducers1_auto1a53_record_fingerprint(
 p_page_id uuid, p_source_sha256 text, p_technical_sha256 text,
 p_technical_rows int
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_page private.network_producer_auto1_detail_pages%rowtype;
declare v_previous private.network_producer_auto1a53_fingerprints%rowtype;
declare v_diagnostic private.network_producer_auto1a5_diagnostics%rowtype;
declare v_existing boolean;
declare v_status text;
begin
 if p_page_id is null or p_source_sha256 is null
    or p_source_sha256 !~ '^[0-9a-f]{64}$'
    or p_technical_rows is null or p_technical_rows not between 0 and 120
    or ((p_technical_rows = 0) is distinct from (p_technical_sha256 is null))
    or (p_technical_sha256 is not null and p_technical_sha256 !~ '^[0-9a-f]{64}$')
 then
    raise exception 'Invalid bounded A5.3 row signature' using errcode='22023';
 end if;

 select * into v_page
 from private.network_producer_auto1_detail_pages
 where id=p_page_id for update;
 if not found or v_page.status<>'processed'
    or v_page.last_sha256 is distinct from p_source_sha256
    or v_page.last_checked_at is null
    or v_page.last_checked_at < now()-interval '35 days'
 then
    raise exception 'Current A5.3 depth-two HTML source required' using errcode='42501';
 end if;

 select * into v_diagnostic
 from private.network_producer_auto1a5_diagnostics
 where detail_page_id=p_page_id and source_sha256=p_source_sha256;
 if not found or p_technical_rows > (v_diagnostic.metrics->>'eligible_rows')::int then
    raise exception 'A5.3 requires matching validated A5 diagnosis' using errcode='42501';
 end if;

 -- Recheck the same first-party source / company rights as A5 before
 -- accepting an observational fingerprint. Not a capability assertion.
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
    raise exception 'A5.3 canonical manufacturer evidence no longer current' using errcode='42501';
 end if;

 select * into v_previous
 from private.network_producer_auto1a53_fingerprints
 where detail_page_id=p_page_id for update;
 v_existing:=found;

 if v_existing and v_previous.source_sha256=p_source_sha256 then
   if v_previous.technical_sha256 is distinct from p_technical_sha256
      or v_previous.technical_rows is distinct from p_technical_rows then
     raise exception 'Conflicting fingerprint for exact source SHA' using errcode='22023';
   end if;
   return jsonb_build_object(
      'contract','netproducers-auto1a53-record-v1',
      'recorded',true,
      'comparison','unchanged_snapshot',
      'published_capabilities',0
   );
 end if;

 if not v_existing then
   v_status:=case when p_technical_rows=0 then 'no_comparable_rows' else 'baseline' end;
   insert into private.network_producer_auto1a53_fingerprints (
     detail_page_id,source_sha256,technical_sha256,technical_rows,
     comparison_status,observed_at
   ) values (
     p_page_id,p_source_sha256,p_technical_sha256,p_technical_rows,v_status,now()
   );
 else
   if v_previous.technical_sha256 is null or p_technical_sha256 is null then
     v_status:='no_comparable_rows';
   elsif v_previous.technical_sha256=p_technical_sha256 then
     v_status:='same_observed_rows';
   else
     v_status:='changed_observed_rows';
   end if;

   update private.network_producer_auto1a53_fingerprints set
     previous_source_sha256=v_previous.source_sha256,
     previous_technical_sha256=v_previous.technical_sha256,
     source_sha256=p_source_sha256,
     technical_sha256=p_technical_sha256,
     technical_rows=p_technical_rows,
     comparison_status=v_status,
     observed_at=now()
   where detail_page_id=p_page_id;
 end if;

 return jsonb_build_object(
    'contract','netproducers-auto1a53-record-v1',
    'recorded',true,
    'comparison',v_status,
    'published_capabilities',0
 );
end;
$body$;

create or replace function public.netproducers1_auto1a53_record_fingerprint(
 p_page_id uuid, p_source_sha256 text, p_technical_sha256 text,
 p_technical_rows int
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a53_record_fingerprint(
   p_page_id,p_source_sha256,p_technical_sha256,p_technical_rows
 );
$body$;

revoke all on function private.netproducers1_auto1a53_record_fingerprint(uuid,text,text,int)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a53_record_fingerprint(uuid,text,text,int)
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a53_record_fingerprint(uuid,text,text,int)
 to service_role;
grant execute on function public.netproducers1_auto1a53_record_fingerprint(uuid,text,text,int)
 to service_role;

comment on table private.network_producer_auto1a53_fingerprints is
 'Private diagnostic signature of observed technical table rows only, checked after A5 exact-SHA provenance. Unchanged row digest never certifies unchanged product specifications.';
