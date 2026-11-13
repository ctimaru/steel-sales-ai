-- NET-PROFILE-DATA2: first-party evidence queue is service-only, with
-- private RLS audit and refusal to upgrade evidence through a member JWT.
begin;
create or replace function pg_temp.netprofile_data2_assert(ok boolean, msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-PROFILE-DATA2 %',msg; end if; end $$;

select pg_temp.netprofile_data2_assert(
  (select relrowsecurity from pg_class where oid='private.netprofile_data2_reviews'::regclass),
  'audit table must use RLS');
select pg_temp.netprofile_data2_assert(
 exists (
   select 1 from pg_trigger
   where tgrelid='private.netprofile_data2_reviews'::regclass
     and tgname='netprofile_data2_immutable'
     and not tgisinternal
 ),'audit log must be immutable even under service role');
select pg_temp.netprofile_data2_assert(
  not has_table_privilege('anon','private.netprofile_data2_reviews','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_data2_reviews','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_data2_reviews','INSERT')
  and not has_table_privilege('authenticated','private.netprofile_data2_reviews','UPDATE'),
  'browser audit grants forbidden');
select pg_temp.netprofile_data2_assert(
  not has_function_privilege('anon','public.netprofile_data2_queue(integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.netprofile_data2_queue(integer)','EXECUTE')
  and not has_function_privilege('anon',
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])','EXECUTE')
  and not has_function_privilege('authenticated',
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])','EXECUTE')
  and has_function_privilege('service_role','public.netprofile_data2_queue(integer)','EXECUTE')
  and has_function_privilege('service_role',
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])','EXECUTE'),
  'only service role can invoke reviewer API');
select pg_temp.netprofile_data2_assert(
  position('review_status=''candidate''' in pg_get_functiondef('public.netprofile_data2_queue(integer)'::regprocedure))>0
  and position('c.publication_status=''published''' in pg_get_functiondef('public.netprofile_data2_queue(integer)'::regprocedure))>0
  and position('net-profile-data2-v1' in pg_get_functiondef(
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])'::regprocedure))>0
  and position('confidence<0.970' in pg_get_functiondef(
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])'::regprocedure))>0,
  'queue and acceptance guards remain active');
select pg_temp.netprofile_data2_assert(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'netprofile_data2_%'
      and not p.prosecdef
  ),'service-only security definer functions require explicit role guard');
set local role authenticated;
do $$
begin
 begin
   perform public.netprofile_data2_queue(10);
   raise exception 'Non-service queue unexpectedly accessible';
 exception when sqlstate '42501' then null;
 end;
 begin
   perform public.netprofile_data2_record(
     '00000000-0000-0000-0000-000000000001'::uuid,'net-profile-data2-v1',
     'supported','unauthorized','https://example.com/',
     repeat('f',64),'sample source quote',0.99, '{}'::text[]);
   raise exception 'Non-service write unexpectedly accessible';
 exception when sqlstate '42501' then null;
 end;
end $$;
reset role;

-- Disposable local fixture: the DB must independently refuse low confidence,
-- allow only correctly matched first-party corporate evidence, and atomically
-- record exactly one approval. Rollback prevents seeding any persistent data.
insert into public.network_companies(
 id, legal_name,country_code,website_url,website_domain,
 publication_status,claimed_status,verification_status
) values(
 '00000000-0000-0000-0000-000000902401'::uuid,'DATATEST Acciai S.p.A.','IT',
 'https://data2-fixture.example.test/','data2-fixture.example.test',
 'published','unclaimed','unverified'
);
insert into private.network_company_enrichment(
 id,canonical_company_id,field_key,field_value,evidence_url,
 evidence_excerpt,extractor_version,review_status,fetched_at
) values(
 '00000000-0000-0000-0000-000000902402'::uuid,
 '00000000-0000-0000-0000-000000902401'::uuid,
 'products','["Tubi strutturali saldati"]'::jsonb,
 'https://data2-fixture.example.test/prodotti',
 'Tubi strutturali saldati','ci-local-test','candidate',now()
);
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select pg_temp.netprofile_data2_assert(
 (public.netprofile_data2_queue(50)->>'contract')='net-profile-data2-queue-v1',
 'service role can retrieve candidate queue');
do $neg$
begin
 begin
  perform public.netprofile_data2_record(
    '00000000-0000-0000-0000-000000902402'::uuid,
    'net-profile-data2-v1','supported','test-model',
    'https://data2-fixture.example.test/prodotti',
    repeat('a',64),'Tubi strutturali saldati',0.70,'{}'::text[]);
  raise exception 'low confidence improperly auto-accepted';
 exception when sqlstate '22023' then null;
 end;
end $neg$;
select pg_temp.netprofile_data2_assert(
 (public.netprofile_data2_record(
  '00000000-0000-0000-0000-000000902402'::uuid,
  'net-profile-data2-v1','supported','test-model',
  'https://data2-fixture.example.test/prodotti',
  repeat('b',64),'Tubi strutturali saldati',0.975,'{}'::text[]
 )->>'accepted')='true',
 'the vetted first-party claim is accepted atomically');
reset role;
select pg_temp.netprofile_data2_assert(
 (select review_status='accepted' from private.network_company_enrichment
  where id='00000000-0000-0000-0000-000000902402'::uuid),
 'the accepted candidate is stored');
select pg_temp.netprofile_data2_assert(
 (select count(*)=1 from private.netprofile_data2_reviews
  where evidence_id='00000000-0000-0000-0000-000000902402'::uuid),
 'exactly one private audit decision recorded');
select pg_temp.netprofile_data2_assert(
 (select claimed_status='unclaimed' and verification_status='unverified'
  from public.network_companies
  where id='00000000-0000-0000-0000-000000902401'::uuid),
 'company claim and verification unchanged');
rollback;
