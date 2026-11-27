-- COMPANY-UX2.C.1 acceptance. Synthetic local/CI data only; always rolled back.
begin;

create function pg_temp.c1_assert(ok boolean,message text)
returns void language plpgsql as $fn$
begin
  if not coalesce(ok,false) then raise exception 'C.1 assertion failed: %',message; end if;
end;
$fn$;
create function pg_temp.c1_raises(statement text,expected_state text)
returns void language plpgsql as $fn$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate<>expected_state then
      raise exception 'C.1 expected SQLSTATE %, got %: %',expected_state,sqlstate,sqlerrm;
    end if;
    return;
  end;
  raise exception 'C.1 statement unexpectedly succeeded: %',statement;
end;
$fn$;

\set owner '00000000-0000-4000-8000-00000002c101'
\set viewer '00000000-0000-4000-8000-00000002c102'
\set outsider '00000000-0000-4000-8000-00000002c103'
\set staff '00000000-0000-4000-8000-00000002c104'
\set org '00000000-0000-4000-8000-00000002c201'
\set other_org '00000000-0000-4000-8000-00000002c202'
\set company '00000000-0000-4000-8000-00000002c301'
\set other_company '00000000-0000-4000-8000-00000002c302'

insert into auth.users(id,email,email_confirmed_at) values
  (:'owner','ux2c1-owner@example.test',now()),(:'viewer','ux2c1-viewer@example.test',now()),
  (:'outsider','ux2c1-outsider@example.test',now()),(:'staff','ux2c1-staff@example.test',now());
insert into public.organizations(id,name,slug,created_by,country_code,industry) values
  (:'org','C1 synthetic company','ux2c1-synthetic-own',:'owner','IT','steel'),
  (:'other_org','C1 other company','ux2c1-synthetic-other',:'outsider','IT','steel');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
  (:'org',:'owner','admin','active',true),(:'org',:'viewer','viewer','active',true),
  (:'other_org',:'outsider','admin','active',true);
insert into public.platform_user_roles(user_id,role,status,granted_by,reason) values
  (:'staff','platform_superadmin','active',null,'C1 synthetic negative authorization test');
insert into public.network_companies(id,legal_name,trading_name,country_code,website_url,description,
  publication_status,claimed_status,verification_status) values
  (:'company','C1 Legal Identity','C1 Trading','IT','https://ux2c1.example.test','Original company description.',
   'published','claimed','unverified'),
  (:'other_company','C1 Other Legal Identity','C1 Other','IT','https://other-ux2c1.example.test','Other organization description.',
   'published','claimed','unverified');
insert into public.network_company_claims(network_company_id,organization_id,requested_by,status,
  reviewed_by,reviewed_at,proof_method,proof_status,proof_verified_by,proof_verified_at) values
  (:'company',:'org',:'owner','approved',:'owner',now(),'manual_review','verified',:'owner',now()),
  (:'other_company',:'other_org',:'outsider','approved',:'outsider',now(),'manual_review','verified',:'outsider',now());
insert into public.organization_network_company_links(organization_id,network_company_id,claim_id,linked_by,link_status)
select organization_id,network_company_id,id,requested_by,'active'
from public.network_company_claims where network_company_id in (:'company',:'other_company');

select pg_temp.c1_assert(
  not has_table_privilege('authenticated','private.company_ux2c1_description_decisions','SELECT')
  and not has_table_privilege('authenticated','private.company_ux2c1_description_decisions','INSERT')
  and not has_table_privilege('service_role','private.company_ux2c1_description_decisions','UPDATE')
  and (select relrowsecurity from pg_class where oid='private.company_ux2c1_description_decisions'::regclass),
  'decision snapshots must remain private and RLS-enabled');
select pg_temp.c1_assert(
  not has_function_privilege('anon','public.company_ux2c1_description_review(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.company_ux2c1_decide_description(uuid,uuid,text,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.company_ux2c1_update_overview(uuid,uuid,text,text,text,text)','EXECUTE')
  and not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'company_ux2c1_%' and p.prosecdef),
  'public facades must be invoker-only and inaccessible anonymously');
