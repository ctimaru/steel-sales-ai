-- CRAWL-IT6.6a/b — in-transaction, synthetic corporate rows only.
begin;
create or replace function pg_temp.it66_assert(ok boolean,detail text)
returns void language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'CRAWL-IT6.6: %',detail; end if;
end $$;
create or replace function pg_temp.it66_fails(stmt text,expected text)
returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then
  if position(lower(expected) in lower(sqlerrm))>0 then return; end if;
  raise exception 'Unexpected SQL error: %',sqlerrm;
 end;
 raise exception 'Fail-closed test unexpectedly allowed: %',stmt;
end $$;

select pg_temp.it66_assert(
 not has_function_privilege('anon','public.crawl_it66_bulk_intake(uuid,text,jsonb,boolean)','EXECUTE'),
 'no anon import');
select pg_temp.it66_assert(
 not has_table_privilege('authenticated','public.network_bulk_intake_rows','SELECT'),
 'private rows cannot be selected by company members');
-- Authenticated tenant must not call either private SECURITY DEFINER read report.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000069999',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $guard$
begin
 begin
   perform private.crawl_it66_staged_rows_impl();
   raise exception 'Tenant read private staging without discovery.read';
 exception when insufficient_privilege then null;
 end;
 begin
   perform private.crawl_it66_pipeline_audit_impl();
   raise exception 'Tenant read internal discovery metrics without discovery.read';
 exception when insufficient_privilege then null;
 end;
end $guard$;
reset role;

select pg_temp.it66_assert(
 (select count(*) from public.network_discovery_source_registry
  where source_url='https://registroimprese.infocamere.it/web/guest/elenchi-di-imprese'
  and governance_status='unreviewed' and enabled_for_discovery=false)=1,
 'InfoCamere proposed only, not automatically approved');

do $$
begin
 if not exists (select 1 from public.platform_user_roles
  where role='platform_superadmin' and status='active') then
    insert into auth.users(id,email,email_confirmed_at)
    values('00000000-0000-0000-0000-000000066001','it66a-fixture@example.test',now())
    on conflict(id) do nothing;
    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values('00000000-0000-0000-0000-000000066001','platform_superadmin','active',null,'Synthetic IT66 fixture');
 end if;
end $$;
select user_id as owner_id from public.platform_user_roles
 where role='platform_superadmin' and status='active' limit 1 \gset

insert into public.network_discovery_source_registry(source_name,source_url,source_type)
values('CRAWL66 synthetic licensed source','https://it66-fixture.example.test/registry','licensed_search')
returning id as synthetic_source_id \gset
select count(*)::int as companies_before from public.network_companies \gset

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.crawl_it66_bulk_intake(
 :'synthetic_source_id'::uuid,repeat('a',64)||':0',
 '[{"company_name":"Tubi Milano Fixture Srl","role":"trader_distributor","domain":"it66-test-supplier.example","province":"MI","source_record_id":"CSV-1"},
   {"company_name":"Macchine Parma Fixture Srl","role":"end_user","domain":"it66-test-buyer.example","province":"PR","source_record_id":"CSV-2"}]'::jsonb,false
)::text as before_rights_preview \gset
select pg_temp.it66_fails(
 format('select public.crawl_it66_bulk_intake(%L::uuid,repeat(''a'',64)||'':0'',
 ''[{"company_name":"Tubi Milano Fixture Srl","role":"trader_distributor","domain":"it66-test-supplier.example","province":"MI"}]''::jsonb,true)',:'synthetic_source_id'),
 'rights must be verified');
select public.crawl_it2_review_source(
 :'synthetic_source_id'::uuid,'approved','allows_reuse','licensed','exclude_personal_data',
 'https://it66-fixture.example.test/terms','Fixture source explicitly approved for synthetic corporate-only use',false
);

select public.crawl_it66_bulk_intake(
 :'synthetic_source_id'::uuid,repeat('a',64)||':0',
 '[{"company_name":"Tubi Milano Fixture Srl","role":"trader_distributor","domain":"it66-test-supplier.example","province":"MI","source_record_id":"CSV-1"},
   {"company_name":"Macchine Parma Fixture Srl","role":"end_user","domain":"it66-test-buyer.example","province":"PR","source_record_id":"CSV-2"}]'::jsonb,false
)::text as preview \gset
select public.crawl_it66_bulk_intake(
 :'synthetic_source_id'::uuid,repeat('a',64)||':0',
 '[{"company_name":"Tubi Milano Fixture Srl","role":"trader_distributor","domain":"it66-test-supplier.example","province":"MI","source_record_id":"CSV-1"},
   {"company_name":"Macchine Parma Fixture Srl","role":"end_user","domain":"it66-test-buyer.example","province":"PR","source_record_id":"CSV-2"}]'::jsonb,true
)::text as staged \gset
select public.crawl_it66_bulk_intake(
 :'synthetic_source_id'::uuid,repeat('a',64)||':0',
 '[{"company_name":"Tubi Milano Fixture Srl","role":"trader_distributor","domain":"it66-test-supplier.example","province":"MI","source_record_id":"CSV-1"},
   {"company_name":"Macchine Parma Fixture Srl","role":"end_user","domain":"it66-test-buyer.example","province":"PR","source_record_id":"CSV-2"}]'::jsonb,true
)::text as replay \gset
select public.crawl_it66_pipeline_audit()::text as audit \gset
select public.crawl_it66_staged_rows()::text as stage_rows \gset

select pg_temp.it66_fails(
 format('select public.crawl_it66_bulk_intake(%L::uuid,repeat(''b'',64)||'':0'',
 ''[{"company_name":"No private contacts","role":"end_user","domain":"it66-unsafe.example","phone":"12345"}]''::jsonb,true)',:'synthetic_source_id'),
 'personal or unknown fields');
select pg_temp.it66_fails(
 format('select public.crawl_it66_bulk_intake(%L::uuid,repeat(''c'',64)||'':0'',
 ''[{"company_name":"Wrong unsupported role","role":"invented","domain":"it66-unsafe.example"}]''::jsonb,true)',:'synthetic_source_id'),
 'unsupported personal identifiers');
reset role;
select pg_temp.it66_assert((:'before_rights_preview'::jsonb->>'inserted')::int=0 and
 (:'before_rights_preview'::jsonb->>'source_rights_ready')::boolean=false,
 'preview before licence must never write');
select pg_temp.it66_assert((:'preview'::jsonb->>'eligible_new')::int=2
 and (:'preview'::jsonb->>'inserted')::int=0 and
 (:'preview'::jsonb->>'source_rights_ready')::boolean=true,
 'rights-approved preview finds 2 candidate companies, writes zero');
select pg_temp.it66_assert((:'staged'::jsonb->>'inserted')::int=2
 and (:'staged'::jsonb->>'published')::int=0,
 'two corporate roles staged, not published');
select pg_temp.it66_assert((:'replay'::jsonb->>'status')='already_staged'
 and (:'replay'::jsonb->>'inserted')::int=0,
 'same file batch must be idempotent');
select pg_temp.it66_assert(
 (select count(*) from public.network_bulk_intake_rows
 where source_id=:'synthetic_source_id'::uuid and proposed_role in ('trader_distributor','end_user'))=2,
 'trader and end user present in private staging');
select pg_temp.it66_assert(
 (:'audit'::jsonb->>'csv_staged_rows')::int>=2
 and jsonb_array_length(:'stage_rows'::jsonb)>=2,
 'operator sees audit and pending staging queue');
select pg_temp.it66_assert(
 (select count(*) from public.network_companies)=:'companies_before'::int,
 'no new company publication or merge');
rollback;
