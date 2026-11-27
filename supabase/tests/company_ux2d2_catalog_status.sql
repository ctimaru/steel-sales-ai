-- COMPANY-UX2.D.2: owner-only catalogue metadata and current document rights.
-- Disposable local fixtures only. No network fetch, uploaded bytes or hosted data.
\set ON_ERROR_STOP on
begin;

create function pg_temp.d2_assert(ok boolean,message text)
returns void language plpgsql as $fn$
begin
  if not coalesce(ok,false) then raise exception 'D.2 assertion failed: %',message; end if;
end;
$fn$;

create function pg_temp.d2_raises(statement text,expected_state text)
returns void language plpgsql as $fn$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate<>expected_state then
      raise exception 'D.2 expected SQLSTATE %, got %: %',expected_state,sqlstate,sqlerrm;
    end if;
    return;
  end;
  raise exception 'D.2 statement unexpectedly succeeded: %',statement;
end;
$fn$;

create function pg_temp.d2_item(payload jsonb,item_name text)
returns jsonb language plpgsql as $fn$
declare result jsonb;
begin
  select item into result from jsonb_array_elements(payload->'items') item
  where item->>'name'=item_name;
  if result is null then raise exception 'D.2 fixture item missing: %',item_name; end if;
  return result;
end;
$fn$;

\set owner '00000000-0000-4000-8000-00000002d211'
\set viewer '00000000-0000-4000-8000-00000002d212'
\set outsider '00000000-0000-4000-8000-00000002d213'
\set org '00000000-0000-4000-8000-00000002d221'
\set other_org '00000000-0000-4000-8000-00000002d222'
\set company '00000000-0000-4000-8000-00000002d231'
\set other_company '00000000-0000-4000-8000-00000002d232'

insert into auth.users(id,email,email_confirmed_at) values
  (:'owner','ux2d2-owner@example.test',now()),
  (:'viewer','ux2d2-viewer@example.test',now()),
  (:'outsider','ux2d2-outsider@example.test',now());
insert into public.organizations(id,name,slug,created_by,country_code,industry) values
  (:'org','D2 synthetic producer','ux2d2-synthetic-own',:'owner','IT','steel'),
  (:'other_org','D2 unrelated producer','ux2d2-synthetic-other',:'outsider','IT','steel');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
  (:'org',:'owner','admin','active',true),(:'org',:'viewer','viewer','active',true),
  (:'other_org',:'outsider','admin','active',true);
insert into public.network_companies(id,legal_name,country_code,website_url,
  publication_status,claimed_status,verification_status) values
  (:'company','D2 synthetic manufacturer','IT','https://ux2d2.example.test',
   'published','claimed','unverified'),
  (:'other_company','D2 unrelated manufacturer','IT','https://other-ux2d2.example.test',
   'published','claimed','unverified');
insert into public.network_company_role_assignments(company_id,role_id,is_primary)
select company.id,role.id,true
from public.network_companies company cross join public.network_company_roles role
where company.id in (:'company',:'other_company') and role.canonical_key='producer' and role.status='active';
insert into public.network_company_claims(network_company_id,organization_id,requested_by,status,
  reviewed_by,reviewed_at,proof_method,proof_status,proof_verified_by,proof_verified_at) values
  (:'company',:'org',:'owner','approved',:'owner',now(),'manual_review','verified',:'owner',now()),
  (:'other_company',:'other_org',:'outsider','approved',:'outsider',now(),'manual_review','verified',:'outsider',now());
insert into public.organization_network_company_links(organization_id,network_company_id,claim_id,linked_by,link_status)
select organization_id,network_company_id,id,requested_by,'active' from public.network_company_claims
where network_company_id in (:'company',:'other_company');

-- All byte identities below are local synthetic metadata, not actual documents.
with fixtures(catalog_id,name,state) as (values
  ('00000000-0000-4000-8000-00000002d241'::uuid,'pending.csv','pending_provenance'),
  ('00000000-0000-4000-8000-00000002d242'::uuid,'active.csv','in_analysis'),
  ('00000000-0000-4000-8000-00000002d243'::uuid,'expired.csv','in_analysis'),
  ('00000000-0000-4000-8000-00000002d244'::uuid,'revoked.csv','in_analysis'),
  ('00000000-0000-4000-8000-00000002d245'::uuid,'no-grant.csv','in_analysis'),
  ('00000000-0000-4000-8000-00000002d246'::uuid,'withdrawn.csv','withdrawn')
)
insert into private.network_producer_catalog_submissions(
  catalog_id,company_id,organization_id,submitted_by,source_url,edition,
  original_name,document_format,document_sha256,object_path,state,created_at,
  rights_declared_at,uploaded_at,source_checked_at,withdrawn_at)