select pg_temp.c1_assert(private.company_ux2c1_description_hash(null)=
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'description hash must use standard SHA256 UTF8, with null treated as empty');

-- No research is an explicit safe state, with the current manual description.
select set_config('request.jwt.claim.sub',:'owner',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as empty_state \gset
select pg_temp.c1_assert(:'empty_state'::jsonb->>'availability'='no_research'
  and :'empty_state'::jsonb->>'current_description'='Original company description.',
  'absence must preserve manual editing and must not fabricate a suggestion');
reset role;

-- Clearing optional overview fields must retain a JSON null declaration, while
-- canonical company columns and the existing audit after_value remain SQL NULL.
-- Roll back this scenario so subsequent decision-count assertions stay isolated.
savepoint clear_nullable_overview;
set local role authenticated;
select public.company_ux2c1_update_overview(:'org',:'company',:'empty_state'::jsonb->>'current_description_hash',
  'C1 Trading','https://ux2c1.example.test',null) as cleared_description \gset
select pg_temp.c1_assert(:'cleared_description'::jsonb->'description'='null'::jsonb
  and :'cleared_description'::jsonb->>'description_hash'=
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'clearing description must succeed through the protected writer and return its empty version');
select pg_temp.c1_raises(format('select public.company_ux2c1_update_overview(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'empty_state'::jsonb->>'current_description_hash','C1 Trading','https://ux2c1.example.test','Stale original copy.'),'40001');
select public.company_ux2c1_update_overview(:'org',:'company',:'cleared_description'::jsonb->>'description_hash',
  '   ','',null) as cleared_overview \gset
-- A repeated clear is a no-op for field assertions and management events.
select public.company_ux2c1_update_overview(:'org',:'company',:'cleared_overview'::jsonb->>'description_hash',
  null,null,null);
reset role;
select pg_temp.c1_assert((select trading_name is null and website_url is null and description is null
    and legal_name='C1 Legal Identity' and publication_status='published'
    and verification_status='unverified' and claimed_status='claimed'
  from public.network_companies where id=:'company'),
  'cleared optional fields must remain SQL NULL without changing legal identity, publication, verification or claim');
select pg_temp.c1_assert((select count(*)=3 and count(distinct a.field_path)=3
  from public.network_data_assertions a
  where a.entity_type='company' and a.entity_id=:'company'
    and a.field_path in ('trading_name','website_url','description')
    and a.asserted_value='null'::jsonb and a.asserted_value is not null
    and a.source_type='company_declared' and a.ownership_type='company_managed'
    and a.review_state='accepted' and a.asserted_by=:'owner'),
  'each cleared nullable field must have one accepted company declaration containing JSON null');
select pg_temp.c1_assert((select count(*)=3 and count(distinct e.field_path)=3
  from public.network_profile_management_events e
  join public.network_data_assertions a on a.id=e.source_assertion_id
  where e.network_company_id=:'company' and e.organization_id=:'org' and e.actor_user_id=:'owner'
    and e.operation='update_overview' and e.entity_type='company' and e.entity_id=:'company'
    and e.field_path=a.field_path and e.after_value is null
    and e.before_value=case e.field_path
      when 'trading_name' then to_jsonb('C1 Trading'::text)
      when 'website_url' then to_jsonb('https://ux2c1.example.test'::text)
      when 'description' then to_jsonb('Original company description.'::text) end),
  'clearing fields must preserve the existing before/after audit and assertion references');
select pg_temp.c1_assert((select count(*)=3 from public.network_data_assertions where entity_id=:'company')
  and (select count(*)=3 from public.network_profile_management_events where network_company_id=:'company')
  and not exists(select 1 from private.company_ux2c1_description_decisions where network_company_id=:'company'),
  'repeated clear and rejected stale save must not create extra assertions, events or assistant decisions');
rollback to savepoint clear_nullable_overview;

insert into private.network_company_research(company_id,status,summary,source_urls,extractor_version,
  model,published_at,researched_at,facts) values (
  :'company','published',
  'Azienda specializzata nella lavorazione di tubi e profili in acciaio, con servizi di taglio destinati a imprese industriali.',
  array['https://ux2c1.example.test/produzione','https://ux2c1.example.test/azienda'],
  'net-research1-v1','synthetic-local-model','2026-11-26 10:00:00+00','2026-11-26 10:00:00+00',
  '{"private_diagnostic":"must_not_leave_private_schema"}'::jsonb
);
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as original \gset
select pg_temp.c1_assert(:'original'::jsonb->>'contract'='company-ux2c1-description-v1'
  and :'original'::jsonb->>'availability'='available'
  and jsonb_array_length(:'original'::jsonb->'proposal'->'source_urls')=2
  and not (:'original'::jsonb ? 'facts') and not (:'original'::jsonb->'proposal' ? 'model'),
  'one owner proposal must expose bounded sources, never private facts or model details');

-- Viewer, unrelated admin, wrong explicit organization, superadmin-only, and
-- missing authentication must all fail before data or mutation is available.
select set_config('request.jwt.claim.sub',:'viewer',true);
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'company'),'42501');
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','accept'),'42501');
select pg_temp.c1_raises(format('select public.company_ux2c1_update_overview(%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->>'current_description_hash'),'42501');
select set_config('request.jwt.claim.sub',:'outsider',true);
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'company'),'42501');
select set_config('request.jwt.claim.sub',:'staff',true);
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'company'),'42501');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'company'),'42501');
select set_config('request.jwt.claim.sub',:'owner',true);
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'other_org',:'company'),'42501');
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'other_company'),'42501');
reset role;

