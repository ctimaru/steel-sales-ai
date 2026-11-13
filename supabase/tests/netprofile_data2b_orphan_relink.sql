-- NET-PROFILE-DATA2.B — isolation, ambiguity and idempotence acceptance.
-- Runs in the disposable P0 Supabase local database and rolls back fixtures.
begin;
create or replace function pg_temp.data2b_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'NET-PROFILE-DATA2.B %', message;
  end if;
end $$;

select pg_temp.data2b_assert(
  (select relrowsecurity from pg_class
   where oid = 'private.netprofile_data2_relink_audit'::regclass),
  'private audit requires RLS');
select pg_temp.data2b_assert(
  not has_table_privilege('anon','private.netprofile_data2_relink_audit','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_data2_relink_audit','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_data2_relink_audit','INSERT'),
  'audit is never browser-readable/writeable');
select pg_temp.data2b_assert(
  not has_function_privilege('anon',
    'public.netprofile_data2_relink_orphans(integer,boolean,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated',
    'public.netprofile_data2_relink_orphans(integer,boolean,uuid)', 'EXECUTE')
  and has_function_privilege('service_role',
    'public.netprofile_data2_relink_orphans(integer,boolean,uuid)', 'EXECUTE'),
  'relink RPC restricted to service role');
select pg_temp.data2b_assert(
  exists(select 1 from pg_trigger
    where tgrelid='private.netprofile_data2_relink_audit'::regclass
      and tgname='netprofile_data2_relink_immutable' and not tgisinternal),
  'provenance audit append-only');

set local role authenticated;
do $neg$
begin
  begin
    perform public.netprofile_data2_relink_orphans(5,true,null);
    raise exception 'Browser must not invoke re-link';
  exception when sqlstate '42501' then null;
  end;
end $neg$;
reset role;

insert into public.network_companies(
 id,legal_name,country_code,website_url,website_domain,
 publication_status,claimed_status,verification_status
) values (
 '00000000-0000-0000-0000-000000903001'::uuid,
 'DATA2B Demo Acciai S.p.A.','IT',
 'https://data2b-firstparty.example.test/','data2b-firstparty.example.test',
 'published','unclaimed','unverified'
);

insert into private.network_company_enrichment(
 id,discovered_record_id,field_key,field_value,evidence_url,
 evidence_excerpt,extractor_version,review_status,fetched_at
) values (
 '00000000-0000-0000-0000-000000903002'::uuid,
 '00000000-0000-0000-0000-000000903003'::uuid,
 'products','["Tubi strutturali saldati"]'::jsonb,
 'https://data2b-firstparty.example.test/prodotti',
 'Tubi strutturali saldati','ci-local-test','candidate',now()
);

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select pg_temp.data2b_assert(
  (public.netprofile_data2_relink_orphans(
    5,false,'00000000-0000-0000-0000-000000903002'::uuid)->>'count')='1',
  'dry-run locates eligible orphan');
do $bounded$
begin
  begin
    perform public.netprofile_data2_relink_orphans(
      51,true,'00000000-0000-0000-0000-000000903002'::uuid);
    raise exception 'Batch size above 50 must be refused';
  exception when sqlstate '22023' then null;
  end;
end $bounded$;
reset role;
select pg_temp.data2b_assert(
  (select canonical_company_id is null and
     discovered_record_id is not null and review_status='candidate'
   from private.network_company_enrichment
   where id='00000000-0000-0000-0000-000000903002'::uuid),
  'dry-run causes no changes');

-- Ambiguous official-domain ownership must fail closed.
savepoint ambiguous_company;
insert into public.network_companies(
 id,legal_name,country_code,website_url,website_domain,
 publication_status,claimed_status,verification_status
) values (
 '00000000-0000-0000-0000-000000903004'::uuid,
 'Other Demo Acciai S.r.l.','IT',
 'https://data2b-firstparty.example.test/','data2b-firstparty.example.test',
 'published','unclaimed','unverified'
);
set local role service_role;
select pg_temp.data2b_assert(
  (public.netprofile_data2_relink_orphans(
    5,false,'00000000-0000-0000-0000-000000903002'::uuid)->>'count')='0',
  'multiple canonical companies with one domain must block');
reset role;
rollback to savepoint ambiguous_company;

set local role service_role;
select pg_temp.data2b_assert(
  (public.netprofile_data2_relink_orphans(
    5,true,'00000000-0000-0000-0000-000000903002'::uuid)->>'count')='1',
  'privileged explicit apply relinks private candidate');
select pg_temp.data2b_assert(
  (public.netprofile_data2_relink_orphans(
    5,true,'00000000-0000-0000-0000-000000903002'::uuid)->>'count')='0',
  'repeated apply is idempotent');
reset role;

select pg_temp.data2b_assert(
  (select canonical_company_id='00000000-0000-0000-0000-000000903001'::uuid
      and discovered_record_id is null and review_status='candidate'
   from private.network_company_enrichment
   where id='00000000-0000-0000-0000-000000903002'::uuid),
  'relink changes only private association, not fact approval');
select pg_temp.data2b_assert(
  (select count(*)=1
   from private.netprofile_data2_relink_audit
   where evidence_id='00000000-0000-0000-0000-000000903002'::uuid
     and original_discovered_record_id='00000000-0000-0000-0000-000000903003'::uuid),
  'original evidence identifier preserved in private append-only audit');
select pg_temp.data2b_assert(
  (select claimed_status='unclaimed' and verification_status='unverified'
    and publication_status='published'
   from public.network_companies
   where id='00000000-0000-0000-0000-000000903001'::uuid),
  'claim and verification status untouched');
rollback;
