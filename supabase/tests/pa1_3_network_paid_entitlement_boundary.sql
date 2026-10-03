-- PA1.3 — Network Paid Access & Entitlement Boundary acceptance.
-- Disposable CI transaction; all fixtures roll back.

begin;

create or replace function pg_temp.pa13_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA1.3 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.pa13_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'PA1.3 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'PA1.3 statement unexpectedly succeeded: %',statement;
end;
$$;

-- Keep singleton Platform Owner invariant while making acceptance self-contained.
update public.platform_user_roles
set status='revoked',revoked_at=now(),reason='PA1.3 acceptance temporary root replacement'
where role='platform_superadmin' and status='active';

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000013001'::uuid,'pa13-member@example.test',now()),
  ('00000000-0000-0000-0000-000000013002'::uuid,'pa13-owner@example.test',now());

insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
values(
  '00000000-0000-0000-0000-000000013002'::uuid,
  'platform_superadmin',
  'active',
  null,
  'PA1.3 acceptance root'
);

insert into public.organizations(id,name,slug,created_by,country_code,industry)
values(
  '00000000-0000-0000-0000-000000013010'::uuid,
  'PA1.3 Locked Organization',
  'pa13-locked-org',
  '00000000-0000-0000-0000-000000013001'::uuid,
  'IT',
  'steel'
);

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
)
values(
  '00000000-0000-0000-0000-000000013010'::uuid,
  '00000000-0000-0000-0000-000000013001'::uuid,
  'admin',
  'active',
  true
);

insert into public.network_companies(
  id,legal_name,trading_name,country_code,vat_id,website_url,website_domain,
  description,publication_status,claimed_status,verification_status
)
values(
  '00000000-0000-0000-0000-000000013020'::uuid,
  'PA1.3 Target Steel S.r.l.',
  'PA1.3 Target',
  'IT',
  '99999013020',
  'https://pa13-target.example.test',
  'pa13-target.example.test',
  'PA1.3 entitlement acceptance target',
  'published',
  'pending',
  'unverified'
);

insert into public.network_company_claims(
  id,network_company_id,organization_id,requested_by,status,request_note
)
values(
  '00000000-0000-0000-0000-000000013021'::uuid,
  '00000000-0000-0000-0000-000000013020'::uuid,
  '00000000-0000-0000-0000-000000013010'::uuid,
  '00000000-0000-0000-0000-000000013001'::uuid,
  'requested',
  'PA1.3 claim remains outside paid Network'
);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000013001',true);

select public.pa1_3_network_access_state(
  '00000000-0000-0000-0000-000000013010'::uuid
) as locked_state \gset

select pg_temp.pa13_assert(
  :'locked_state'::jsonb->>'state'='locked'
  and (:'locked_state'::jsonb->>'can_access_network')::boolean=false,
  'registered organization must start with Network locked'
);

select count(*) as locked_company_count
from public.network_companies
where id='00000000-0000-0000-0000-000000013020'::uuid
\gset

select pg_temp.pa13_assert(
  :'locked_company_count'::integer=0,
  'RLS must hide rich Network company rows while locked'
);

select pg_temp.pa13_assert_raises(
  $$select public.p3_7c_public_company_profile('00000000-0000-0000-0000-000000013020'::uuid)$$,
  'Network entitlement required'
);

select pg_temp.pa13_assert_raises(
  $$select public.p4_follow_state(
    '00000000-0000-0000-0000-000000013010'::uuid,
    '00000000-0000-0000-0000-000000013020'::uuid
  )$$,
  'Network entitlement required'
);

select pg_temp.pa13_assert_raises(
  $$select public.pa1_3_grant_network_access(
    '00000000-0000-0000-0000-000000013010'::uuid,
    'manual',
    'self-grant',
    null,
    'pa13.self.grant.001',
    '{}'::jsonb
  )$$,
  'Network entitlement authority required'
);

