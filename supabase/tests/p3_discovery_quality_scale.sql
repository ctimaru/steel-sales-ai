-- P3.3 — Discovery Quality Hardening & Italy Scale-Up acceptance.
begin;

create or replace function pg_temp.p33_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.3 assertion failed: %',message;
  end if;
end;
$$;

do $p33$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email)
    values ('00000000-0000-0000-0000-0000000033a1','p33-superadmin@example.com')
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-0000000033a1',
      'platform_superadmin','active',null,
      'P3.3 acceptance fallback superadmin'
    );
  end if;
end;
$p33$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select public.p3_start_company_discovery_batch(
  'IT',
  '["https://p33-one.example/","https://p33-two.example/"]'::jsonb,
  'web_search_curated',
  'P3.3 acceptance web discovery source',
  'P3.3 acceptance batch'
) as batch_result \gset

select pg_temp.p33_assert(
  :'batch_result'::jsonb->>'status'='queued'
  and :'batch_result'::jsonb->>'source_type'='web_search_curated'
  and :'batch_result'::jsonb->>'extraction_version'='p3.3-v2',
  'labelled source batch must preserve source type and extraction version'
);

select (:'batch_result'::jsonb->>'run_id') as run_id \gset
reset role;

update public.network_company_discovery_runs
set
  status='completed',
  candidate_count=2,
  skipped_count=0,
  error_count=0,
  exact_match_count=1,
  started_at=now(),
  completed_at=now(),
  stats='{"seed_count":2,"candidate_count":2,"exact_match_count":1}'::jsonb
where id=:'run_id'::uuid;

insert into public.network_company_discovery_candidates(
  id,run_id,source_url,canonical_domain,website_url,legal_name,country_code,
  description,role_keys,subtype_keys,product_relations,evidence,source_urls,
  match_company_id,match_signals,confidence,extraction_version,
  identity_quality,classification_scores,quality_flags
)
values
(
  '00000000-0000-0000-0000-0000000033c1',
  :'run_id'::uuid,
  'https://p33-one.example/','p33-one.example','https://p33-one.example/',
  'P33 One Tubes S.r.l.','IT','Producer candidate',
  array['producer'],array['tube_pipe_producer'],
  '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
  '[{"url":"https://p33-one.example/","snippet":"Produttore di tubi"}]'::jsonb,
  '["https://p33-one.example/"]'::jsonb,
  null,'[]'::jsonb,0.91,'p3.3-v2',
  '{"source":"title","score":16,"legal_suffix_present":true}'::jsonb,
  '{"producer":0.92,"trader_distributor":0.0,"processor_service_provider":0.0,"end_user":0.0}'::jsonb,
  '{}'::text[]
),
(
  '00000000-0000-0000-0000-0000000033c2',
  :'run_id'::uuid,
  'https://generaltubi.com/','generaltubi.com','https://generaltubi.com/',
  'Generaltubi S.p.A.','IT','Exact duplicate',
  array['trader_distributor'],array['distributor'],
  '[{"key":"tubes_pipes","relationship_type":"distributes"}]'::jsonb,
  '[{"url":"https://generaltubi.com/","snippet":"Distribuzione tubi"}]'::jsonb,
  '["https://generaltubi.com/"]'::jsonb,
  '51100000-0000-5000-8000-000000000004'::uuid,
  '["website_domain_exact"]'::jsonb,0.98,'p3.3-v2',
  '{"source":"title","score":18,"legal_suffix_present":true}'::jsonb,
  '{"producer":0.0,"trader_distributor":0.9,"processor_service_provider":0.0,"end_user":0.0}'::jsonb,
  array['classification_low_margin']
);

set local role authenticated;

select public.p3_admin_discovery_queue('pending_review',100) as queue_result \gset

select pg_temp.p33_assert(
  (:'queue_result'::jsonb#>>'{quality,exact_identity_matches}')::int=1
  and (:'queue_result'::jsonb#>>'{quality,flagged}')::int=1,
  'queue must expose exact-identity and quality-flag metrics'
);

select public.p3_admin_discovery_runs(10) as runs_result \gset

select pg_temp.p33_assert(
  exists (
    select 1
    from jsonb_array_elements(:'runs_result'::jsonb) r
    where r->>'id'=:'run_id'
      and r->>'source_type'='web_search_curated'
      and (r->>'exact_match_count')::int=1
      and r->>'extraction_version'='p3.3-v2'
  ),
  'run telemetry must preserve provenance and scale metrics'
);

select public.p3_close_exact_discovery_duplicates(
  'P3.3 acceptance bulk exact identity closure'
) as bulk_result \gset

select pg_temp.p33_assert(
  (:'bulk_result'::jsonb->>'closed_count')::int=1
  and (:'bulk_result'::jsonb->>'merge_performed')::boolean=false,
  'bulk review may close exact duplicates but must never merge'
);

select pg_temp.p33_assert(
  (select review_status from public.network_company_discovery_candidates
   where id='00000000-0000-0000-0000-0000000033c2')='duplicate_existing'
  and
  (select review_status from public.network_company_discovery_candidates
   where id='00000000-0000-0000-0000-0000000033c1')='pending_review',
  'bulk exact duplicate closure must leave non-matching candidates untouched'
);

reset role;
rollback;