-- Existing authorization is checked again on every operation, including retry.
savepoint revoked_claim;
update public.network_company_claims set status='under_review' where network_company_id=:'company';
set local role authenticated;
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'company'),'42501');
rollback to savepoint revoked_claim;
savepoint revoked_link;
update public.organization_network_company_links set link_status='revoked' where network_company_id=:'company';
set local role authenticated;
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'company'),'42501');
rollback to savepoint revoked_link;
savepoint inactive_admin;
update public.organization_memberships set status='suspended' where organization_id=:'org' and user_id=:'owner';
set local role authenticated;
select pg_temp.c1_raises(format('select public.company_ux2c1_description_review(%L,%L)',:'org',:'company'),'42501');
rollback to savepoint inactive_admin;

savepoint unpublished_research;
update private.network_company_research set status='pilot_review' where company_id=:'company';
set local role authenticated;
select pg_temp.c1_assert(public.company_ux2c1_description_review(:'org',:'company')->>'availability'='no_research',
  'claim does not expose unpublished pilot research');
rollback to savepoint unpublished_research;
savepoint empty_summary;
update private.network_company_research set summary=null where company_id=:'company';
set local role authenticated;
select pg_temp.c1_assert(public.company_ux2c1_description_review(:'org',:'company')->>'availability'='no_summary',
  'no generated summary remains an explicit unavailable state');
rollback to savepoint empty_summary;

-- Same content, source ordering and failed-refresh timestamp changes preserve
-- proposal identity. observed_at stays the saved proposal's publication date.
update private.network_company_research set researched_at=now(),last_error='site_unreadable',
  source_urls=array['https://ux2c1.example.test/azienda','https://ux2c1.example.test/produzione','https://ux2c1.example.test/azienda']
where company_id=:'company';
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as same_content \gset
select pg_temp.c1_assert(:'same_content'::jsonb->'proposal'->>'hash'=:'original'::jsonb->'proposal'->>'hash'
  and :'same_content'::jsonb->'proposal'->>'observed_at'=:'original'::jsonb->'proposal'->>'observed_at',
  'failed attempts must not create a new version or pretend the content was refreshed');
reset role;

savepoint changed_summary;
update private.network_company_research set summary=
  'Una nuova proposta descrive la lavorazione di tubi strutturali e profilati in acciaio per le aziende del settore industriale.'
