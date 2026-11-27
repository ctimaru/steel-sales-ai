-- COMPANY-UX2.C.2: real RPC/canonical-data acceptance on disposable CI data.
-- No production data, external fetches or model calls. Every fixture rolls back.
begin;

create function pg_temp.c2_assert(ok boolean,message text)
returns void language plpgsql as $fn$
begin
  if not coalesce(ok,false) then raise exception 'C.2 assertion failed: %',message; end if;
end;
$fn$;

create function pg_temp.c2_raises(statement text,expected_state text)
returns void language plpgsql as $fn$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate<>expected_state then
      raise exception 'C.2 expected SQLSTATE %, got %: %',expected_state,sqlstate,sqlerrm;
    end if;
    return;
  end;
  raise exception 'C.2 statement unexpectedly succeeded: %',statement;
end;
$fn$;

create function pg_temp.c2_proposal(review jsonb,kind text,label text)
returns jsonb language plpgsql as $fn$
declare result jsonb;
begin
  select p into result from jsonb_array_elements(review->'proposals') p
  where p->>'kind'=kind and p->>'label'=label;
  if result is null then raise exception 'C.2 fixture proposal missing: % / %',kind,label; end if;
  return result;
end;
$fn$;

create function pg_temp.c2_decide(org uuid,company uuid,review jsonb,kind text,label text,action text,selection jsonb default null)
returns jsonb language plpgsql as $fn$
declare proposal jsonb; group_key text;
begin
  proposal:=pg_temp.c2_proposal(review,kind,label);
  group_key:=case kind when 'product' then 'products' when 'capability' then 'capabilities'
    when 'market' then 'markets' when 'certification' then 'certifications' end;
  return public.company_ux2c2_decide_industrial(org,company,proposal->>'proposal_hash',
    review->'state_hashes'->>group_key,action,selection);
end;
$fn$;

\set owner '00000000-0000-4000-8000-00000002c211'
\set viewer '00000000-0000-4000-8000-00000002c212'
\set outsider '00000000-0000-4000-8000-00000002c213'
\set staff '00000000-0000-4000-8000-00000002c214'
\set org '00000000-0000-4000-8000-00000002c221'
\set other_org '00000000-0000-4000-8000-00000002c222'
\set company '00000000-0000-4000-8000-00000002c231'
\set other_company '00000000-0000-4000-8000-00000002c232'
\set facility '00000000-0000-4000-8000-00000002c241'
\set other_facility '00000000-0000-4000-8000-00000002c242'

insert into auth.users(id,email,email_confirmed_at) values
  (:'owner','ux2c2-owner@example.test',now()),(:'viewer','ux2c2-viewer@example.test',now()),
  (:'outsider','ux2c2-outsider@example.test',now()),(:'staff','ux2c2-staff@example.test',now());
insert into public.organizations(id,name,slug,created_by,country_code,industry) values
  (:'org','C2 synthetic organization','ux2c2-synthetic-own',:'owner','IT','steel'),
  (:'other_org','C2 unrelated organization','ux2c2-synthetic-other',:'outsider','IT','steel');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
  (:'org',:'owner','admin','active',true),(:'org',:'viewer','viewer','active',true),
  (:'other_org',:'outsider','admin','active',true);
insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
values (:'staff','platform_superadmin','active',null,'C2 synthetic negative authorization case');
insert into public.network_companies(id,legal_name,trading_name,country_code,website_url,description,
  publication_status,claimed_status,verification_status) values
  (:'company','C2 Legal Identity','C2 Trading','IT','https://ux2c2.example.test','Manual company description.',
   'published','claimed','unverified'),
  (:'other_company','C2 Other Identity','C2 Other','IT','https://other-ux2c2.example.test','Other company description.',
   'published','claimed','unverified');
insert into public.network_company_claims(network_company_id,organization_id,requested_by,status,
  reviewed_by,reviewed_at,proof_method,proof_status,proof_verified_by,proof_verified_at) values
  (:'company',:'org',:'owner','approved',:'owner',now(),'manual_review','verified',:'owner',now()),
  (:'other_company',:'other_org',:'outsider','approved',:'outsider',now(),'manual_review','verified',:'outsider',now());