select catalog_id,:'company',:'org',:'owner',
  'https://ux2d2.example.test/catalogs/'||name,'2026',name,'csv',repeat('1',64),
  :'company'||'/'||catalog_id::text||'/'||repeat('1',64)||'.csv',state,now()-interval '2 days',
  now()-interval '2 days',now()-interval '2 days'+interval '1 minute',
  case when state='in_analysis' then now()-interval '1 day' end,
  case when state='withdrawn' then now()-interval '12 hours' end
from fixtures;

insert into private.network_producer_catalog_grants(
  catalog_id,company_id,source_url,document_sha256,edition,document_format,rights,
  verification_method,verification_reference,verified_at,expires_at,status,revoked_at)
select catalog_id,company_id,source_url,document_sha256,edition,document_format,
  array['extract','store_derived','use_in_producer_search'],
  'verified_company_authorization','rights-d2-synthetic-local',now()-interval '1 day',
  case when original_name='expired.csv' then now()-interval '1 hour' else now()+interval '30 days' end,
  case when original_name='revoked.csv' then 'revoked' else 'approved' end,
  case when original_name='revoked.csv' then now()-interval '1 hour' end
from private.network_producer_catalog_submissions
where company_id=:'company' and original_name in ('active.csv','expired.csv','revoked.csv');

-- A foreign organization receives neither names nor new source/rights metadata.
insert into private.network_producer_catalog_submissions(
  catalog_id,company_id,organization_id,submitted_by,source_url,edition,
  original_name,document_format,document_sha256,object_path,state)
values ('00000000-0000-4000-8000-00000002d249',:'other_company',:'other_org',:'outsider',
  'https://other-ux2d2.example.test/private-name.csv','2026','private-name.csv','csv',repeat('2',64),
  :'other_company'||'/00000000-0000-4000-8000-00000002d249/'||repeat('2',64)||'.csv','awaiting_upload');

select pg_temp.d2_assert(
  has_function_privilege('authenticated','public.netproducers1_b3c2_catalog_submission(text,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.netproducers1_b3c2_catalog_submission(text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','private.netproducers1_b3c2_catalog_submission(text,jsonb)','EXECUTE')
  and not has_table_privilege('authenticated','private.network_producer_catalog_submissions','SELECT')
  and not has_table_privilege('authenticated','private.network_producer_catalog_grants','SELECT'),
  'status extension must not expand RPC, table or grant privileges');

select md5(jsonb_agg(to_jsonb(s) order by catalog_id)::text) as submissions_before
from private.network_producer_catalog_submissions s where company_id in (:'company',:'other_company') \gset
select md5(jsonb_agg(to_jsonb(g) order by catalog_id)::text) as grants_before
from private.network_producer_catalog_grants g where company_id=:'company' \gset

select set_config('request.jwt.claim.sub',:'owner',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'company')) as original \gset
select pg_temp.d2_assert(:'original'::jsonb->>'contract'='netproducers-b3c2-v1'
  and :'original'::jsonb->>'details_contract'='company-ux2d2-catalog-status-v1'
  and (:'original'::jsonb->>'eligible')::boolean
  and (:'original'::jsonb->>'limit')::int=20
  and jsonb_array_length(:'original'::jsonb->'items')=6,
  'existing status contract stays additive, eligible and bounded');
select pg_temp.d2_assert(
  pg_temp.d2_item(:'original','pending.csv')->>'source_url'='https://ux2d2.example.test/catalogs/pending.csv'
  and pg_temp.d2_item(:'original','pending.csv')->>'rights_status'='not_verified'
  and (pg_temp.d2_item(:'original','pending.csv')->>'rights_declared_at')::timestamptz=now()-interval '2 days'
  and pg_temp.d2_item(:'original','pending.csv')->>'source_checked_at' is null
  and pg_temp.d2_item(:'original','pending.csv')->>'rights_verified_at' is null
  and pg_temp.d2_item(:'original','pending.csv')->>'rights_expires_at' is null,
  'a declaration and uploaded file do not establish verified rights');
