-- SA6 — Claims & Verification Delegation Cutover acceptance.
begin;

create or replace function pg_temp.sa6_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SA6 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.sa6_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SA6 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SA6 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a601'::uuid,'sa6-claims-admin@example.com',now()),
  ('00000000-0000-0000-0000-00000000a602'::uuid,'sa6-platform-auditor@example.com',now()),
  ('00000000-0000-0000-0000-00000000a603'::uuid,'sa6-outsider@example.com',now()),
  ('00000000-0000-0000-0000-00000000a604'::uuid,'sa6-claimant@example.com',now())
on conflict (id) do nothing;

do $root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000a600'::uuid,'sa6-owner@example.com',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000a600'::uuid,
      'platform_superadmin','active',null,'SA6 acceptance fallback owner'
    );
  end if;
end
$root$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.platform_staff(user_id,status,activated_at,updated_at)
values
  ('00000000-0000-0000-0000-00000000a601'::uuid,'active',now(),now()),
  ('00000000-0000-0000-0000-00000000a602'::uuid,'active',now(),now())
on conflict (user_id) do update
set status='active',suspended_at=null,revoked_at=null,updated_at=now();

insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
  ('00000000-0000-0000-0000-00000000a601'::uuid,'claims_verification_admin','active',:'owner_id'::uuid,'SA6 acceptance'),
  ('00000000-0000-0000-0000-00000000a602'::uuid,'platform_auditor','active',:'owner_id'::uuid,'SA6 acceptance');

insert into public.organizations(id,name,slug,created_by)
values (
  '00000000-0000-0000-0000-00000000a610'::uuid,
  'SA6 Claimant Organization',
  'sa6-claimant-organization',
  '00000000-0000-0000-0000-00000000a604'::uuid
);

insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
)
values
(
  '00000000-0000-0000-0000-00000000a620'::uuid,
  'SA6 Approval Target S.r.l.','IT',
  'https://sa6-approval.example/','sa6-approval.example',
  'published','pending','unverified'
),
(
  '00000000-0000-0000-0000-00000000a621'::uuid,
  'SA6 Rejection Target S.r.l.','IT',
  'https://sa6-rejection.example/','sa6-rejection.example',
  'published','pending','unverified'
);

insert into public.network_company_claims(
  id,network_company_id,organization_id,requested_by,status,request_note,
  proof_method,proof_status
)
values
(
  '00000000-0000-0000-0000-00000000a630'::uuid,
  '00000000-0000-0000-0000-00000000a620'::uuid,
  '00000000-0000-0000-0000-00000000a610'::uuid,
  '00000000-0000-0000-0000-00000000a604'::uuid,
  'requested','SA6 approval fixture','manual_review','pending'
),
(
  '00000000-0000-0000-0000-00000000a631'::uuid,
  '00000000-0000-0000-0000-00000000a621'::uuid,
  '00000000-0000-0000-0000-00000000a610'::uuid,
  '00000000-0000-0000-0000-00000000a604'::uuid,
  'requested','SA6 rejection fixture','manual_review','pending'
);

-- Claims & Verification Admin gets the claims capability set only.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a601',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa6_assert(
  public.has_platform_permission('platform.console.access')
  and public.has_platform_permission('claims.read')
  and public.has_platform_permission('claims.review_proof')
  and public.has_platform_permission('claims.approve')
  and public.has_platform_permission('claims.reject')
  and public.has_platform_permission('claims.revoke'),
  'Claims & Verification Admin must receive the complete Company Claims capability set'
);

select pg_temp.sa6_assert(
  not public.has_platform_permission('registrations.read')
  and not public.has_platform_permission('discovery.read')
  and not public.has_platform_permission('knowledge.read_drafts')
  and not public.has_platform_permission('platform.staff.read'),
  'Claims & Verification Admin must remain outside Registrations, Discovery, Knowledge and staff governance'
);

select public.p3_6_admin_claim_queue(null,100) as initial_queue \gset
select pg_temp.sa6_assert(
  (:'initial_queue'::jsonb->>'total')::integer>=2
  and exists (
    select 1
    from jsonb_array_elements(:'initial_queue'::jsonb->'items') item
    where item->>'claim_id'='00000000-0000-0000-0000-00000000a630'
  ),
  'Claims & Verification Admin must read the claims queue'
);

-- Approval remains impossible until ownership proof is verified.
select pg_temp.sa6_assert_raises(
  $$select public.m4_review_company_claim(
      '00000000-0000-0000-0000-00000000a630'::uuid,
      'approved',
      'must fail before proof'
    )$$,
  'verified ownership proof required'
);

select public.m4_review_company_claim(
  '00000000-0000-0000-0000-00000000a630'::uuid,
  'under_review',
  'SA6 delegated review start'
) as review_payload \gset

select public.p3_6_review_claim_proof(
  '00000000-0000-0000-0000-00000000a630'::uuid,
  'verified',
  'SA6 delegated ownership verification'
) as proof_payload \gset

select pg_temp.sa6_assert(
  :'review_payload'::jsonb->>'status'='under_review'
  and :'proof_payload'::jsonb->>'proof_status'='verified',
  'claims.review_proof must support review start and ownership-proof verification'
);

select public.m4_review_company_claim(
  '00000000-0000-0000-0000-00000000a630'::uuid,
  'approved',
  'SA6 delegated claim approval'
) as approved_payload \gset