where company_id=:'company';
set local role authenticated;
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','accept'),'40001');
rollback to savepoint changed_summary;
savepoint changed_source;
update private.network_company_research set source_urls=array['https://ux2c1.example.test/nuova-fonte'] where company_id=:'company';
set local role authenticated;
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','accept'),'40001');
rollback to savepoint changed_source;
savepoint changed_extractor;
update private.network_company_research set extractor_version='net-research1-v2' where company_id=:'company';
set local role authenticated;
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','accept'),'40001');
rollback to savepoint changed_extractor;
savepoint changed_domain;
update public.network_companies set website_url='https://new-ux2c1.example.test' where id=:'company';
set local role authenticated;
select pg_temp.c1_assert(public.company_ux2c1_description_review(:'org',:'company')->>'availability'='source_mismatch',
  'a previous official domain must not be attributed to the current website');
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','accept'),'40001');
rollback to savepoint changed_domain;
savepoint hostile_source;
update private.network_company_research set source_urls=array['https://ux2c1.example.test.evil.test/source'] where company_id=:'company';
set local role authenticated;
select pg_temp.c1_assert(public.company_ux2c1_description_review(:'org',:'company')->>'availability'='source_mismatch',
  'a suffix lookalike must not count as the official domain');
rollback to savepoint hostile_source;

-- A manual save after rendering makes both stale assistant and manual writes
-- fail, rather than silently overwriting the just-edited description.
savepoint manual_change;
set local role authenticated;
select public.company_ux2c1_update_overview(:'org',:'company',:'original'::jsonb->>'current_description_hash',
  'C1 Trading','https://ux2c1.example.test','Manual description saved after rendering.') as manual_saved \gset