select pg_temp.d2_assert(
  pg_temp.d2_item(:'original','active.csv')->>'rights_status'='active'
  and (pg_temp.d2_item(:'original','active.csv')->>'rights_verified_at')::timestamptz=now()-interval '1 day'
  and (pg_temp.d2_item(:'original','active.csv')->>'rights_expires_at')::timestamptz=now()+interval '30 days'
  and pg_temp.d2_item(:'original','active.csv')->>'rights_revoked_at' is null,
  'active rights require an exact current grant');
select pg_temp.d2_assert(
  pg_temp.d2_item(:'original','expired.csv')->>'state'='in_analysis'
  and pg_temp.d2_item(:'original','expired.csv')->>'rights_status'='expired'
  and pg_temp.d2_item(:'original','revoked.csv')->>'state'='in_analysis'
  and pg_temp.d2_item(:'original','revoked.csv')->>'rights_status'='revoked'
  and (pg_temp.d2_item(:'original','revoked.csv')->>'rights_revoked_at')::timestamptz=now()-interval '1 hour'
  and pg_temp.d2_item(:'original','no-grant.csv')->>'rights_status'='not_verified',
  'analysis state must not imply current rights after expiry, revocation or without a grant');
select pg_temp.d2_assert(
  pg_temp.d2_item(:'original','withdrawn.csv')->>'state'='withdrawn'
  and pg_temp.d2_item(:'original','withdrawn.csv')->>'rights_status'='not_verified'
  and (pg_temp.d2_item(:'original','withdrawn.csv')->>'withdrawn_at')::timestamptz=now()-interval '12 hours',
  'withdrawing an unlicensed submission must not invent a historical grant');
select pg_temp.d2_assert(not exists(
  select 1 from jsonb_array_elements(:'original'::jsonb->'items') item,
    jsonb_object_keys(item) key
  where key not in ('catalog_id','name','edition','format','state','created_at','uploaded_at',
    'source_url','rights_declared_at','source_checked_at','withdrawn_at','rights_status',
    'rights_verified_at','rights_expires_at','rights_revoked_at')),
  'owner details must not disclose storage paths, hashes, diagnostics or grant evidence references');

select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'other_company')) as foreign_status \gset
select pg_temp.d2_assert(:'foreign_status'::jsonb->>'eligible'='false'
  and :'foreign_status'::jsonb->'items'='[]'::jsonb
  and :'foreign_status'::jsonb->>'details_contract'='company-ux2d2-catalog-status-v1',
  'another company must disclose no metadata');
select set_config('request.jwt.claim.sub',:'viewer',true);
select pg_temp.d2_assert(public.netproducers1_b3c2_catalog_submission(
  'status',jsonb_build_object('company_id',:'company'))->'items'='[]'::jsonb,
  'viewer must not read owner metadata');
select set_config('request.jwt.claim.sub',:'outsider',true);
select pg_temp.d2_assert(public.netproducers1_b3c2_catalog_submission(
  'status',jsonb_build_object('company_id',:'company'))->'items'='[]'::jsonb,
  'another organization admin must not read owner metadata');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.d2_raises(format('select public.netproducers1_b3c2_catalog_submission(''status'',%L)',
  jsonb_build_object('company_id',:'company')),'42501');
reset role;

select pg_temp.d2_assert(
  (select md5(jsonb_agg(to_jsonb(s) order by catalog_id)::text)
   from private.network_producer_catalog_submissions s where company_id in (:'company',:'other_company'))=:'submissions_before'
  and (select md5(jsonb_agg(to_jsonb(g) order by catalog_id)::text)
   from private.network_producer_catalog_grants g where company_id=:'company')=:'grants_before',
  'all authorized and denied status reads must leave submissions and grants unchanged');
select set_config('request.jwt.claim.sub',:'owner',true);

-- A grant for different bytes, source, edition or company cannot license this document.
savepoint mismatched_grant;
update private.network_producer_catalog_grants set document_sha256=repeat('9',64)
where catalog_id='00000000-0000-4000-8000-00000002d242';
set local role authenticated;
select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'company')) as mismatched \gset
select pg_temp.d2_assert(pg_temp.d2_item(:'mismatched','active.csv')->>'rights_status'='not_verified'
  and pg_temp.d2_item(:'mismatched','active.csv')->>'rights_verified_at' is null,
  'a grant for different bytes must not be attributed');