select pg_temp.sa6_assert(
  :'approved_payload'::jsonb->>'status'='approved'
  and :'approved_payload'::jsonb->>'proof_status'='verified'
  and :'approved_payload'::jsonb->>'verification_status'='unverified',
  'claims.approve must activate ownership without changing Network verification'
);

reset role;

select pg_temp.sa6_assert(
  exists (
    select 1
    from public.organization_network_company_links l
    where l.claim_id='00000000-0000-0000-0000-00000000a630'::uuid
      and l.organization_id='00000000-0000-0000-0000-00000000a610'::uuid
      and l.network_company_id='00000000-0000-0000-0000-00000000a620'::uuid
      and l.link_status='active'
  )
  and exists (
    select 1 from public.network_companies
    where id='00000000-0000-0000-0000-00000000a620'::uuid
      and claimed_status='claimed'
      and verification_status='unverified'
  ),
  'delegated approval must create only the claimant Organization control link and preserve unverified status'
);

select pg_temp.sa6_assert(
  not exists (
    select 1 from public.organization_memberships
    where user_id='00000000-0000-0000-0000-00000000a601'::uuid
  ),
  'Claims & Verification Admin must not gain tenant membership'
);

-- Network verification remains Platform Owner-only.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a601',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa6_assert_raises(
  $$select public.m4_record_verification(
      'company',
      '00000000-0000-0000-0000-00000000a620'::uuid,
      'verified',
      '00000000-0000-0000-0000-00000000a699'::uuid,
      null,
      'SA6 must not allow this'
    )$$,
  'platform superadmin required'
);

-- Proof rejection + claim rejection are also delegated and audited.
select public.p3_6_review_claim_proof(
  '00000000-0000-0000-0000-00000000a631'::uuid,
  'rejected',
  'SA6 invalid ownership evidence'
) as rejected_proof_payload \gset

select public.m4_review_company_claim(
  '00000000-0000-0000-0000-00000000a631'::uuid,
  'rejected',
  'SA6 delegated claim rejection'
) as rejected_claim_payload \gset

select pg_temp.sa6_assert(
  :'rejected_proof_payload'::jsonb->>'proof_status'='rejected'
  and :'rejected_claim_payload'::jsonb->>'status'='rejected',
  'Claims admin must reject invalid proof and the related claim'
);

select public.m4_review_company_claim(
  '00000000-0000-0000-0000-00000000a630'::uuid,
  'revoked',
  'SA6 delegated control revocation'
) as revoked_payload \gset

select pg_temp.sa6_assert(
  :'revoked_payload'::jsonb->>'status'='revoked'
  and :'revoked_payload'::jsonb->>'verification_status'='unverified',
  'claims.revoke must remove control without changing Network verification'
);

reset role;

select pg_temp.sa6_assert(
  exists (
    select 1 from public.organization_network_company_links
    where claim_id='00000000-0000-0000-0000-00000000a630'::uuid
      and link_status='revoked'
  )
  and exists (
    select 1 from public.network_companies
    where id='00000000-0000-0000-0000-00000000a620'::uuid
      and claimed_status='revoked'
      and verification_status='unverified'
  ),
  'revocation must revoke the control link and preserve Network verification'
);

select pg_temp.sa6_assert(
  exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a601'::uuid
      and permission_key='claims.review_proof'
      and action='company_claim_proof_verified'
      and entity_id='00000000-0000-0000-0000-00000000a630'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a601'::uuid
      and permission_key='claims.approve'
      and action='company_claim_approved'
      and entity_id='00000000-0000-0000-0000-00000000a630'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a601'::uuid
      and permission_key='claims.reject'
      and action='company_claim_rejected'
      and entity_id='00000000-0000-0000-0000-00000000a631'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a601'::uuid
      and permission_key='claims.revoke'
      and action='company_claim_revoked'
      and entity_id='00000000-0000-0000-0000-00000000a630'
  ),
  'delegated Company Claims mutations must record permission-aware global audit events'
);

-- Platform Auditor sees Claims but cannot mutate.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a602',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa6_assert(
  public.has_platform_permission('claims.read')
  and not public.has_platform_permission('claims.review_proof')
  and not public.has_platform_permission('claims.approve')
  and not public.has_platform_permission('claims.reject')
  and not public.has_platform_permission('claims.revoke'),
  'Platform Auditor must remain read-only for Company Claims'
);

select pg_temp.sa6_assert(
  jsonb_typeof(public.p3_6_admin_claim_queue(null,10)->'items')='array',
  'Platform Auditor must read the Company Claims queue'
);

select pg_temp.sa6_assert_raises(
  $$select public.p3_6_review_claim_proof(
      '00000000-0000-0000-0000-00000000a631'::uuid,
      'verified',
      'denied'
    )$$,
  'Platform permission required'
);

-- Normal authenticated users cannot read the Claims control plane.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a603',true);

select pg_temp.sa6_assert_raises(
  'select public.p3_6_admin_claim_queue(null,10)',
  'Platform permission required'
);

-- Platform Owner retains implicit access to every claims capability.
select set_config('request.jwt.claim.sub',:'owner_id',true);
select pg_temp.sa6_assert(
  public.has_platform_permission('claims.read')
  and public.has_platform_permission('claims.review_proof')
  and public.has_platform_permission('claims.approve')
  and public.has_platform_permission('claims.reject')
  and public.has_platform_permission('claims.revoke')
  and jsonb_typeof(public.p3_6_admin_claim_queue(null,10)->'items')='array',
  'Platform Owner must retain uninterrupted Company Claims access'
);

rollback;
