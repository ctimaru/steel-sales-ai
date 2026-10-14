-- CRAWL-IT6.6c corporate tax ID provenance and RNA unapproved source tests.
begin;
create or replace function pg_temp.it66c_assert(ok boolean, detail text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'CRAWL-IT6.6c: %',detail; end if; end $$;
create or replace function pg_temp.it66c_fails(stmt text, fragment text)
returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then
  if position(lower(fragment) in lower(sqlerrm))>0 then return; end if;
  raise exception 'Unexpected failure: %',sqlerrm;
 end;
 raise exception 'Unsafe action succeeded: %',stmt;
end $$;
select pg_temp.it66c_assert(
 (select count(*) from public.network_discovery_source_registry
  where source_url='https://www.rna.gov.it/open-data/aiuti'
    and governance_status='unreviewed'
    and terms_status='not_checked'
    and enabled_for_discovery=false)=1,
 'RNA source must be proposed, never assumed reviewed');
select pg_temp.it66c_assert(
 not has_table_privilege('authenticated','public.network_bulk_intake_rows','SELECT'),
 'No direct tenant access to corporate tax identifier');
do $$
begin
 if not exists(select 1 from public.platform_user_roles where role='platform_superadmin' and status='active') then
   insert into auth.users(id,email,email_confirmed_at)
   values('00000000-0000-0000-0000-000000066601','it66c-owner@example.test',now())
   on conflict(id) do nothing;
   insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
   values('00000000-0000-0000-0000-000000066601','platform_superadmin','active',null,'Synthetic CRAWL IT66c');
 end if;
end $$;
select user_id as owner_id from public.platform_user_roles where role='platform_superadmin' and status='active' limit 1 \gset
select id as rna_id from public.network_discovery_source_registry
 where source_url='https://www.rna.gov.it/open-data/aiuti' limit 1 \gset
select count(*)::int as published_before from public.network_companies \gset
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.crawl_it66_bulk_intake(
 :'rna_id'::uuid,repeat('1',64)||':0',
 '[{"company_name":"MACCHINE TEST S.R.L.","role":"end_user","corporate_tax_id":"12345678901","source_record_id":"RNA-442-NACE-25.11","evidence_url":"https://www.rna.gov.it/open-data/aiuti"}]'::jsonb,
 false
)::text as read_only_preview \gset
select pg_temp.it66c_fails(
 format('select public.crawl_it66_bulk_intake(%L::uuid, repeat(''2'',64)||'':0'', %L::jsonb,true)',
 :'rna_id',
 '[{"company_name":"MACCHINE TEST S.R.L.","role":"end_user","corporate_tax_id":"12345678901"}]'),
 'source rights must be verified');
reset role;
select pg_temp.it66c_assert((:'read_only_preview'::jsonb->>'source_rights_ready')::boolean=false
 and (:'read_only_preview'::jsonb->>'inserted')::int=0, 'preview writes nothing before owner review');

-- Separate synthetic rights-approved source, NOT real MIMIT data.
insert into public.network_discovery_source_registry(source_name,source_url,source_type)
values('IT66c XML synthetic','https://it66c-fixture.example.test/cc-by','curated_public_source')
returning id as synthetic_id \gset
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.crawl_it2_review_source(
 :'synthetic_id'::uuid,'approved','allows_reuse','low_risk',
 'exclude_personal_data','https://it66c-fixture.example.test/license',
 'Synthetic company-only source license and human-reviewed evidence for CI',false);
select public.crawl_it66_bulk_intake(
 :'synthetic_id'::uuid,repeat('2',64)||':0',
 '[{"company_name":"MACCHINE TEST S.R.L.","role":"end_user","corporate_tax_id":"12345678901","source_record_id":"RNA-442-NACE-25.11","evidence_url":"https://it66c-fixture.example.test/source"}]'::jsonb,
 true
)::text as accepted \gset
select public.crawl_it66_bulk_intake(
 :'synthetic_id'::uuid,repeat('2',64)||':0',
 '[{"company_name":"MACCHINE TEST S.R.L.","role":"end_user","corporate_tax_id":"12345678901","source_record_id":"RNA-442-NACE-25.11"}]'::jsonb,
 true
)::text as replay \gset
reset role;
select pg_temp.it66c_assert((:'accepted'::jsonb->>'inserted')::int=1 and
 (:'accepted'::jsonb->>'published')::int=0, 'one corporate-only row staged, zero publications');
select pg_temp.it66c_assert((:'replay'::jsonb->>'status')='already_staged',
 'same data hash should replay safely');
select pg_temp.it66c_assert((select count(*) from public.network_bulk_intake_rows
 where corporate_tax_id='12345678901' and vat_id is null)=1,
 'legal entity fiscal ID must not be falsely labelled VAT');
select pg_temp.it66c_assert((select count(*) from public.network_companies)=:'published_before'::int,
 'no company published by source staging');
rollback;