rollback to savepoint mismatched_grant;

savepoint mismatched_source;
update private.network_producer_catalog_grants set source_url='https://ux2d2.example.test/other.csv'
where catalog_id='00000000-0000-4000-8000-00000002d242';
set local role authenticated;
select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'company')) as mismatched \gset
select pg_temp.d2_assert(pg_temp.d2_item(:'mismatched','active.csv')->>'rights_status'='not_verified'
  and pg_temp.d2_item(:'mismatched','active.csv')->>'rights_expires_at' is null,
  'a grant for a different source must not be attributed');
rollback to savepoint mismatched_source;

savepoint mismatched_edition;
update private.network_producer_catalog_grants set edition='2025'
where catalog_id='00000000-0000-4000-8000-00000002d242';
set local role authenticated;
select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'company')) as mismatched \gset
select pg_temp.d2_assert(pg_temp.d2_item(:'mismatched','active.csv')->>'rights_status'='not_verified',
  'a grant for a different edition must not be attributed');
rollback to savepoint mismatched_edition;

savepoint mismatched_company;
update private.network_producer_catalog_grants set company_id=:'other_company'
where catalog_id='00000000-0000-4000-8000-00000002d242';
set local role authenticated;
select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'company')) as mismatched \gset
select pg_temp.d2_assert(pg_temp.d2_item(:'mismatched','active.csv')->>'rights_status'='not_verified'
  and pg_temp.d2_item(:'mismatched','active.csv')->>'rights_verified_at' is null,
  'a foreign company grant must not be attributed or disclosed');
rollback to savepoint mismatched_company;

savepoint changed_domain;
update public.network_companies set website_url='https://changed-ux2d2.example.test'
where id=:'company';
set local role authenticated;
select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'company')) as changed \gset
select pg_temp.d2_assert(pg_temp.d2_item(:'changed','active.csv')->>'rights_status'='not_verified',
  'an old domain must not retain an active current-source badge');
rollback to savepoint changed_domain;

savepoint pending_company;
update public.network_companies set publication_status='pending_review' where id=:'company';
set local role authenticated;
select pg_temp.d2_assert(public.netproducers1_b3c2_catalog_submission(
  'status',jsonb_build_object('company_id',:'company'))->>'eligible'='false',
  'pending companies retain the existing producer authorization gate');
rollback to savepoint pending_company;

savepoint claim_changed;
update public.network_company_claims set status='under_review' where network_company_id=:'company';
set local role authenticated;
select pg_temp.d2_assert(public.netproducers1_b3c2_catalog_submission(
  'status',jsonb_build_object('company_id',:'company'))->'items'='[]'::jsonb,
  'claim changes immediately hide owner metadata');
rollback to savepoint claim_changed;

-- The oldest rows must not leak into a list of the 20 most recent submissions.
with fixtures as (
  select gen_random_uuid() as catalog_id,number from generate_series(1,21) number
)
insert into private.network_producer_catalog_submissions(
  catalog_id,company_id,organization_id,submitted_by,source_url,edition,
  original_name,document_format,document_sha256,object_path,state,created_at)
select catalog_id,:'company',:'org',:'owner',
  'https://ux2d2.example.test/recent-'||number||'.csv','2026','recent-'||number||'.csv',
  'csv',repeat('3',64),:'company'||'/'||catalog_id::text||'/'||repeat('3',64)||'.csv',
  'awaiting_upload',now()-make_interval(secs=>number)
from fixtures;
set local role authenticated;
select public.netproducers1_b3c2_catalog_submission('status',jsonb_build_object('company_id',:'company')) as capped \gset
select pg_temp.d2_assert(jsonb_array_length(:'capped'::jsonb->'items')=20
  and :'capped'::jsonb->'items'->0->>'name'='recent-1.csv'
  and :'capped'::jsonb->'items'->19->>'name'='recent-20.csv'
  and not exists(select 1 from jsonb_array_elements(:'capped'::jsonb->'items') item
    where item->>'name' in ('recent-21.csv','active.csv','private-name.csv')),
  'status preserves the current organization, descending recency and 20-item boundary');
reset role;

rollback;
select 'COMPANY-UX2.D.2 SQL PASS: private source metadata, current rights, exact document identity, authorization and 20-item bound' as result;