-- Claim state remains available without the paid Network entitlement.
select public.p3_6_my_company_claim(
  '00000000-0000-0000-0000-000000013020'::uuid,
  '00000000-0000-0000-0000-000000013010'::uuid
) as claim_state \gset

select pg_temp.pa13_assert(
  :'claim_state'::jsonb->>'status'='requested',
  'claim lifecycle must remain available while Network browsing is locked'
);

-- Platform Owner can operate the Network and grant access.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000013002',true);

select public.pa1_3_network_access_state(
  '00000000-0000-0000-0000-000000013010'::uuid
) as owner_state \gset

select pg_temp.pa13_assert(
  :'owner_state'::jsonb->>'state'='entitled'
  and :'owner_state'::jsonb->>'source_kind'='platform_owner',
  'Platform Owner must keep operational Network override'
);

select public.pa1_3_grant_network_access(
  '00000000-0000-0000-0000-000000013010'::uuid,
  'subscription',
  'test:network-plus',
  null,
  'pa13.subscription.grant.001',
  '{"plan":"network_plus"}'::jsonb
) as first_grant \gset

select public.pa1_3_grant_network_access(
  '00000000-0000-0000-0000-000000013010'::uuid,
  'subscription',
  'test:network-plus',
  null,
  'pa13.subscription.grant.001',
  '{"plan":"network_plus"}'::jsonb
) as repeated_grant \gset

select pg_temp.pa13_assert(
  (:'first_grant'::jsonb->>'idempotent')::boolean=false
  and (:'repeated_grant'::jsonb->>'idempotent')::boolean=true,
  'grant must be idempotent'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000013001',true);

select public.pa1_3_network_access_state(
  '00000000-0000-0000-0000-000000013010'::uuid
) as entitled_state \gset

select pg_temp.pa13_assert(
  :'entitled_state'::jsonb->>'state'='entitled'
  and (:'entitled_state'::jsonb->>'can_access_network')::boolean=true
  and :'entitled_state'::jsonb->>'source_kind'='subscription',
  'granted organization must resolve entitled'
);

select count(*) as entitled_company_count
from public.network_companies
where id='00000000-0000-0000-0000-000000013020'::uuid
\gset

select pg_temp.pa13_assert(
  :'entitled_company_count'::integer=1,
  'RLS must allow paid Network rows after entitlement'
);

select pg_temp.pa13_assert(
  public.p3_7c_public_company_profile(
    '00000000-0000-0000-0000-000000013020'::uuid
  ) is not null,
  'rich Network profile RPC must work after entitlement'
);

-- Revoke access append-only.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000013002',true);

select public.pa1_3_revoke_network_access(
  '00000000-0000-0000-0000-000000013010'::uuid,
  'subscription',
  'test:network-plus',
  'pa13.subscription.revoke.001',
  '{"reason":"acceptance"}'::jsonb
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000013001',true);

select public.pa1_3_network_access_state(
  '00000000-0000-0000-0000-000000013010'::uuid
) as revoked_state \gset

select pg_temp.pa13_assert(
  :'revoked_state'::jsonb->>'state'='revoked'
  and (:'revoked_state'::jsonb->>'can_access_network')::boolean=false,
  'latest revoke must close Network access'
);

select count(*) as revoked_company_count
from public.network_companies
where id='00000000-0000-0000-0000-000000013020'::uuid
\gset

select pg_temp.pa13_assert(
  :'revoked_company_count'::integer=0,
  'RLS must close rich Network rows after revoke'
);

reset role;

select pg_temp.pa13_assert(
  not has_table_privilege(
    'authenticated',
    'public.organization_product_entitlement_events',
    'SELECT'
  ),
  'authenticated users must not read the raw entitlement ledger'
);

select pg_temp.pa13_assert(
  not has_function_privilege(
    'anon',
    'public.pa1_3_network_access_state(uuid)',
    'EXECUTE'
  ),
  'anonymous users must not call Network entitlement state'
);

rollback;