select pg_temp.c1_assert(:'manual_saved'::jsonb->>'description_hash'=
  encode(sha256(convert_to('Manual description saved after rendering.','UTF8')),'hex'),
  'manual save must return the version of the actual persisted description');
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','accept'),'40001');
select pg_temp.c1_raises(format('select public.company_ux2c1_update_overview(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->>'current_description_hash','C1 Trading','https://ux2c1.example.test','Stale manual copy.'),'40001');
rollback to savepoint manual_change;

-- Accept derives the text from the locked research row, never a client copy.
set local role authenticated;
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','accept','Injected text'),'22023');
select public.company_ux2c1_decide_description(:'org',:'company',:'original'::jsonb->'proposal'->>'hash',
  :'original'::jsonb->>'current_description_hash','accept') as accepted \gset
select pg_temp.c1_assert(:'accepted'::jsonb->>'decision'='accepted'
  and (:'accepted'::jsonb->>'changed')::boolean
  and :'accepted'::jsonb->>'description'=:'original'::jsonb->'proposal'->>'description',
  'accept must apply the server proposal');
select public.company_ux2c1_decide_description(:'org',:'company',:'original'::jsonb->'proposal'->>'hash',
  :'original'::jsonb->>'current_description_hash','accept') as retry \gset
select pg_temp.c1_assert((:'retry'::jsonb->>'idempotent')::boolean and not (:'retry'::jsonb->>'changed')::boolean,
  'an exact double-submit must not create another write');
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->'proposal'->>'hash',:'original'::jsonb->>'current_description_hash','ignore'),'40001');
select pg_temp.c1_raises(format('select public.company_ux2c1_update_overview(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'original'::jsonb->>'current_description_hash','C1 Trading','https://ux2c1.example.test','Old overview tab.'),'40001');
reset role;
select pg_temp.c1_assert((select count(*)=1 from private.company_ux2c1_description_decisions where network_company_id=:'company')
  and (select count(*)=1 from public.network_profile_management_events where network_company_id=:'company')
  and (select count(*)=1 from public.network_data_assertions where entity_id=:'company' and field_path='description'
    and source_type='company_declared' and ownership_type='company_managed' and review_state='accepted'),
  'one acceptance must create one canonical assertion, event and owner decision');
select pg_temp.c1_assert((select trading_name='C1 Trading' and website_url='https://ux2c1.example.test'
  and publication_status='published' and verification_status='unverified' and claimed_status='claimed'
  from public.network_companies where id=:'company'),
  'accept must preserve identity, website, publication, verification and claim');
select pg_temp.c1_assert((select proposed_description=:'original'::jsonb->'proposal'->>'description'
  and cardinality(source_urls)=2 and extractor_version='net-research1-v1' and actor_user_id=:'owner'
  from private.company_ux2c1_description_decisions where network_company_id=:'company'),
  'decision must preserve exact proposed text, ordered sources, extractor and actor');

-- Ignore is persistent per content, does not change description and cannot
-- be undone by source/version/timestamp churn in a later identical extraction.
update private.network_company_research set summary=
  'Azienda specializzata nella distribuzione di lamiere e profilati in acciaio, con servizi rivolti alla carpenteria industriale.'
where company_id=:'company';
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as to_ignore \gset
select public.company_ux2c1_decide_description(:'org',:'company',:'to_ignore'::jsonb->'proposal'->>'hash',
  :'to_ignore'::jsonb->>'current_description_hash','ignore') as ignored \gset
select pg_temp.c1_assert(:'ignored'::jsonb->>'decision'='ignored' and not (:'ignored'::jsonb->>'changed')::boolean,
  'ignore must not apply any text');
reset role;
update private.network_company_research set researched_at=now()+interval '1 day',published_at=now()+interval '1 day',
  extractor_version='net-research1-v2',source_urls=array['https://ux2c1.example.test/altra-fonte']
where company_id=:'company';
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as still_ignored \gset
select pg_temp.c1_assert(:'still_ignored'::jsonb->>'availability'='already_decided'
  and :'still_ignored'::jsonb->'decision'->>'action'='ignored'
  and :'still_ignored'::jsonb->'proposal'=:'to_ignore'::jsonb->'proposal'
  and not (:'still_ignored'::jsonb->'decision' ? 'actor_user_id'),
  'identical ignored summary must stay decided with its original source snapshot after research metadata changes');
reset role;
select pg_temp.c1_assert((select count(*)=1 from public.network_profile_management_events where network_company_id=:'company')
  and (select count(*)=1 from public.network_data_assertions where entity_id=:'company' and field_path='description'),
  'ignore must not create description assertions or overview events');

-- Edited confirmation is bounded, explicitly recorded, and works for the
-- owner's draft without publishing or verifying that company.
update private.network_company_research set summary=
  'Impresa attiva nella fornitura di tubi strutturali per applicazioni industriali, con lavorazioni richieste dalle aziende clienti.'
where company_id=:'company';
update public.network_companies set publication_status='draft' where id=:'company';
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as to_edit \gset
select pg_temp.c1_assert(:'to_edit'::jsonb->>'availability'='available','owner may review an existing published research snapshot for their draft');
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'to_edit'::jsonb->'proposal'->>'hash',:'to_edit'::jsonb->>'current_description_hash','edit','   '),'22023');
select pg_temp.c1_raises(format('select public.company_ux2c1_decide_description(%L,%L,%L,%L,%L,%L)',
  :'org',:'company',:'to_edit'::jsonb->'proposal'->>'hash',:'to_edit'::jsonb->>'current_description_hash','edit',repeat('x',4001)),'22023');
savepoint max_edit;
select public.company_ux2c1_decide_description(:'org',:'company',:'to_edit'::jsonb->'proposal'->>'hash',
  :'to_edit'::jsonb->>'current_description_hash','edit',repeat('x',4000)) as maximum_edit \gset
select pg_temp.c1_assert(char_length(:'maximum_edit'::jsonb->>'description')=4000,'edited description allows the canonical 4000-character limit');
rollback to savepoint max_edit;
select public.company_ux2c1_decide_description(:'org',:'company',:'to_edit'::jsonb->'proposal'->>'hash',
  :'to_edit'::jsonb->>'current_description_hash','edit','Descrizione controllata e corretta dal rappresentante aziendale.') as edited \gset
select pg_temp.c1_assert(:'edited'::jsonb->>'decision'='edited'
  and :'edited'::jsonb->>'description'='Descrizione controllata e corretta dal rappresentante aziendale.',
  'edited confirmation must apply precisely the reviewed human text');