insert into public.organization_network_company_links(organization_id,network_company_id,claim_id,linked_by,link_status)
select organization_id,network_company_id,id,requested_by,'active' from public.network_company_claims
where network_company_id in (:'company',:'other_company');
insert into public.network_facilities(id,company_id,name,facility_type,country_code,publication_status,verification_status)
values (:'facility',:'company','C2 own plant','plant','IT','published','unverified'),
  (:'other_facility',:'other_company','C2 other plant','plant','IT','published','unverified');

select pg_temp.c2_assert(
  not has_table_privilege('authenticated','private.company_ux2c2_industrial_decisions','SELECT')
  and not has_table_privilege('authenticated','private.company_ux2c2_industrial_decisions','INSERT')
  and not has_table_privilege('service_role','private.company_ux2c2_industrial_decisions','UPDATE')
  and (select relrowsecurity from pg_class where oid='private.company_ux2c2_industrial_decisions'::regclass),
  'decision snapshots must be private and RLS-enabled');
select pg_temp.c2_assert(
  not has_function_privilege('anon','public.company_ux2c2_industrial_review(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.company_ux2c2_decide_industrial(uuid,uuid,text,text,text,jsonb)','EXECUTE')
  and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'company_ux2c2_%' and p.prosecdef),
  'public RPC facades must be invoker-only and unavailable anonymously');

select set_config('request.jwt.claim.sub',:'owner',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as absent \gset
select pg_temp.c2_assert(:'absent'::jsonb->>'availability'='no_research'
  and jsonb_array_length(:'absent'::jsonb->'proposals')=0,
  'absence of research must not fabricate industrial proposals');
reset role;

insert into private.network_company_research(company_id,status,products,activities,sectors,markets,certifications,
  source_urls,extractor_version,model,published_at,researched_at,facts)
values (:'company','published',
  array['Tubi saldati','Non produciamo tubi saldati','Voce DEMO non catalogata'],
  array['Taglio laser','Taglio laser affidato a terzi'],array['Automotive'],array['Germania'],
  array['ISO 9001','Certificazione ISO 9001 in corso'],
  array['https://ux2c2.example.test/produzione','https://ux2c2.example.test/azienda'],
  'c2-synthetic-v1','synthetic-only','2026-11-27T09:00:00Z','2026-11-27T09:00:00Z',
  '{"private_diagnostic":"must_not_leave_private_schema","employees":{"quote":"private quote"}}'::jsonb);
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as original \gset
select pg_temp.c2_assert(:'original'::jsonb->>'contract'='company-ux2c2-industrial-v1'
  and :'original'::jsonb->>'availability'='available'
  and :'original'::jsonb->>'network_company_id'=:'company'
  and jsonb_array_length(:'original'::jsonb->'proposals')=8
  and jsonb_array_length(:'original'::jsonb->'source_urls')=2
  and not (:'original'::jsonb ? 'facts') and not (:'original'::jsonb ? 'model')
  and position('private quote' in :'original')=0,
  'reader must expose four families and global sources, never private facts/model or geographic markets');
select pg_temp.c2_assert(
  pg_temp.c2_proposal(:'original','product','Tubi saldati')->>'suggested_key'='tubes_pipes'
  and pg_temp.c2_proposal(:'original','capability','Taglio laser')->>'suggested_key'='laser_cutting'
  and pg_temp.c2_proposal(:'original','market','Automotive')->>'suggested_key'='automotive'
  and pg_temp.c2_proposal(:'original','certification','ISO 9001')->>'suggested_key'='iso_9001'
  and pg_temp.c2_proposal(:'original','product','Non produciamo tubi saldati')->>'suggested_key' is null
  and pg_temp.c2_proposal(:'original','product','Voce DEMO non catalogata')->>'suggested_key' is null
  and pg_temp.c2_proposal(:'original','capability','Taglio laser affidato a terzi')->>'suggested_key' is null
  and pg_temp.c2_proposal(:'original','certification','Certificazione ISO 9001 in corso')->>'suggested_key' is null,
  'only complete conservative aliases suggest a canonical key; negative, third-party and future phrases stay unmapped');
select pg_temp.c2_assert(not exists(select 1 from jsonb_array_elements(:'original'::jsonb->'proposals') p
  where p->>'label'='Germania' or p ? 'quote' or p ? 'confidence' or p ? 'facts' or p ? 'model'),
  'country labels and invented per-item evidence must not enter industrial proposals');
reset role;
select pg_temp.c2_assert(
  not exists(select 1 from public.network_company_products where company_id=:'company')
  and not exists(select 1 from public.network_company_markets where company_id=:'company')
  and not exists(select 1 from public.network_facility_capabilities where facility_id=:'facility')
  and not exists(select 1 from public.network_company_certifications where company_id=:'company')
  and not exists(select 1 from public.network_profile_management_events where network_company_id=:'company')
  and not exists(select 1 from private.company_ux2c2_industrial_decisions where network_company_id=:'company'),
  'reading mapped and unmapped proposals must not mutate canonical data, audit or decisions');

-- Real authorization, including the Platform role that canonical writers allow.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'viewer',true);
select pg_temp.c2_raises(format('select public.company_ux2c2_industrial_review(%L,%L)',:'org',:'company'),'42501');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','ignore'),'42501');
select set_config('request.jwt.claim.sub',:'outsider',true);
select pg_temp.c2_raises(format('select public.company_ux2c2_industrial_review(%L,%L)',:'org',:'company'),'42501');
select set_config('request.jwt.claim.sub',:'staff',true);
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','ignore'),'42501');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.c2_raises(format('select public.company_ux2c2_industrial_review(%L,%L)',:'org',:'company'),'42501');
select set_config('request.jwt.claim.sub',:'owner',true);
select pg_temp.c2_raises(format('select public.company_ux2c2_industrial_review(%L,%L)',:'other_org',:'company'),'42501');
select pg_temp.c2_raises(format('select public.company_ux2c2_industrial_review(%L,%L)',:'org',:'other_company'),'42501');
reset role;
savepoint revoked_claim;
update public.network_company_claims set status='under_review' where network_company_id=:'company';
set local role authenticated;
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','ignore'),'42501');
rollback to savepoint revoked_claim;
savepoint revoked_link;
update public.organization_network_company_links set link_status='revoked' where network_company_id=:'company';
set local role authenticated;
select pg_temp.c2_raises(format('select public.company_ux2c2_industrial_review(%L,%L)',:'org',:'company'),'42501');
rollback to savepoint revoked_link;
savepoint suspended_member;
update public.organization_memberships set status='suspended' where organization_id=:'org' and user_id=:'owner';
set local role authenticated;
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','ignore'),'42501');
rollback to savepoint suspended_member;

