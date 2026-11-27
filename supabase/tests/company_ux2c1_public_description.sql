-- COMPANY-UX2.C.1: field-specific public description provenance.
-- Disposable local/CI database only. Every fixture rolls back.
begin;

create function pg_temp.c1p_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'C1 public description: %',message; end if;
end;
$$;

create function pg_temp.c1p_denied(statement text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'C1 public description: unauthorized statement succeeded: %',statement;
end;
$$;

create function pg_temp.c1p_check_readers(expected boolean, message text)
returns void language plpgsql as $$
declare
  pro jsonb;
  free jsonb;
begin
  pro:=public.p3_7c_public_company_profile('00000000-0000-4000-8000-00000000c121');
  free:=public.netux11_free_profile('00000000-0000-4000-8000-00000000c112',
    '00000000-0000-4000-8000-00000000c121');
  perform pg_temp.c1p_assert(
    pro->'company'->'description_is_company_declared'=to_jsonb(expected)
    and free->'company'->'description_is_company_declared'=to_jsonb(expected),message);
  perform pg_temp.c1p_assert(
    pro->'company'->>'verification_status'='unverified'
    and free->'company'->>'verification_status'='unverified'
    and pro->'company'->>'claimed_status'='unclaimed'
    and free->'company'->>'claimed_status'='unclaimed',
    'description provenance must not imply identity verification or a claim');
  perform pg_temp.c1p_assert(
    pro::text not like '%source_assertion_id%' and free::text not like '%source_assertion_id%'
    and pro::text not like '%asserted_by%' and free::text not like '%asserted_by%'
    and not (pro ? 'facts') and not (free ? 'facts'),
    'provenance internals and research facts must not be projected');
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000c110','c1-public-reader@example.test',now()),
  ('00000000-0000-4000-8000-00000000c111','c1-public-outsider@example.test',now());
insert into public.organizations(id,name,slug) values
  ('00000000-0000-4000-8000-00000000c112','C1 Public Reader','c1-public-reader'),
  ('00000000-0000-4000-8000-00000000c113','C1 Unlinked Reader','c1-unlinked-reader');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
  ('00000000-0000-4000-8000-00000000c112','00000000-0000-4000-8000-00000000c110','admin','active',true),
  ('00000000-0000-4000-8000-00000000c113','00000000-0000-4000-8000-00000000c111','admin','active',true);
insert into public.network_companies(id,legal_name,country_code,description,publication_status,claimed_status,verification_status) values
  ('00000000-0000-4000-8000-00000000c120','C1 Reader Company','IT','Reader company','draft','claimed','unverified'),
  ('00000000-0000-4000-8000-00000000c121','C1 Public Description Target','IT',repeat('Company description. ',75),'published','unclaimed','unverified'),
  ('00000000-0000-4000-8000-00000000c122','C1 Private Description Target','IT','Private description','draft','unclaimed','unverified');
insert into public.network_company_claims(id,network_company_id,organization_id,requested_by,status,
  reviewed_by,reviewed_at,proof_method,proof_status,proof_verified_by,proof_verified_at) values
  ('00000000-0000-4000-8000-00000000c130','00000000-0000-4000-8000-00000000c120',
   '00000000-0000-4000-8000-00000000c112','00000000-0000-4000-8000-00000000c110','approved',
   '00000000-0000-4000-8000-00000000c110',now(),'manual_review','verified',
   '00000000-0000-4000-8000-00000000c110',now());
insert into public.organization_network_company_links(organization_id,network_company_id,claim_id,link_status,linked_by) values
  ('00000000-0000-4000-8000-00000000c112','00000000-0000-4000-8000-00000000c120',
   '00000000-0000-4000-8000-00000000c130','active','00000000-0000-4000-8000-00000000c110');

select pg_temp.c1p_assert(
  not has_function_privilege('anon','public.p3_7c_public_company_profile(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.netux11_free_profile(uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.company_ux2c1_description_is_declared(uuid)','EXECUTE')
  and not has_function_privilege('anon','private.company_ux2c1_description_is_declared(uuid)','EXECUTE')
  and not (select prosecdef from pg_proc where oid='public.p3_7c_public_company_profile(uuid)'::regprocedure)
  and not (select prosecdef from pg_proc where oid='public.netux11_free_profile(uuid,uuid)'::regprocedure),
  'public invoker wrappers and private predicate permissions must remain intact');

-- Free access remains independent of Pro entitlement; neither gate is relaxed.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c110',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.c1p_denied($$select public.p3_7c_public_company_profile('00000000-0000-4000-8000-00000000c121')$$);
select pg_temp.c1p_assert(
  public.netux11_free_profile('00000000-0000-4000-8000-00000000c112',
    '00000000-0000-4000-8000-00000000c121')->'company'->'description_is_company_declared'='false'::jsonb,
  'an imported description starts without company-declared provenance');
reset role;

insert into public.organization_product_entitlement_events(
  organization_id,product_key,event_type,source_kind,source_reference,idempotency_key,actor_authority_type,metadata
) values('00000000-0000-4000-8000-00000000c112','network_access','granted','pilot',
  'c1-public-description-test','c1.public.description.access','system','{}'::jsonb);

-- A declaration on another field must not promote the imported description.
insert into public.network_data_assertions(entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,review_state,created_at) values
  ('company','00000000-0000-4000-8000-00000000c121','website_url','"https://c1.example.test"',
   'company_declared','c1-public-test','company_managed','accepted','2026-11-27 00:01:00+00');
set local role authenticated;
select pg_temp.c1p_check_readers(false,'aggregate company provenance is not description provenance');
reset role;

insert into public.network_data_assertions(entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,review_state,created_at)
select 'company',id,'description',to_jsonb(description),'company_declared','c1-public-test',
  'company_managed','accepted','2026-11-27 00:02:00+00'
from public.network_companies where id in (
  '00000000-0000-4000-8000-00000000c121','00000000-0000-4000-8000-00000000c122');
set local role authenticated;
select pg_temp.c1p_check_readers(true,'latest matching company description is declared in both readers');
select pg_temp.c1p_assert(
  length(public.netux11_free_profile('00000000-0000-4000-8000-00000000c112',
    '00000000-0000-4000-8000-00000000c121')->'company'->>'description')=1200
  and length(public.p3_7c_public_company_profile('00000000-0000-4000-8000-00000000c121')->'company'->>'description')>1200,
  'Free truncation is preserved but provenance compares the full canonical value');
select pg_temp.c1p_assert(
  public.netux11_free_profile('00000000-0000-4000-8000-00000000c112',
    '00000000-0000-4000-8000-00000000c122') is null
  and public.p3_7c_public_company_profile('00000000-0000-4000-8000-00000000c122') is null,
  'matching provenance must not expose a draft company');
reset role;

-- Pending/rejected assertions do not replace the latest accepted assertion.
insert into public.network_data_assertions(entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,review_state,created_at)
select 'company',id,'description',to_jsonb(description),'public_web','c1-public-test',
  'system_derived',s.state,'2026-11-27 00:03:00+00'
from public.network_companies cross join (values ('pending'),('rejected')) s(state)
where id='00000000-0000-4000-8000-00000000c121';
set local role authenticated;
select pg_temp.c1p_check_readers(true,'only accepted field assertions determine the flag');
reset role;

-- A newer accepted public-web assertion must not fall back to an older declaration.
insert into public.network_data_assertions(entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,review_state,created_at)
select 'company',id,'description',to_jsonb(description),'public_web','c1-public-test',
  'system_derived','accepted','2026-11-27 00:04:00+00'
from public.network_companies where id='00000000-0000-4000-8000-00000000c121';
set local role authenticated;
select pg_temp.c1p_check_readers(false,'the latest accepted provenance wins');
reset role;

-- Exact value comparison: even a trailing-space mismatch is not confirmation.
insert into public.network_data_assertions(entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,review_state,created_at)
select 'company',id,'description',to_jsonb(description||' '),'company_declared','c1-public-test',
  'company_managed','accepted','2026-11-27 00:05:00+00'
from public.network_companies where id='00000000-0000-4000-8000-00000000c121';
set local role authenticated;
select pg_temp.c1p_check_readers(false,'the assertion must match the current value exactly');
reset role;

-- Guard regressions: another admin without a linked company remains outside Free.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c111',true);
set local role authenticated;
select pg_temp.c1p_denied($$select public.netux11_free_profile('00000000-0000-4000-8000-00000000c113','00000000-0000-4000-8000-00000000c121')$$);
select pg_temp.c1p_denied($$select public.netux11_free_profile('00000000-0000-4000-8000-00000000c112','00000000-0000-4000-8000-00000000c121')$$);
select pg_temp.c1p_denied($$select public.p3_7c_public_company_profile('00000000-0000-4000-8000-00000000c121')$$);
reset role;

select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.c1p_denied($$select public.netux11_free_profile('00000000-0000-4000-8000-00000000c112','00000000-0000-4000-8000-00000000c121')$$);
select pg_temp.c1p_denied($$select public.p3_7c_public_company_profile('00000000-0000-4000-8000-00000000c121')$$);
reset role;

select pg_temp.c1p_assert(
  (select publication_status='published' and verification_status='unverified' and claimed_status='unclaimed'
   from public.network_companies where id='00000000-0000-4000-8000-00000000c121'),
  'public reads never mutate publication, verification or claim state');

rollback;
