-- ONBOARDING-SELF1 · Fase 1 — self-service activation acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.self1_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SELF1 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.self1_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SELF1 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SELF1 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000c101'::uuid,'self1-eligible@selfact1-7q4.example.test',now()),
  ('00000000-0000-0000-0000-00000000c102'::uuid,'self1-badvat@selfact1-8r5.example.test',now()),
  ('00000000-0000-0000-0000-00000000c103'::uuid,'self1-duplicate@selfact1-9s6.example.test',now()),
  ('00000000-0000-0000-0000-00000000c104'::uuid,'self1-intruder@selfact1-0t7.example.test',now())
on conflict (id) do nothing;

-- Pure helpers.
select pg_temp.self1_assert(private.selfact1_italian_vat_valid('12345678903'),'valid VAT accepted');
select pg_temp.self1_assert(private.selfact1_italian_vat_valid('IT 135.792.468-05'),'formatted VAT accepted');
select pg_temp.self1_assert(not private.selfact1_italian_vat_valid('13579246801'),'wrong check digit rejected');
select pg_temp.self1_assert(not private.selfact1_italian_vat_valid('00000000000'),'all zeros rejected');
select pg_temp.self1_assert(not private.selfact1_italian_vat_valid(null),'null rejected');

-- Cores are not callable by clients; staff wrappers keep their permission checks.
select pg_temp.self1_assert(
  not has_function_privilege('authenticated','private.selfact1_activation_core(uuid,uuid,uuid,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','private.selfact1_bridge_core(uuid,uuid,uuid,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','private.selfact1_candidates_core(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.selfact1_self_activate_registration(uuid)','EXECUTE'),
  'self-service cores stay private'
);
select pg_temp.self1_assert(
  pg_get_functiondef('private.hp1_1_activate_registration_application_impl(uuid,uuid)'::regprocedure) like '%require_platform_permission(''registrations.activate'')%'
  and pg_get_functiondef('private.m7_bridge_registration_impl(uuid,uuid)'::regprocedure) like '%require_platform_permission(''registrations.bridge_network'')%'
  and pg_get_functiondef('private.m7_application_candidates_impl(uuid)'::regprocedure) like '%require_platform_permission(''registrations.bridge_network'')%',
  'staff wrappers still require their platform permissions'
);

-- 1. Eligible new Italian company: activated at once, as self_service.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c101',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,vat_id,website_url,primary_company_type,contact_name
) values (
  'SELF1 Acciai Collaudo 7Q4','IT','12345678903','https://selfact1-7q4.example.test','trader_distributor','Tester'
) returning id as eligible_app_id \gset

select public.p0a_submit_registration_application(:'eligible_app_id'::uuid);
select public.selfact1_self_activate_registration(:'eligible_app_id'::uuid) as self_result \gset

select pg_temp.self1_assert(
  (:'self_result'::jsonb->>'activated')::boolean
  and (:'self_result'::jsonb->>'activation_mode')='self_service'
  and (:'self_result'::jsonb->>'status')='activated'
  and (:'self_result'::jsonb->>'network_company_id') is not null,
  'eligible application is activated through self-service: '||:'self_result'
);

-- Idempotent replay.
select public.selfact1_self_activate_registration(:'eligible_app_id'::uuid) as self_replay \gset
select pg_temp.self1_assert(
  (:'self_replay'::jsonb->>'idempotent_replay')::boolean
  and (:'self_replay'::jsonb->>'organization_id')=(:'self_result'::jsonb->>'organization_id'),
  'second call is an idempotent replay'
);

reset role;

select pg_temp.self1_assert(
  exists (
    select 1
    from public.company_registration_applications a
    join public.organization_memberships m
      on m.organization_id=a.activated_organization_id
     and m.user_id=a.applicant_user_id
    where a.id=:'eligible_app_id'::uuid
      and a.application_status='activated'
      and a.activation_mode='self_service'
      and a.reviewed_by=a.applicant_user_id
      and m.role='admin'
      and m.status='active'
  ),
  'self-service activation creates the organization and an active admin membership'
);

select pg_temp.self1_assert(
  exists (
    select 1
    from public.company_registration_applications a
    join public.network_companies c on c.id=a.matched_network_company_id
    join public.network_company_claims cl on cl.network_company_id=c.id and cl.organization_id=a.activated_organization_id
    where a.id=:'eligible_app_id'::uuid
      and c.verification_status='unverified'
      and cl.status='approved'
      and cl.proof_method='registration_bridge'
  ),
  'new Network profile is created unverified and owned through the registration bridge'
);

select pg_temp.self1_assert(
  exists (
    select 1 from public.platform_registration_events e
    where e.application_id=:'eligible_app_id'::uuid
      and e.event_type='application_approved'
      and e.actor_type='system'
      and e.metadata->>'activation_mode'='self_service'
  )
  and exists (
    select 1 from public.platform_registration_events e
    where e.application_id=:'eligible_app_id'::uuid
      and e.event_type='activation_completed'
      and e.actor_type='system'
  ),
  'self-service decisions are audited as system events'
);

-- 2. Invalid Italian VAT: stays in staff review.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c102',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,vat_id,website_url,primary_company_type,contact_name
) values (
  'SELF1 Tubi Collaudo 8R5','IT','13579246801','https://selfact1-8r5.example.test','end_user','Tester'
) returning id as badvat_app_id \gset

select public.p0a_submit_registration_application(:'badvat_app_id'::uuid);
select public.selfact1_self_activate_registration(:'badvat_app_id'::uuid) as badvat_result \gset

select pg_temp.self1_assert(
  not (:'badvat_result'::jsonb->>'activated')::boolean
  and (:'badvat_result'::jsonb->'reasons') ? 'vat_invalid'
  and (:'badvat_result'::jsonb->>'status')='pending_review',
  'invalid VAT goes to staff review'
);

-- A non-staff user still cannot use the staff activation path.
select pg_temp.self1_assert_raises(
  format('select public.p0a_activate_registration_application(%L::uuid)', :'badvat_app_id'),
  ''
);

reset role;

select pg_temp.self1_assert(
  (select application_status='pending_review' and activation_mode='staff_review'
   from public.company_registration_applications where id=:'badvat_app_id'::uuid),
  'ineligible application is untouched'
);

-- 3. Same VAT as an existing company: staff review.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c103',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,vat_id,website_url,primary_company_type,contact_name
) values (
  'SELF1 Altra Ragione 9S6','IT','IT12345678903','https://selfact1-9s6.example.test','producer','Tester'
) returning id as duplicate_app_id \gset

select public.p0a_submit_registration_application(:'duplicate_app_id'::uuid);
select public.selfact1_self_activate_registration(:'duplicate_app_id'::uuid) as duplicate_result \gset

select pg_temp.self1_assert(
  not (:'duplicate_result'::jsonb->>'activated')::boolean
  and (
    (:'duplicate_result'::jsonb->'reasons') ? 'identity_candidates'
    or (:'duplicate_result'::jsonb->'reasons') ? 'duplicate_application'
  ),
  'VAT already in use goes to staff review: '||:'duplicate_result'
);

-- 4. Nobody can self-activate someone else's application.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c104',true);
select pg_temp.self1_assert_raises(
  format('select public.selfact1_self_activate_registration(%L::uuid)', :'duplicate_app_id'),
  'not allowed to activate this registration application'
);

reset role;

rollback;