-- Availability and provenance are independent from summary and timestamp churn.
savepoint unavailable_research;
update private.network_company_research set status='pilot_review' where company_id=:'company';
set local role authenticated;
select pg_temp.c2_assert(public.company_ux2c2_industrial_review(:'org',:'company')->>'availability'='no_research',
  'claim ownership must not expose unpublished research');
rollback to savepoint unavailable_research;
savepoint empty_research;
update private.network_company_research set products='{}',activities='{}',sectors='{}',certifications='{}',
  markets=array['Germania'] where company_id=:'company';
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as empty_review \gset
select pg_temp.c2_assert(:'empty_review'::jsonb->>'availability'='empty'
  and jsonb_array_length(:'empty_review'::jsonb->'proposals')=0,'geography alone cannot create industrial proposals');
rollback to savepoint empty_research;
savepoint changed_dates;
update private.network_company_research set researched_at=now()+interval '1 day',published_at=now()+interval '1 day',
  source_urls=array['https://ux2c2.example.test/azienda','https://ux2c2.example.test/produzione','https://ux2c2.example.test/azienda']
where company_id=:'company';
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as dates_only \gset
select pg_temp.c2_assert(pg_temp.c2_proposal(:'dates_only','product','Tubi saldati')->>'proposal_hash'=
  pg_temp.c2_proposal(:'original','product','Tubi saldati')->>'proposal_hash'
  and :'dates_only'::jsonb->'state_hashes'=:'original'::jsonb->'state_hashes',
  'attempt/publication dates and source order/duplicates must not change the semantic proposal or canonical versions');
rollback to savepoint changed_dates;
savepoint changed_sources;
update private.network_company_research set extractor_version='c2-synthetic-v2',
  source_urls=array['https://ux2c2.example.test/altra-fonte'] where company_id=:'company';
