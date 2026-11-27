-- COMPANY-CLAIM1.A: actual resolver/HP5 authorization on disposable local data.
-- No hosted project or external service. Every fixture and test rolls back.
begin;

create function pg_temp.claim1a_assert(ok boolean,message text)
returns void language plpgsql as $fn$
begin
  if not coalesce(ok,false) then
    raise exception 'CLAIM1.A assertion failed: %',message;
  end if;
end;
$fn$;

create function pg_temp.claim1a_raises(statement text,expected_state text)
returns void language plpgsql as $fn$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate<>expected_state then
      raise exception 'CLAIM1.A expected SQLSTATE %, got %: %',expected_state,sqlstate,sqlerrm;
    end if;
    return;
  end;
  raise exception 'CLAIM1.A statement unexpectedly succeeded: %',statement;
end;
$fn$;

-- Capture row contents, not just counts, so a lookup cannot silently alter an
-- existing profile, application, claim, link, membership, entitlement or audit.
create function pg_temp.claim1a_snapshot()
returns jsonb language sql stable as $fn$
  select jsonb_build_object(
    'companies',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.network_companies t),
    'organizations',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.organizations t),
    'memberships',(select coalesce(jsonb_agg(to_jsonb(t) order by organization_id,user_id),'[]') from public.organization_memberships t),
    'claims',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.network_company_claims t),
    'links',(select coalesce(jsonb_agg(to_jsonb(t) order by organization_id,network_company_id),'[]') from public.organization_network_company_links t),
    'entitlements',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.organization_product_entitlement_events t),
    'applications',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.company_registration_applications t),
    'assertions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.network_data_assertions t),
    'profile_events',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.network_profile_management_events t)
  );
$fn$;

\set admin '00000000-0000-4000-8000-0000000c1a11'
\set viewer '00000000-0000-4000-8000-0000000c1a12'
\set outsider '00000000-0000-4000-8000-0000000c1a13'
\set inactive '00000000-0000-4000-8000-0000000c1a14'
\set unaffiliated '00000000-0000-4000-8000-0000000c1a15'
\set org '00000000-0000-4000-8000-0000000c1a21'
\set other_org '00000000-0000-4000-8000-0000000c1a22'
\set company '00000000-0000-4000-8000-0000000c1a31'
\set draft '00000000-0000-4000-8000-0000000c1a32'
\set pending '00000000-0000-4000-8000-0000000c1a33'
\set suspended '00000000-0000-4000-8000-0000000c1a34'
\set archived '00000000-0000-4000-8000-0000000c1a35'

insert into auth.users(id,email,email_confirmed_at) values
  (:'admin','claim1a-admin@claim1a.example.test',now()),
  (:'viewer','claim1a-viewer@example.test',now()),
  (:'outsider','claim1a-outsider@example.test',now()),
  (:'inactive','claim1a-inactive@example.test',now()),
  (:'unaffiliated','claim1a-no-membership@example.test',now());
insert into public.organizations(id,name,slug,created_by,country_code,industry) values
  (:'org','CLAIM1A synthetic company','claim1a-synthetic',:'admin','IT','steel'),
  (:'other_org','CLAIM1A other company','claim1a-other',:'outsider','IT','steel');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
  (:'org',:'admin','admin','active',true),
  (:'org',:'viewer','viewer','active',true),
  (:'org',:'inactive','admin','suspended',false),
  (:'other_org',:'outsider','admin','active',true);
insert into public.network_companies(id,legal_name,country_code,website_url,publication_status,archived_at)
values
  (:'company','CLAIM1A Published','IT','https://claim1a.example.test','published',null),
  (:'draft','CLAIM1A Draft','IT','https://claim1a-draft.example.test','draft',null),
  (:'pending','CLAIM1A Pending','IT','https://claim1a-pending.example.test','pending_review',null),
  (:'suspended','CLAIM1A Suspended','IT','https://claim1a-suspended.example.test','suspended',null),
  (:'archived','CLAIM1A Archived','IT','https://claim1a-archived.example.test','archived',now());

select private.pa1_4_claim_ref(:'company') as claim_ref,
  private.pa1_4_claim_ref(:'draft') as draft_ref,
  private.pa1_4_claim_ref(:'pending') as pending_ref,
  private.pa1_4_claim_ref(:'suspended') as suspended_ref,
  private.pa1_4_claim_ref(:'archived') as archived_ref \gset
select jsonb_build_object('contract','company-claim1a-target-v1','ok',false,
  'code','target_unavailable','network_company_id',null) as unavailable \gset
select pg_temp.claim1a_snapshot() as before_reads \gset

select pg_temp.claim1a_assert(
  has_function_privilege('authenticated','public.company_claim1a_resolve_target(text,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.company_claim1a_resolve_target(text,uuid)','EXECUTE')
  and not has_function_privilege('service_role','public.company_claim1a_resolve_target(text,uuid)','EXECUTE')
  and not has_function_privilege('anon','private.company_claim1a_resolve_target_impl(text,uuid)','EXECUTE')
  and not has_function_privilege('service_role','private.company_claim1a_resolve_target_impl(text,uuid)','EXECUTE')
  and not (select prosecdef from pg_proc where oid='public.company_claim1a_resolve_target(text,uuid)'::regprocedure)
  and (select prosecdef from pg_proc where oid='private.company_claim1a_resolve_target_impl(text,uuid)'::regprocedure),
  'authenticated-only invoker facade and private guarded definer');
select pg_temp.claim1a_assert(not exists(
  select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid in ('public.company_claim1a_resolve_target(text,uuid)'::regprocedure,
    'private.company_claim1a_resolve_target_impl(text,uuid)'::regprocedure)
    and a.grantee=0 and a.privilege_type='EXECUTE'
), 'neither function may inherit PUBLIC execute');

