-- CRAWL-IT6.5a: ephemeral postgres acceptance, all writes rolled back.
begin;

create or replace function pg_temp.it65a_assert(ok boolean, msg text)
returns void language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'CRAWL-IT6.5a: %',msg; end if;
end $$;
create or replace function pg_temp.it65a_raises(stmt text, fragment text)
returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then
  if position(lower(fragment) in lower(sqlerrm)) > 0 then return; end if;
  raise exception 'CRAWL-IT6.5a: unexpected error: %',sqlerrm;
 end;
 raise exception 'CRAWL-IT6.5a: operation unexpectedly succeeded: %',stmt;
end $$;

select pg_temp.it65a_assert(
 not has_function_privilege('anon','public.crawl_it65a_bulk_approve_candidates(uuid[],text,boolean)','EXECUTE'),
 'anonymous callers must not execute the bulk endpoint'
);
select pg_temp.it65a_assert(
 not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='crawl_it65a_bulk_approve_candidates' and p.prosecdef),
 'public facade must be security invoker'
);

do $owner$
begin
 if not exists(select 1 from public.platform_user_roles where role='platform_superadmin' and status='active') then
  insert into auth.users(id,email,email_confirmed_at)
  values ('00000000-0000-0000-0000-000000065000'::uuid,'it65a-owner@example.test',now())
  on conflict(id) do nothing;
  insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
  values ('00000000-0000-0000-0000-000000065000'::uuid,'platform_superadmin','active',null,'IT65a synthetic owner');
 end if;
end $owner$;
select user_id as owner_id from public.platform_user_roles
where role='platform_superadmin' and status='active' limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
select (public.p3_start_company_discovery_batch(
 'IT','["https://it65a-approved.example.test/"]'::jsonb,
 'manual_url','https://it65a-approved.example.test/terms',
 'IT65a synthetic approved run'
)->>'run_id') as approved_run \gset
select (public.p3_start_company_discovery_batch(
 'IT','["https://it65a-unreviewed.example.test/"]'::jsonb,
 'manual_url','https://it65a-unreviewed.example.test/terms',
 'IT65a synthetic unreviewed run'
)->>'run_id') as unreviewed_run \gset
select public.pa1_5_review_discovery_run_governance(
 :'approved_run'::uuid,'approved','allows_reuse','low_risk','company_data_only',
 'Verified synthetic company-only reuse rights and permission evidence.'
);
reset role;

insert into public.network_company_discovery_candidates(
 id,run_id,source_url,canonical_domain,website_url,legal_name,country_code,
 vat_id,description,role_keys,subtype_keys,product_relations,
 evidence,source_urls,match_signals,confidence
)
select
 ('00000000-0000-0000-0000-000000065' || lpad(i::text,3,'0'))::uuid,
 case when i=5 then :'unreviewed_run'::uuid else :'approved_run'::uuid end,
 'https://it65a-approved.example.test/'||i,
 'it65a-'||i||'.example.test',
 'https://it65a-'||i||'.example.test/',
 'IT65a Tubes Test '||i||' S.r.l.','IT',
 'IT65A' || i, 'Synthetic industrial company evidence only',
 array['producer'], array['tube_pipe_producer'], '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
 jsonb_build_array(jsonb_build_object('url','https://it65a-approved.example.test/evidence/'||i,'snippet','Synthetic company-only evidence')),
 jsonb_build_array('https://it65a-approved.example.test/'||i),
 case when i=3 then '["possible_match"]'::jsonb else '[]'::jsonb end,
 0.95
from generate_series(1,5) i;