set local role authenticated;
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','confirm',
  '{"key":"tubes_pipes","relationship_type":"distributes","facility_id":null}'),'40001');
rollback to savepoint changed_sources;
savepoint foreign_sources;
update private.network_company_research set source_urls=array['https://unrelated.example.test/azienda'] where company_id=:'company';
set local role authenticated;
select pg_temp.c2_assert(public.company_ux2c2_industrial_review(:'org',:'company')->>'availability'='source_mismatch',
  'global research sources must still match the current official site');
rollback to savepoint foreign_sources;
savepoint changed_website;
update public.network_companies set website_url='https://changed.example.test' where id=:'company';
set local role authenticated;
select pg_temp.c2_assert(public.company_ux2c2_industrial_review(:'org',:'company')->>'availability'='source_mismatch',
  'a changed official website must invalidate old-domain suggestions');
rollback to savepoint changed_website;

-- Required human choices and rejection of invented certification metadata.
set local role authenticated;
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','confirm','{"key":"tubes_pipes","facility_id":null}'),'22023');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','confirm','{"key":"tubes_pipes","relationship_type":"produces"}'),'22023');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','capability','Taglio laser','confirm','{"key":"laser_cutting","facility_id":null}'),'22023');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','certification','ISO 9001','confirm',
  '{"key":"iso_9001","facility_id":null,"issuer":"Invented issuer","valid_to":"2099-01-01"}'),'22023');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','market','Automotive','ignore','{"key":"automotive"}'),'22023');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','market','Automotive','confirm','{"key":"invented_industrial_key"}'),'22023');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','confirm',
  jsonb_build_object('key','tubes_pipes','relationship_type','stocks','facility_id',:'other_facility')),'42501');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','capability','Taglio laser','confirm',
  jsonb_build_object('key','laser_cutting','facility_id',:'other_facility')),'42501');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','certification','ISO 9001','confirm',
  jsonb_build_object('key','iso_9001','facility_id',:'other_facility')),'42501');
reset role;

-- Archiving a real selected facility invalidates all scope-dependent previews.
savepoint archived_facility;
set local role authenticated;
select public.p3_7b_archive_facility(:'company',:'facility');
select public.company_ux2c2_industrial_review(:'org',:'company') as archived_review \gset
select pg_temp.c2_assert(:'archived_review'::jsonb->'state_hashes'->>'products'<>:'original'::jsonb->'state_hashes'->>'products'
  and :'archived_review'::jsonb->'state_hashes'->>'capabilities'<>:'original'::jsonb->'state_hashes'->>'capabilities'
  and :'archived_review'::jsonb->'state_hashes'->>'certifications'<>:'original'::jsonb->'state_hashes'->>'certifications'
  and :'archived_review'::jsonb->'state_hashes'->>'markets'=:'original'::jsonb->'state_hashes'->>'markets',
  'facility changes must invalidate scoped groups while preserving an unrelated sector preview');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','capability','Taglio laser','confirm',
  jsonb_build_object('key','laser_cutting','facility_id',:'facility')),'40001');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'archived_review','capability','Taglio laser','confirm',
  jsonb_build_object('key','laser_cutting','facility_id',:'facility')),'42501');
reset role;
select pg_temp.c2_assert(not exists(select 1 from private.company_ux2c2_industrial_decisions where network_company_id=:'company')
  and not exists(select 1 from public.network_facility_capabilities where facility_id=:'facility'),
  'stale or archived facility selection must leave no industrial target or decision');
rollback to savepoint archived_facility;

-- A manual mutation between read and confirm invalidates the affected group.
savepoint stale_group;
set local role authenticated;
select public.p3_7b_set_product(:'company','plates','distributes',null,true);
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','confirm',
  '{"key":"tubes_pipes","relationship_type":"distributes","facility_id":null}'),'40001');
reset role;
select pg_temp.c2_assert((select count(*)=1 from public.network_company_products where company_id=:'company')
  and not exists(select 1 from private.company_ux2c2_industrial_decisions where network_company_id=:'company'),
  'stale confirmation must preserve the manual relation and leave no decision or partial target');
rollback to savepoint stale_group;

