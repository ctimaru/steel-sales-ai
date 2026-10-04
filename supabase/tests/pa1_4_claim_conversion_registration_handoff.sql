-- PA1.4 — Claim Conversion & Registration Handoff acceptance.
-- Disposable CI transaction; all fixtures roll back.

begin;

create temp table pa14_state(
  key text primary key,
  value jsonb not null
) on commit drop;

grant select,insert,update,delete on table pa14_state to anon,authenticated;

create or replace function pg_temp.pa14_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA1.4 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.pa14_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'PA1.4 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'PA1.4 statement unexpectedly succeeded: %',statement;
end;
$$;

grant execute on function pg_temp.pa14_assert(boolean,text) to anon,authenticated;
grant execute on function pg_temp.pa14_assert_raises(text,text) to anon,authenticated;

insert into auth.users(id,email,email_confirmed_at)
values (
  '00000000-0000-0000-0000-000000014001'::uuid,
  'pa14-claimant@pa14-steel.example.test',
  now()
);

do $owner$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-000000014000'::uuid,
      'pa14-owner@example.test',
      now()
    ) on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-000000014000'::uuid,
      'platform_superadmin','active',null,'PA1.4 acceptance fallback owner'
    );
  end if;
end
$owner$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.network_companies(
  id,legal_name,trading_name,country_code,vat_id,website_url,website_domain,
  publication_status,claimed_status,verification_status
)
values(
  '00000000-0000-0000-0000-000000014020'::uuid,
  'PA14 Claimable Steel S.r.l.',
  'PA14 Steel',
  'IT',
  '99999014020',
  'https://pa14-steel.example.test',
  'pa14-steel.example.test',
  'published',
  'unclaimed',
  'unverified'
);

-- The anonymous acquisition surface exposes only minimal identity plus an
-- opaque handoff reference. It still cannot read the paid Network table.
set local role anon;
select set_config('request.jwt.claim.role','anon',true);

insert into pa14_state(key,value)
select 'lookup',public.pa1_2_company_lookup('99999014020');

select pg_temp.pa14_assert(
  (select value->'items'->0->>'claim_state' from pa14_state where key='lookup')='claimable'
  and (select value->'items'->0->>'claim_ref' from pa14_state where key='lookup') ~ '^[0-9a-f]{64}$',
  'public lookup must return a claimable opaque handoff reference'
);

select pg_temp.pa14_assert(
  not has_function_privilege(
    'anon',
    'public.pa1_4_company_claim_context(text)',
    'EXECUTE'
  ),
  'anonymous users must not resolve authenticated claim context'
);

reset role;

-- Verified applicant resolves the handoff without receiving premium Network access.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000014001',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into pa14_state(key,value)
select
  'context',
  public.pa1_4_company_claim_context(
    (select value->'items'->0->>'claim_ref' from pa14_state where key='lookup')
  );

select pg_temp.pa14_assert(
  (select (value->>'ok')::boolean from pa14_state where key='context')
  and (select value->>'legal_name' from pa14_state where key='context')='PA14 Claimable Steel S.r.l.'
  and (select (value->>'can_start_registration')::boolean from pa14_state where key='context')
  and not (select (value->>'network_access_included')::boolean from pa14_state where key='context'),
  'authenticated claim context must preserve identity without granting Network access'
);

select count(*) as hidden_network_rows
from public.network_companies
where id='00000000-0000-0000-0000-000000014020'::uuid
\gset

select pg_temp.pa14_assert(
  :'hidden_network_rows'::integer=0,
  'claim handoff must not open rich Network rows'
);

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name
)
values(
  'PA14 Claimable Steel S.r.l.','IT','producer','PA14 Claimant'
)
returning id as app_id \gset

insert into pa14_state(key,value)
select
  'bind',
  public.pa1_4_bind_registration_claim(
    :'app_id'::uuid,
    (select value->'items'->0->>'claim_ref' from pa14_state where key='lookup')
  );

select pg_temp.pa14_assert(
  (select (value->>'ok')::boolean from pa14_state where key='bind')
  and exists(
    select 1
    from public.company_registration_applications
    where id=:'app_id'::uuid
      and claim_target_network_company_id='00000000-0000-0000-0000-000000014020'::uuid
      and matched_network_company_id is null
      and claim_handoff_started_at is not null
  ),
  'bind must persist applicant claim intent without pretending the Network bridge is complete'
);

select pg_temp.pa14_assert_raises(
  format(
    $$update public.company_registration_applications
      set claim_target_network_company_id=%L::uuid
      where id=%L::uuid$$,
    '00000000-0000-0000-0000-000000014099',
    :'app_id'
  ),
  'governed RPCs'
);

insert into pa14_state(key,value)
select
  'recovered_context',
  public.pa1_4_registration_claim_context(:'app_id'::uuid);

select pg_temp.pa14_assert(
  (select value->>'claim_ref' from pa14_state where key='recovered_context')
    =
  (select value->'items'->0->>'claim_ref' from pa14_state where key='lookup'),
  'bound claim context must survive later registration visits'
);

select public.p0a_submit_registration_application(:'app_id'::uuid);

reset role;

-- Platform review selects the same existing identity explicitly. Activation
-- creates the Organization, approved claim and active managed-profile link.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into pa14_state(key,value)
select
  'activation',
  public.hp6_approve_and_activate_registration(
    :'app_id'::uuid,
    '00000000-0000-0000-0000-000000014020'::uuid
  );

select pg_temp.pa14_assert(
  (select value->>'status' from pa14_state where key='activation')='activated'
  and (select value->>'network_company_id' from pa14_state where key='activation')
      ='00000000-0000-0000-0000-000000014020',
  'controlled activation must bridge the registration to the selected existing profile'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000014001',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into pa14_state(key,value)
select
  'network_access',
  public.pa1_3_network_access_state(
    (select (value->>'organization_id')::uuid from pa14_state where key='activation')
  );

select pg_temp.pa14_assert(
  (select value->>'state' from pa14_state where key='network_access')='locked'
  and not (select (value->>'can_access_network')::boolean from pa14_state where key='network_access'),
  'registration and claim activation must not unlock the premium Network'
);

insert into pa14_state(key,value)
select 'managed_profile',public.m8_my_network_company();

select pg_temp.pa14_assert(
  (select value->>'network_company_id' from pa14_state where key='managed_profile')
    ='00000000-0000-0000-0000-000000014020'
  and (select value->>'claim_status' from pa14_state where key='managed_profile')='approved'
  and (select value->>'link_status' from pa14_state where key='managed_profile')='active',
  'activated claimant must manage the selected company profile even while Network browsing stays locked'
);

rollback;
