-- ONBOARDING-SELF1 · Fase 2 — "Azienda verificata" badge acceptance (SELFVER1).
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.sv_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'SELFVER1 assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.sv_assert_raises(statement text, expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise exception 'SELFVER1 expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'SELFVER1 statement unexpectedly succeeded: %', statement;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000d201'::uuid, 'owner@selfver1-dom.example.test', now()),
  ('00000000-0000-0000-0000-00000000d202'::uuid, 'selfver1.generic@gmail.com', now()),
  ('00000000-0000-0000-0000-00000000d203'::uuid, 'owner@selfver1-shared.example.test', now()),
  ('00000000-0000-0000-0000-00000000d204'::uuid, 'outsider@selfver1-out.example.test', now())
on conflict (id) do nothing;

-- Pure helpers.
select pg_temp.sv_assert(private.selfver1_normalize_domain('https://www.Acciai-Rossi.example.test/chi-siamo') = 'acciai-rossi.example.test', 'domain normalization');
select pg_temp.sv_assert(private.selfver1_normalize_domain('') is null, 'empty domain is null');
select pg_temp.sv_assert(private.selfver1_is_generic_domain('gmail.com'), 'gmail is generic');
select pg_temp.sv_assert(private.selfver1_is_generic_domain('mario.pec.it') and private.selfver1_is_generic_domain('pec.azienda.it'), 'PEC is generic');
select pg_temp.sv_assert(not private.selfver1_is_generic_domain('acciai-rossi.example.test'), 'company domain is not generic');

-- Privileges: cores private, wrappers invoker, nothing for anon.
select pg_temp.sv_assert(
  not has_function_privilege('authenticated', 'private.selfver1_signals(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.selfver1_require_member(uuid,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.selfver1_try_auto_verify(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.selfver1_my_verification_state(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.selfver1_request_manual_verification(uuid,text)', 'EXECUTE'),
  'SELFVER1 cores stay private and anon has no access'
);
select pg_temp.sv_assert(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.selfver1_try_auto_verify(uuid)'::regprocedure)
  and not (select p.prosecdef from pg_proc p where p.oid = 'public.selfver1_my_verification_state(uuid)'::regprocedure)
  and not (select p.prosecdef from pg_proc p where p.oid = 'public.selfver1_request_manual_verification(uuid,text)'::regprocedure),
  'public wrappers are security invoker (HP13 allowlist unchanged)'
);

create or replace function pg_temp.sv_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- Fixtures through the existing SELF1 self-service activation path.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000d201',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.company_registration_applications(legal_name,country_code,vat_id,website_url,primary_company_type,contact_name)
values ('SELFVER1 Acciai Dominio','IT','12345678903','https://selfver1-dom.example.test','trader_distributor','Tester') returning id as org_dom_app \gset
select public.p0a_submit_registration_application(:'org_dom_app'::uuid);
select public.selfact1_self_activate_registration(:'org_dom_app'::uuid) as org_dom_activation \gset
reset role;
select pg_temp.sv_assert((:'org_dom_activation'::jsonb->>'activated')::boolean, 'fixture org_dom activated: ' || :'org_dom_activation');
select :'org_dom_activation'::jsonb->>'organization_id' as org_dom \gset
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000d202',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.company_registration_applications(legal_name,country_code,vat_id,website_url,primary_company_type,contact_name)
values ('SELFVER1 Tubi Generico','IT','24680135795','https://selfver1-gen.example.test','trader_distributor','Tester') returning id as org_gen_app \gset
select public.p0a_submit_registration_application(:'org_gen_app'::uuid);
select public.selfact1_self_activate_registration(:'org_gen_app'::uuid) as org_gen_activation \gset
reset role;
select pg_temp.sv_assert((:'org_gen_activation'::jsonb->>'activated')::boolean, 'fixture org_gen activated: ' || :'org_gen_activation');
select :'org_gen_activation'::jsonb->>'organization_id' as org_gen \gset
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000d203',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.company_registration_applications(legal_name,country_code,vat_id,website_url,primary_company_type,contact_name)
values ('SELFVER1 Profili Condivisi','IT','35790246801','https://selfver1-shared.example.test','trader_distributor','Tester') returning id as org_shared_app \gset
select public.p0a_submit_registration_application(:'org_shared_app'::uuid);
select public.selfact1_self_activate_registration(:'org_shared_app'::uuid) as org_shared_activation \gset
reset role;
select pg_temp.sv_assert((:'org_shared_activation'::jsonb->>'activated')::boolean, 'fixture org_shared activated: ' || :'org_shared_activation');
select :'org_shared_activation'::jsonb->>'organization_id' as org_shared \gset