reset role;
select pg_temp.c1_assert((select publication_status='draft' and verification_status='unverified' from public.network_companies where id=:'company'),
  'confirming research never publishes a draft or changes verification');

-- Explicit no-op confirmation still creates company-declared provenance. The
-- reader retains sources while distinguishing a redundant proposal; a valid
-- confirmation remains auditable.
update private.network_company_research set summary=
  'Azienda che realizza lavorazioni di tubi in acciaio per commesse industriali, con processi di taglio e preparazione dei materiali.'
where company_id=:'company';
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as no_op_candidate \gset
reset role;
update public.network_companies set description=:'no_op_candidate'::jsonb->'proposal'->>'description' where id=:'company';
set local role authenticated;
select public.company_ux2c1_description_review(:'org',:'company') as already_current \gset
select pg_temp.c1_assert(:'already_current'::jsonb->>'availability'='already_current'
  and :'already_current'::jsonb->'proposal'=:'no_op_candidate'::jsonb->'proposal',
  'same text must remain consultable with sources without inviting redundant editing');
select public.company_ux2c1_decide_description(:'org',:'company',:'no_op_candidate'::jsonb->'proposal'->>'hash',
  :'already_current'::jsonb->>'current_description_hash','accept') as no_op \gset
select pg_temp.c1_assert(not (:'no_op'::jsonb->>'changed')::boolean and :'no_op'::jsonb->>'decision'='accepted',
  'explicit identical confirmation must be an audited no-op');
reset role;
select pg_temp.c1_assert((select count(*)=3 from public.network_profile_management_events where network_company_id=:'company')
  and exists(select 1 from public.network_data_assertions where entity_id=:'company' and field_path='description'
    and source_type='company_declared' and ownership_type='company_managed'
    and asserted_value=to_jsonb(:'no_op'::jsonb->>'description')),
  'no-op confirmation must still establish field-specific company-declared provenance');

select pg_temp.c1_raises(format('update private.company_ux2c1_description_decisions set decision=%L where network_company_id=%L',
  'ignored',:'company'),'55000');
select pg_temp.c1_raises(format('delete from private.company_ux2c1_description_decisions where network_company_id=%L',:'company'),'55000');
select pg_temp.c1_raises(format('update private.company_ux2c1_description_decisions set actor_user_id=null where network_company_id=%L',:'company'),'55000');
select pg_temp.c1_assert((select count(*)=4 from private.company_ux2c1_description_decisions where network_company_id=:'company'),
  'accept, ignore, edit and no-op each have one immutable decision; retries create none');

-- Final account erasure is retention-reviewed by LR5. This ledger must not
-- introduce an additional RESTRICT blocker, or lose the retained decision.
-- The isolated actor has no organization/claim references in other ledgers.
insert into auth.users(id,email,email_confirmed_at)
values ('00000000-0000-4000-8000-00000002c105','ux2c1-erasure@example.test',now());
insert into private.company_ux2c1_description_decisions(
  organization_id,network_company_id,actor_user_id,proposal_hash,summary_hash,
  decision,proposed_description,source_urls,before_description,after_description
) values (
  :'org',:'company','00000000-0000-4000-8000-00000002c105',repeat('a',64),repeat('b',64),
  'ignored','Descrizione sintetica conservata come prova della decisione, senza attribuire verifiche o nuove informazioni alla societa.',
  array['https://ux2c1.example.test/retention'],'Retained current description','Retained current description'
) returning id as retained_decision_id \gset
select to_jsonb(d)-'actor_user_id' as retained_snapshot
from private.company_ux2c1_description_decisions d where id=:'retained_decision_id' \gset
delete from auth.users where id='00000000-0000-4000-8000-00000002c105';
select pg_temp.c1_assert((select actor_user_id is null and to_jsonb(d)-'actor_user_id'=:'retained_snapshot'::jsonb
  from private.company_ux2c1_description_decisions d where id=:'retained_decision_id'),
  'approved account erasure must anonymize only the actor while preserving the immutable snapshot');

rollback;
