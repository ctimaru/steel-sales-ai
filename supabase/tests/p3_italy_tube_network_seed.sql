-- P3.1 — Italy Tube Network Seed & Claimable Directory acceptance.
begin;

create or replace function pg_temp.p31_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.1 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.p31_assert(
  (
    select count(*)=10
    from public.network_companies
    where id in (
      '51000000-0000-5000-8000-000000000001'::uuid,
      '51000000-0000-5000-8000-000000000002'::uuid,
      '51000000-0000-5000-8000-000000000003'::uuid,
      '51100000-0000-5000-8000-000000000001'::uuid,
      '51100000-0000-5000-8000-000000000002'::uuid,
      '51100000-0000-5000-8000-000000000003'::uuid,
      '51100000-0000-5000-8000-000000000004'::uuid,
      '51100000-0000-5000-8000-000000000005'::uuid,
      '51100000-0000-5000-8000-000000000006'::uuid,
      '51100000-0000-5000-8000-000000000007'::uuid
    )
      and publication_status='published'
      and claimed_status='unclaimed'
      and verification_status='unverified'
  ),
  'the ten P3.1 profiles must be published, unclaimed and explicitly unverified'
);

select pg_temp.p31_assert(
  (
    select count(*)=10
    from public.network_data_assertions
    where seed_batch_id='50000000-0000-5000-8000-000000000002'::uuid
      and field_path='p3_1_profile_snapshot'
      and review_state='accepted'
      and ownership_type='platform_curated'
      and source_type='imported_seed'
  ),
  'every seeded profile must preserve one accepted public-web provenance snapshot'
);

select pg_temp.p31_assert(
  (
    select count(distinct ra.company_id)=7
    from public.network_company_role_assignments ra
    join public.network_company_roles r on r.id=ra.role_id
    where r.canonical_key='producer'
      and ra.company_id in (
        '51000000-0000-5000-8000-000000000001'::uuid,
        '51000000-0000-5000-8000-000000000002'::uuid,
        '51000000-0000-5000-8000-000000000003'::uuid,
        '51100000-0000-5000-8000-000000000001'::uuid,
        '51100000-0000-5000-8000-000000000002'::uuid,
        '51100000-0000-5000-8000-000000000003'::uuid,
        '51100000-0000-5000-8000-000000000004'::uuid,
        '51100000-0000-5000-8000-000000000005'::uuid,
        '51100000-0000-5000-8000-000000000006'::uuid,
        '51100000-0000-5000-8000-000000000007'::uuid
      )
  ),
  'P3.1 must expose seven producer-role companies'
);

select pg_temp.p31_assert(
  (
    select count(distinct ra.company_id)=3
    from public.network_company_role_assignments ra
    join public.network_company_roles r on r.id=ra.role_id
    where r.canonical_key='trader_distributor'
      and ra.company_id in (
        '51100000-0000-5000-8000-000000000004'::uuid,
        '51100000-0000-5000-8000-000000000005'::uuid,
        '51100000-0000-5000-8000-000000000006'::uuid
      )
  ),
  'P3.1 must expose three trader/distributor companies'
);

select pg_temp.p31_assert(
  (
    select count(distinct ra.company_id)=2
    from public.network_company_role_assignments ra
    join public.network_company_roles r on r.id=ra.role_id
    where r.canonical_key='processor_service_provider'
      and ra.company_id in (
        '51100000-0000-5000-8000-000000000005'::uuid,
        '51100000-0000-5000-8000-000000000007'::uuid
      )
  ),
  'P3.1 must expose two processor/service-provider companies'
);

select pg_temp.p31_assert(
  (
    select count(distinct cp.company_id)=10
    from public.network_company_products cp
    join public.network_product_families p on p.id=cp.product_family_id
    where p.canonical_key='tubes_pipes'
      and cp.company_id in (
        '51000000-0000-5000-8000-000000000001'::uuid,
        '51000000-0000-5000-8000-000000000002'::uuid,
        '51000000-0000-5000-8000-000000000003'::uuid,
        '51100000-0000-5000-8000-000000000001'::uuid,
        '51100000-0000-5000-8000-000000000002'::uuid,
        '51100000-0000-5000-8000-000000000003'::uuid,
        '51100000-0000-5000-8000-000000000004'::uuid,
        '51100000-0000-5000-8000-000000000005'::uuid,
        '51100000-0000-5000-8000-000000000006'::uuid,
        '51100000-0000-5000-8000-000000000007'::uuid
      )
  ),
  'all P3.1 companies must have a tubes_pipes relationship'
);

insert into auth.users(id,email)
values ('00000000-0000-0000-0000-0000000031a1','p31@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values (
  '00000000-0000-0000-0000-0000000031f1',
  'P31 Claim Org',
  'p31-claim-org',
  '00000000-0000-0000-0000-0000000031a1',
  'completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
)
values (
  '00000000-0000-0000-0000-0000000031f1',
  '00000000-0000-0000-0000-0000000031a1',
  'admin','sales_director','active',true
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000031a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.m6_search_network(
  null,array['producer'],array['tubes_pipes'],null,array['IT'],null,50,0
) as producer_payload \gset

select pg_temp.p31_assert(
  (:'producer_payload'::jsonb->>'total')::int>=7,
  'producer submenu filter must include the seven P3.1 tube producers'
);

select public.m6_search_network(
  null,array['trader_distributor'],array['tubes_pipes'],null,array['IT'],null,50,0
) as trader_payload \gset

select pg_temp.p31_assert(
  (:'trader_payload'::jsonb->>'total')::int>=3,
  'trader submenu filter must include the three P3.1 tube traders'
);

select public.m6_search_network(
  null,array['processor_service_provider'],array['tubes_pipes'],null,array['IT'],null,50,0
) as processor_payload \gset

select pg_temp.p31_assert(
  (:'processor_payload'::jsonb->>'total')::int>=2,
  'processor submenu filter must include the two P3.1 tube processors'
);

select public.m4_request_company_claim(
  '51100000-0000-5000-8000-000000000001'::uuid,
  '00000000-0000-0000-0000-0000000031f1'::uuid,
  'P3.1 claim acceptance'
) as claim_id \gset

select pg_temp.p31_assert(
  :'claim_id'::uuid is not null,
  'a seeded unclaimed company must accept a valid organization-admin claim request'
);

select public.m6_network_company_profile(
  '51100000-0000-5000-8000-000000000001'::uuid
) as claimed_profile \gset

select pg_temp.p31_assert(
  :'claimed_profile'::jsonb#>>'{company,claimed_status}'='pending',
  'claim request must move only claimed_status to pending'
);

select pg_temp.p31_assert(
  :'claimed_profile'::jsonb#>>'{company,verification_status}'='unverified',
  'claim request must never imply verification'
);

reset role;

select pg_temp.p31_assert(
  (
    select count(*)=1
    from public.network_company_claims
    where id=:'claim_id'::uuid
      and status='requested'
      and network_company_id='51100000-0000-5000-8000-000000000001'::uuid
  ),
  'claim request must be audit-visible in the claim ledger'
);

rollback;