update public.network_company_discovery_candidates
set personal_data_detected=true,personal_data_fields=array['contact_email']
where id='00000000-0000-0000-0000-000000065004'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.it65a_raises(
 $$select public.crawl_it65a_bulk_approve_candidates(
  array['00000000-0000-0000-0000-000000065001'::uuid],
  'Human verified legal-entity only evidence',false)$$,
 'confirmation required'
);
select pg_temp.it65a_raises(
 $$select public.crawl_it65a_bulk_approve_candidates(
  array['00000000-0000-0000-0000-000000065001'::uuid,
        '00000000-0000-0000-0000-000000065001'::uuid],
  'Human verified legal-entity only evidence',true)$$,
 'duplicate candidate'
);
select pg_temp.it65a_raises(
 $$select public.crawl_it65a_bulk_approve_candidates(
  array_fill('00000000-0000-0000-0000-000000065001'::uuid,array[51]),
  'Human verified legal-entity only evidence',true)$$,
 '1-50 candidate'
);

select public.crawl_it65a_bulk_approve_candidates(
 array[
  '00000000-0000-0000-0000-000000065001'::uuid,
  '00000000-0000-0000-0000-000000065002'::uuid,
  '00000000-0000-0000-0000-000000065003'::uuid,
  '00000000-0000-0000-0000-000000065004'::uuid,
  '00000000-0000-0000-0000-000000065005'::uuid
 ],
 'Operator manually checked company evidence and legally approved source',true
) as bulk_result \gset
reset role;

select pg_temp.it65a_assert(
 (:'bulk_result'::jsonb->>'requested_count')::int=5
 and (:'bulk_result'::jsonb->>'approved_count')::int=2
 and (:'bulk_result'::jsonb->>'excluded_count')::int=3
 and (:'bulk_result'::jsonb->>'network_publications')::int=0,
 'two approved and three excluded, with zero publications'
);
select pg_temp.it65a_assert(
 (select count(*) from public.network_company_discovery_candidates
  where id in ('00000000-0000-0000-0000-000000065001'::uuid,'00000000-0000-0000-0000-000000065002'::uuid)
    and governance_status='approved_company_data' and review_status='pending_review')=2,
 'eligible candidates remain unpublished and hold only PA1.5 governance approval'
);
select pg_temp.it65a_assert(
 (select count(*) from public.network_company_discovery_candidates
   where id in ('00000000-0000-0000-0000-000000065003'::uuid,
                '00000000-0000-0000-0000-000000065004'::uuid,
                '00000000-0000-0000-0000-000000065005'::uuid)
     and governance_status='unreviewed')=3,
 'identity, personal-data and source exceptions remain unreviewed'
);
select pg_temp.it65a_assert(
 (select count(*) from public.network_data_governance_events
  where subject_type='discovery_candidate' and action='candidate_governance_reviewed'
   and subject_id in ('00000000-0000-0000-0000-000000065001'::uuid,
                      '00000000-0000-0000-0000-000000065002'::uuid))=2,
 'each success must create one immutable PA1.5 governance event'
);
select pg_temp.it65a_assert(
 exists(select 1 from jsonb_array_elements(:'bulk_result'::jsonb->'excluded') x
  where x->>'reason'='identity_match_requires_individual_review')
 and exists(select 1 from jsonb_array_elements(:'bulk_result'::jsonb->'excluded') x
  where x->>'reason'='personal_data_requires_individual_review')
 and exists(select 1 from jsonb_array_elements(:'bulk_result'::jsonb->'excluded') x
  where x->>'reason'='source_rights_not_approved'),
 'excluded candidates receive actionable reason codes'
);
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.crawl_it65a_bulk_approve_candidates(
 array['00000000-0000-0000-0000-000000065001'::uuid],
 'Operator confirmed company-only evidence for replay',true
) as replay_result \gset
reset role;
select pg_temp.it65a_assert(
 (:'replay_result'::jsonb->>'approved_count')::int=0
 and (:'replay_result'::jsonb->>'excluded_count')::int=1
 and (select count(*) from public.network_data_governance_events
  where subject_id='00000000-0000-0000-0000-000000065001'::uuid)=1,
 'replay must be idempotently excluded and cannot duplicate immutable audit'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000065099',true);
select pg_temp.it65a_raises(
 $$select public.crawl_it65a_bulk_approve_candidates(
  array['00000000-0000-0000-0000-000000065005'::uuid],
  'Unauthorized user attempt to authorize company evidence',true)$$,
 'Platform permission required'
);
reset role;
rollback;