-- Four explicit confirmations through the production RPC and canonical writers.
set local role authenticated;
select pg_temp.c2_decide(:'org',:'company',:'original','product','Tubi saldati','confirm',
  '{"key":"tubes_pipes","relationship_type":"distributes","facility_id":null}') as product_added \gset
select public.company_ux2c2_industrial_review(:'org',:'company') as after_product \gset
select pg_temp.c2_assert(:'after_product'::jsonb->'state_hashes'->>'products'<>:'original'::jsonb->'state_hashes'->>'products'
  and :'after_product'::jsonb->'state_hashes'->>'capabilities'=:'original'::jsonb->'state_hashes'->>'capabilities'
  and :'after_product'::jsonb->'state_hashes'->>'markets'=:'original'::jsonb->'state_hashes'->>'markets'
  and :'after_product'::jsonb->'state_hashes'->>'certifications'=:'original'::jsonb->'state_hashes'->>'certifications',
  'a product confirmation must change only its canonical group version');
select pg_temp.c2_decide(:'org',:'company',:'original','capability','Taglio laser','confirm',
  jsonb_build_object('key','laser_cutting','facility_id',:'facility')) as capability_added \gset
select pg_temp.c2_decide(:'org',:'company',:'original','market','Automotive','confirm',
  '{"key":"automotive"}') as market_added \gset
select pg_temp.c2_decide(:'org',:'company',:'original','certification','ISO 9001','confirm',
  '{"key":"iso_9001","facility_id":null}') as certification_added \gset
select pg_temp.c2_assert(not exists(select 1 from jsonb_array_elements(jsonb_build_array(
  :'product_added'::jsonb,:'capability_added'::jsonb,:'market_added'::jsonb,:'certification_added'::jsonb)) r
  where r->>'contract'<>'company-ux2c2-industrial-v1' or r->>'decision'<>'confirmed'
    or r->>'effect'<>'added' or not (r->>'changed')::boolean or (r->>'idempotent')::boolean
    or r->>'target_id' is null or r->>'decision_id' is null),
  'each confirmation must return the committed target and decision');
select public.p3_7_managed_profile_state(:'company') as managed_after \gset
select pg_temp.c2_assert(jsonb_array_length(:'managed_after'::jsonb->'products')=1
  and jsonb_array_length(:'managed_after'::jsonb->'markets')=1
  and jsonb_array_length(:'managed_after'::jsonb->'certifications')=1,
  'managed read model must reflect canonical additions, not merely decision flags');
reset role;
select pg_temp.c2_assert((select relationship_type='distributes' and facility_id is null
  from public.network_company_products where id=(:'product_added'::jsonb->>'target_id')::uuid),
  'product relation must be the explicit user choice, not inferred production');
select pg_temp.c2_assert((select facility_id=:'facility'::uuid and verification_status='unverified'
  from public.network_facility_capabilities where id=(:'capability_added'::jsonb->>'target_id')::uuid),
  'capability must belong to the selected real facility and remain unverified');
select pg_temp.c2_assert((select facility_id is null and verification_status='unverified'
  and issuer is null and certificate_identifier is null and valid_from is null and valid_to is null
  and scope_text is null and evidence_reference is null
  from public.network_company_certifications where id=(:'certification_added'::jsonb->>'target_id')::uuid),
  'certification confirmation must not invent issuer, dates, identifier, evidence or a verification');
select pg_temp.c2_assert((select count(*)=4 from public.network_profile_management_events e
  join public.network_data_assertions a on a.id=e.source_assertion_id
  where e.network_company_id=:'company' and e.organization_id=:'org' and e.actor_user_id=:'owner'
    and a.source_type='company_declared' and a.ownership_type='company_managed' and a.review_state='accepted'),
  'four canonical additions must have four company-declared assertions and linked management events');
select pg_temp.c2_assert((select legal_name='C2 Legal Identity' and trading_name='C2 Trading'
  and website_url='https://ux2c2.example.test' and description='Manual company description.'
  and publication_status='published' and claimed_status='claimed' and verification_status='unverified'
  from public.network_companies where id=:'company')
  and (select count(*)=1 from public.network_facilities where company_id=:'company')
  and not exists(select 1 from public.network_company_role_assignments where company_id=:'company'),
  'industrial confirmation must preserve identity, description, trust and existing facilities without adding roles');