-- 1. Matching domain + valid VAT + unique domain: verified automatically, once.
select pg_temp.sv_as('00000000-0000-0000-0000-00000000d201');
set local role authenticated;
select public.selfver1_my_verification_state(:'org_dom'::uuid) as state_before \gset
select pg_temp.sv_assert(
  (:'state_before'::jsonb->>'verification_status') = 'unverified'
  and (:'state_before'::jsonb->>'auto_eligible')::boolean
  and jsonb_array_length(:'state_before'::jsonb->'reasons') = 0
  and position('@' in :'state_before') = 0,
  'eligible company is auto-eligible and the state exposes no e-mail address: ' || :'state_before'
);
select public.selfver1_try_auto_verify(:'org_dom'::uuid) as auto_result \gset
select public.selfver1_try_auto_verify(:'org_dom'::uuid) as auto_replay \gset
reset role;
select pg_temp.sv_assert((:'auto_result'::jsonb->>'verified')::boolean, 'automatic verification succeeds: ' || :'auto_result');
select pg_temp.sv_assert((:'auto_replay'::jsonb->>'verified')::boolean and :'auto_replay'::jsonb->>'verification_id' is null, 'replay is idempotent');
select pg_temp.sv_assert(
  (select count(*) from public.network_verifications v
     join public.organization_network_company_links l on l.network_company_id = v.company_id
   where l.organization_id = :'org_dom'::uuid and v.scope = 'company') = 1
  and exists (
    select 1 from public.network_verifications v
    join public.organization_network_company_links l on l.network_company_id = v.company_id
    join public.network_companies c on c.id = v.company_id
    join public.network_data_assertions a on a.id = v.evidence_assertion_id
    where l.organization_id = :'org_dom'::uuid and v.is_current and v.status = 'verified'
      and v.method = 'automatic_domain' and c.verification_status = 'verified'
      and a.source_type = 'system_derived' and a.review_state = 'accepted'
  ),
  'one current automatic verification row with an accepted system assertion'
);

-- 2. Generic mailbox: not verified; admin opens a manual request exactly once.
select pg_temp.sv_as('00000000-0000-0000-0000-00000000d202');
set local role authenticated;
select public.selfver1_try_auto_verify(:'org_gen'::uuid) as gen_auto \gset
select public.selfver1_request_manual_verification(:'org_gen'::uuid, 'Visura camerale disponibile') as gen_req \gset
select public.selfver1_request_manual_verification(:'org_gen'::uuid, null) as gen_req2 \gset
select public.selfver1_my_verification_state(:'org_gen'::uuid) as gen_state \gset
reset role;
select pg_temp.sv_assert(not (:'gen_auto'::jsonb->>'verified')::boolean
  and (:'gen_auto'::jsonb->'reasons') ? 'generic_email_domain', 'generic mailbox is never auto-verified: ' || :'gen_auto');
select pg_temp.sv_assert((:'gen_req'::jsonb->>'requested')::boolean and (:'gen_req'::jsonb->>'verification_status') = 'pending', 'manual request opened');
select pg_temp.sv_assert((:'gen_req2'::jsonb->>'already_pending')::boolean, 'second request does not duplicate');
select pg_temp.sv_assert((:'gen_state'::jsonb->>'manual_request_pending')::boolean and (:'gen_state'::jsonb->>'verification_status') = 'pending', 'state shows the pending request');
select pg_temp.sv_assert(
  exists (
    select 1 from public.network_data_assertions a
    join public.organization_network_company_links l on l.network_company_id = a.entity_id
    where l.organization_id = :'org_gen'::uuid and a.field_path = 'verification'
      and a.source_type = 'company_declared' and a.review_state = 'pending'
  ),
  'manual request lands as a pending company-declared assertion in the staff trust queue'
);

-- 3. Domain shared with another Network company: manual only.
insert into public.network_companies(legal_name, country_code, website_url, website_domain, publication_status)
values ('SELFVER1 Omonimo Dominio', 'IT', 'https://selfver1-shared.example.test', 'selfver1-shared.example.test', 'published');
select pg_temp.sv_as('00000000-0000-0000-0000-00000000d203');
set local role authenticated;
select public.selfver1_try_auto_verify(:'org_shared'::uuid) as shared_auto \gset
reset role;
select pg_temp.sv_assert(not (:'shared_auto'::jsonb->>'verified')::boolean
  and (:'shared_auto'::jsonb->'reasons') ? 'shared_website_domain', 'shared domain is never auto-verified: ' || :'shared_auto');

-- 4. A staff decision is never overridden automatically.
update public.network_companies c set verification_status = 'revoked'
from public.organization_network_company_links l
where l.organization_id = :'org_dom'::uuid and l.network_company_id = c.id;
select pg_temp.sv_as('00000000-0000-0000-0000-00000000d201');
set local role authenticated;
select public.selfver1_try_auto_verify(:'org_dom'::uuid) as revoked_auto \gset
reset role;
select pg_temp.sv_assert(not (:'revoked_auto'::jsonb->>'verified')::boolean
  and (:'revoked_auto'::jsonb->'reasons') ? 'staff_decision', 'revoked stays revoked: ' || :'revoked_auto');
select pg_temp.sv_assert(
  (select c.verification_status from public.network_companies c
   join public.organization_network_company_links l on l.network_company_id = c.id
   where l.organization_id = :'org_dom'::uuid) = 'revoked',
  'company status unchanged after a revoked replay'
);

-- 5. Tenant isolation: an outsider cannot read or act on another organization.
select pg_temp.sv_as('00000000-0000-0000-0000-00000000d204');
set local role authenticated;
select pg_temp.sv_assert_raises(format('select public.selfver1_my_verification_state(%L::uuid)', :'org_gen'), 'active organization membership required');
select pg_temp.sv_assert_raises(format('select public.selfver1_try_auto_verify(%L::uuid)', :'org_gen'), 'active organization membership required');
select pg_temp.sv_assert_raises(format('select public.selfver1_request_manual_verification(%L::uuid, null)', :'org_gen'), 'active organization membership required');
reset role;

rollback;
