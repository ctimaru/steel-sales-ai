-- P3.4 — Company Profile Enrichment acceptance.
begin;

create or replace function pg_temp.p34_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.4 assertion failed: %',message;
  end if;
end;
$$;

do $p34$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email)
    values ('00000000-0000-0000-0000-0000000034a1','p34-superadmin@example.com')
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-0000000034a1',
      'platform_superadmin','active',
      null,
      'P3.4 acceptance fallback superadmin'
    );
  end if;
end;
$p34$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
)
values(
  '00000000-0000-0000-0000-0000000034c0',
  'P34 Existing Tubes S.r.l.','IT',
  'https://p34-existing.example/','p34-existing.example',
  'published','unclaimed','unverified'
);

select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select (public.p3_start_company_discovery_batch(
  'IT',
  '["https://p34-existing.example/"]'::jsonb,
  'manual_url',
  'P3.4 acceptance',
  'P3.4 enrichment acceptance'
)->>'run_id') as run_id \gset

reset role;

insert into public.network_company_discovery_candidates(
  id,run_id,source_url,canonical_domain,website_url,legal_name,country_code,
  description,role_keys,subtype_keys,product_relations,evidence,source_urls,
  match_company_id,match_signals,confidence,extraction_version,
  facility_candidates,capability_keys,market_keys,enrichment_quality
)
values(
  '00000000-0000-0000-0000-0000000034c1',
  :'run_id'::uuid,
  'https://p34-existing.example/',
  'p34-existing.example',
  'https://p34-existing.example/',
  'P34 Existing Tubes S.r.l.',
  'IT',
  'Tube processing and automotive supply.',
  array['processor_service_provider'],
  array['cutting_specialist'],
  '[{"key":"tubes_pipes","relationship_type":"processes"}]'::jsonb,
  '[{"url":"https://p34-existing.example/","snippet":"Taglio laser tubi per automotive a Torino."}]'::jsonb,
  '["https://p34-existing.example/"]'::jsonb,
  '00000000-0000-0000-0000-0000000034c0',
  '["website_domain_exact"]'::jsonb,
  0.9400,
  'p3.4-v1',
  '[{"name":"P34 Torino Plant","facility_type":"plant","address_line_1":"Via Acciaio 34","postal_code":"10100","city":"Torino","region":"Piemonte","country_code":"IT","website_url":"https://p34-existing.example/","source_url":"https://p34-existing.example/"}]'::jsonb,
  array['laser_cutting'],
  array['automotive'],
  '{"structured_facility_count":1,"capability_count":1,"market_count":1}'::jsonb
);

set local role authenticated;

select public.p3_admin_discovery_queue('pending_review',100) as queue_payload \gset
select pg_temp.p34_assert(
  (:'queue_payload'::jsonb->'quality'->>'enrichment_ready')::integer >= 1,
  'hard exact match with enrichment payload must remain reviewable'
);

select public.p3_close_exact_discovery_duplicates('P3.4 acceptance bulk close') as bulk_close \gset
select pg_temp.p34_assert(
  (:'bulk_close'::jsonb->>'closed_count')::integer=0
  and exists (
    select 1 from public.network_company_discovery_candidates
    where id='00000000-0000-0000-0000-0000000034c1'
      and review_status='pending_review'
  ),
  'bulk duplicate closure must preserve enrichment-ready exact matches'
);

select public.p3_enrich_existing_company_discovery(
  '00000000-0000-0000-0000-0000000034c1',
  '00000000-0000-0000-0000-0000000034c0',
  'P3.4 accepted public-web enrichment'
) as enriched \gset

select pg_temp.p34_assert(
  :'enriched'::jsonb->>'status'='enriched_existing'
  and (:'enriched'::jsonb->>'merge_performed')::boolean=false
  and (:'enriched'::jsonb->>'company_fields_overwritten')::boolean=false,
  'enrichment must be additive and must not merge or overwrite company identity'
);

reset role;

select pg_temp.p34_assert(
  (select count(*) from public.network_companies where id='00000000-0000-0000-0000-0000000034c0')=1,
  'enrichment must not create a duplicate company'
);

select pg_temp.p34_assert(
  exists (
    select 1 from public.network_facilities f
    where f.company_id='00000000-0000-0000-0000-0000000034c0'
      and f.city='Torino'
      and f.publication_status='published'
      and f.verification_status='unverified'
  ),
  'accepted structured location must materialize as an unverified published facility'
);

select pg_temp.p34_assert(
  exists (
    select 1
    from public.network_facility_capabilities fc
    join public.network_facilities f on f.id=fc.facility_id
    join public.network_capabilities c on c.id=fc.capability_id
    where f.company_id='00000000-0000-0000-0000-0000000034c0'
      and c.canonical_key='laser_cutting'
  ),
  'single unambiguous facility may receive accepted capability evidence'
);

select pg_temp.p34_assert(
  exists (
    select 1
    from public.network_company_markets cm
    join public.network_markets m on m.id=cm.market_id
    where cm.company_id='00000000-0000-0000-0000-0000000034c0'
      and m.canonical_key='automotive'
  ),
  'accepted market evidence must materialize on the existing company'
);

select pg_temp.p34_assert(
  exists (
    select 1 from public.network_data_assertions a
    where a.entity_type='company'
      and a.entity_id='00000000-0000-0000-0000-0000000034c0'
      and a.field_path='p3_4_public_web_enrichment'
      and a.source_type='public_web'
      and a.review_state='accepted'
  ),
  'enrichment must preserve accepted public-web provenance'
);

select pg_temp.p34_assert(
  exists (
    select 1 from public.network_company_discovery_candidates
    where id='00000000-0000-0000-0000-0000000034c1'
      and review_status='enriched_existing'
      and promoted_company_id is null
  ),
  'enriched candidates must close without being promoted as new companies'
);

rollback;