-- Exact retries succeed without repeating writes; changed choices cannot replace them.
set local role authenticated;
select pg_temp.c2_decide(:'org',:'company',:'original','product','Tubi saldati','confirm',
  '{"key":"tubes_pipes","relationship_type":"distributes","facility_id":null}') as product_retry \gset
select pg_temp.c2_assert((:'product_retry'::jsonb->>'idempotent')::boolean
  and not (:'product_retry'::jsonb->>'changed')::boolean
  and :'product_retry'::jsonb->>'target_id'=:'product_added'::jsonb->>'target_id'
  and :'product_retry'::jsonb->>'decision_id'=:'product_added'::jsonb->>'decision_id',
  'exact retry must return the original target/decision without another write');
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','confirm',
  '{"key":"tubes_pipes","relationship_type":"produces","facility_id":null}'),'40001');
reset role;
select pg_temp.c2_assert((select count(*)=4 from public.network_profile_management_events where network_company_id=:'company')
  and (select count(*)=4 from public.network_data_assertions where asserted_by=:'owner')
  and (select count(*)=4 from private.company_ux2c2_industrial_decisions where network_company_id=:'company'),
  'retry and rejected different choice must not duplicate canonical audit or decisions');
savepoint revoked_retry;
update public.organization_network_company_links set link_status='revoked' where network_company_id=:'company';
set local role authenticated;
select pg_temp.c2_raises(format('select pg_temp.c2_decide(%L,%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original','product','Tubi saldati','confirm',
  '{"key":"tubes_pipes","relationship_type":"distributes","facility_id":null}'),'42501');
rollback to savepoint revoked_retry;

-- New wording can be manually mapped to existing targets, without taking over their provenance.
update private.network_company_research set
  products=products||array['Forniture DEMO'],activities=activities||array['Lavorazione DEMO'],
  sectors=sectors||array['Settore DEMO'],certifications=certifications||array['Certificazione DEMO']
where company_id=:'company';
select to_jsonb(c) as certificate_before from public.network_company_certifications c
where id=(:'certification_added'::jsonb->>'target_id')::uuid \gset
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as duplicate_candidates \gset
select pg_temp.c2_decide(:'org',:'company',:'duplicate_candidates','product','Forniture DEMO','confirm',
  '{"key":"tubes_pipes","relationship_type":"distributes","facility_id":null}') as duplicate_product \gset
select pg_temp.c2_decide(:'org',:'company',:'duplicate_candidates','capability','Lavorazione DEMO','confirm',
  jsonb_build_object('key','laser_cutting','facility_id',:'facility')) as duplicate_capability \gset
select pg_temp.c2_decide(:'org',:'company',:'duplicate_candidates','market','Settore DEMO','confirm',
  '{"key":"automotive"}') as duplicate_market \gset
select pg_temp.c2_decide(:'org',:'company',:'duplicate_candidates','certification','Certificazione DEMO','confirm',
  '{"key":"iso_9001","facility_id":null}') as duplicate_certification \gset
select pg_temp.c2_assert(not exists(select 1 from jsonb_array_elements(jsonb_build_array(
  :'duplicate_product'::jsonb,:'duplicate_capability'::jsonb,:'duplicate_market'::jsonb,:'duplicate_certification'::jsonb)) r
  where r->>'effect'<>'already_present' or (r->>'changed')::boolean),
  'all four families must report existing targets without canonical mutation');
reset role;
select pg_temp.c2_assert((select to_jsonb(c)=:'certificate_before'::jsonb from public.network_company_certifications c
  where id=(:'certification_added'::jsonb->>'target_id')::uuid)
  and (select count(*)=4 from public.network_data_assertions where asserted_by=:'owner')
  and (select count(*)=4 from public.network_profile_management_events where network_company_id=:'company'),
  'duplicate handling must preserve existing data/provenance and produce no extra management events');

-- A manually detailed and Platform-verified certificate must also remain untouched.
set local role authenticated;
select public.p3_7b_upsert_certification(:'company',null,jsonb_build_object(
  'certification_type_key','iso_14001','facility_id',:'facility','issuer','Manual certification body',
  'certificate_identifier','MANUAL-C2-14001','valid_from','2025-01-01','valid_to','2025-12-31',
  'scope_text','Manually entered plant scope','evidence_reference','local:manual-certificate')) as manual_certification \gset