select set_config('request.jwt.claim.sub',:'admin',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.pa1_3_network_access_state(:'org') as access_before \gset
select pg_temp.claim1a_assert((:'access_before'::jsonb->>'can_access_network')::boolean=false,
  'positive fixture must be an ordinary Free admin, without Pro entitlement');
select pg_temp.claim1a_raises(format('select public.p3_7c_public_company_profile(%L)',:'company'),'42501');

select public.company_claim1a_resolve_target(:'claim_ref',:'org') as resolved \gset
select pg_temp.claim1a_assert(:'resolved'::jsonb=jsonb_build_object(
  'contract','company-claim1a-target-v1','ok',true,'code','resolved','network_company_id',:'company'),
  'Free admin resolves precisely four allowlisted response fields');
select pg_temp.claim1a_assert(public.company_claim1a_resolve_target(upper(:'claim_ref'),:'org')=:'resolved'::jsonb,
  'hexadecimal reference casing does not change its target');
select pg_temp.claim1a_assert(public.hp5_company_claim_experience(:'company',:'org')->>'eligible'='true',
  'resolved identity is readable through existing HP5 without a paid reader');
select pg_temp.claim1a_assert(not exists(
  select 1 from unnest(array[null::text,'','abc',repeat('0',63),repeat('0',65),repeat('g',64),
    ' '||:'claim_ref',:'claim_ref'||' ',repeat('0',64),:'draft_ref',:'pending_ref',:'suspended_ref',:'archived_ref']) r(ref)
  where public.company_claim1a_resolve_target(r.ref,:'org') is distinct from :'unavailable'::jsonb
), 'malformed, unknown, unpublished, suspended and archived references disclose no ID or other fields');

select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'other_org'),'42501');
select pg_temp.claim1a_raises(format('select private.company_claim1a_resolve_target_impl(%L,%L)',:'claim_ref',:'other_org'),'42501');
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,null)',:'claim_ref'),'42501');
select set_config('request.jwt.claim.sub',:'viewer',true);
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'org'),'42501');
select set_config('request.jwt.claim.sub',:'outsider',true);
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'org'),'42501');
select set_config('request.jwt.claim.sub',:'inactive',true);
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'org'),'42501');
select set_config('request.jwt.claim.sub',:'unaffiliated',true);
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'org'),'42501');
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)','invalid',:'org'),'42501');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'org'),'42501');
select pg_temp.claim1a_raises(format('select private.company_claim1a_resolve_target_impl(%L,%L)',:'claim_ref',:'org'),'42501');
reset role;
set local role anon;
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'org'),'42501');
reset role;
set local role service_role;
select pg_temp.claim1a_raises(format('select public.company_claim1a_resolve_target(%L,%L)',:'claim_ref',:'org'),'42501');
reset role;

select pg_temp.claim1a_assert(pg_temp.claim1a_snapshot()=:'before_reads'::jsonb,
  'successful, rejected and unauthorized resolution leaves all tracked data unchanged');

-- Existing claims remain resolvable to their status page, without being
-- approved, linked or resubmitted by this resolver.
savepoint pending_claim;
insert into public.network_company_claims(network_company_id,organization_id,requested_by,status)
values (:'company',:'org',:'admin','requested');
select pg_temp.claim1a_snapshot() as pending_before \gset
select set_config('request.jwt.claim.sub',:'admin',true);
set local role authenticated;
select pg_temp.claim1a_assert(public.company_claim1a_resolve_target(:'claim_ref',:'org')=:'resolved'::jsonb
  and public.hp5_company_claim_experience(:'company',:'org')->>'eligibility_reason'='claim_in_progress',
  'pending requests lead to HP5 status without a second claim');
reset role;
select pg_temp.claim1a_assert(pg_temp.claim1a_snapshot()=:'pending_before'::jsonb,'pending claim remains unchanged');
rollback to savepoint pending_claim;

savepoint managed_claim;
insert into public.network_company_claims(network_company_id,organization_id,requested_by,status,
  reviewed_by,reviewed_at,proof_method,proof_status,proof_verified_by,proof_verified_at)
values (:'company',:'org',:'admin','approved',:'admin',now(),'manual_review','verified',:'admin',now());
select pg_temp.claim1a_snapshot() as managed_before \gset
select set_config('request.jwt.claim.sub',:'admin',true);
set local role authenticated;
select pg_temp.claim1a_assert(public.company_claim1a_resolve_target(:'claim_ref',:'org')=:'resolved'::jsonb
  and public.hp5_company_claim_experience(:'company',:'org')->>'eligibility_reason'='already_managed',
  'approved claim remains available as an already-managed status, not a fresh request');
select set_config('request.jwt.claim.sub',:'outsider',true);
select pg_temp.claim1a_assert(public.company_claim1a_resolve_target(:'claim_ref',:'other_org')=:'resolved'::jsonb
  and public.hp5_company_claim_experience(:'company',:'other_org')->>'eligibility_reason'='already_claimed',
  'another legitimate admin can see already-claimed status without receiving ownership');
reset role;
select pg_temp.claim1a_assert(pg_temp.claim1a_snapshot()=:'managed_before'::jsonb,'approved claim and ownership remain unchanged');
rollback to savepoint managed_claim;

select pg_temp.claim1a_assert(pg_temp.claim1a_snapshot()=:'before_reads'::jsonb,
  'all lookup scenarios preserve the original profile, permissions and ledgers');
select set_config('request.jwt.claim.sub',:'admin',true);
set local role authenticated;
select pg_temp.claim1a_assert(public.pa1_3_network_access_state(:'org')=:'access_before'::jsonb,
  'resolving a claim never grants paid Network browsing');
reset role;

rollback;