reset role;
update public.network_company_certifications set verification_status='verified'
where id=(:'manual_certification'::jsonb->>'certification_id')::uuid;
select to_jsonb(c) as verified_before from public.network_company_certifications c
where id=(:'manual_certification'::jsonb->>'certification_id')::uuid \gset
update private.network_company_research set certifications=certifications||array['ISO 14001'] where company_id=:'company';
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as verified_candidate \gset
select pg_temp.c2_decide(:'org',:'company',:'verified_candidate','certification','ISO 14001','confirm',
  jsonb_build_object('key','iso_14001','facility_id',:'facility')) as verified_duplicate \gset
select pg_temp.c2_assert(:'verified_duplicate'::jsonb->>'effect'='already_present'
  and :'verified_duplicate'::jsonb->>'target_id'=:'manual_certification'::jsonb->>'certification_id',
  'existing verified certificate must be identified instead of cloned');
reset role;
select pg_temp.c2_assert((select to_jsonb(c)=:'verified_before'::jsonb from public.network_company_certifications c
  where id=(:'manual_certification'::jsonb->>'certification_id')::uuid)
  and (select count(*)=5 from public.network_profile_management_events where network_company_id=:'company'),
  'duplicate handling must not overwrite manual details, expiry, verification or provenance');

-- Ignore requires no destination and remains a decision after source/version/date churn.
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as before_ignore \gset
select pg_temp.c2_decide(:'org',:'company',:'before_ignore','product','Non produciamo tubi saldati','ignore') as ignored \gset
select pg_temp.c2_assert(:'ignored'::jsonb->>'decision'='ignored' and :'ignored'::jsonb->>'effect'='ignored'
  and not (:'ignored'::jsonb->>'changed')::boolean and :'ignored'::jsonb->>'target_id' is null,
  'ignore must not require or apply a canonical selection');
reset role;
update private.network_company_research set researched_at=now()+interval '2 days',published_at=now()+interval '1 day',
  extractor_version='c2-synthetic-v2',source_urls=array['https://ux2c2.example.test/nuova-fonte'] where company_id=:'company';
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as after_ignore \gset
select pg_temp.c2_assert(pg_temp.c2_proposal(:'after_ignore','product','Non produciamo tubi saldati')->'decision'->>'action'='ignored'
  and pg_temp.c2_proposal(:'after_ignore','product','Non produciamo tubi saldati')-'decision'=
    pg_temp.c2_proposal(:'before_ignore','product','Non produciamo tubi saldati')-'decision'
  and pg_temp.c2_proposal(:'after_ignore','product','Tubi saldati')-'decision'=
    pg_temp.c2_proposal(:'original','product','Tubi saldati')-'decision',
  'ignored and confirmed decisions must retain their exact proposal hash, sources, version and observed date after research metadata changes');
reset role;
select pg_temp.c2_assert((select count(*)=5 from public.network_profile_management_events where network_company_id=:'company')
  and (select count(*)=5 from public.network_data_assertions where asserted_by=:'owner'),
  'ignore and later reads must not create management events');

savepoint draft_confirmation;
update public.network_companies set publication_status='draft' where id=:'company';
update private.network_company_research set sectors=sectors||array['Edilizia'] where company_id=:'company';
set local role authenticated;
select public.company_ux2c2_industrial_review(:'org',:'company') as draft_review \gset
select pg_temp.c2_decide(:'org',:'company',:'draft_review','market','Edilizia','confirm',
  '{"key":"construction_infrastructure"}');
reset role;
select pg_temp.c2_assert((select publication_status='draft' and claimed_status='claimed' and verification_status='unverified'
  from public.network_companies where id=:'company'),'owner confirmation must not publish or verify a draft');
rollback to savepoint draft_confirmation;

select pg_temp.c2_raises(format('delete from private.company_ux2c2_industrial_decisions where network_company_id=%L',:'company'),'55000');
select pg_temp.c2_raises(format('update private.company_ux2c2_industrial_decisions set actor_user_id=null where network_company_id=%L',:'company'),'55000');

rollback;
