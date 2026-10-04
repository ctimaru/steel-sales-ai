-- SA5 — Network Operations Delegation Cutover acceptance.
begin;

create or replace function pg_temp.sa5_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SA5 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.sa5_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SA5 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SA5 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a501'::uuid,'sa5-network-ops@example.com',now()),
  ('00000000-0000-0000-0000-00000000a502'::uuid,'sa5-platform-auditor@example.com',now()),
  ('00000000-0000-0000-0000-00000000a503'::uuid,'sa5-outsider@example.com',now())
on conflict (id) do nothing;

do $root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000a500'::uuid,'sa5-owner@example.com',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000a500'::uuid,
      'platform_superadmin','active',null,'SA5 acceptance fallback owner'
    );
  end if;
end
$root$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.platform_staff(user_id,status,activated_at,updated_at)
values
  ('00000000-0000-0000-0000-00000000a501'::uuid,'active',now(),now()),
  ('00000000-0000-0000-0000-00000000a502'::uuid,'active',now(),now())
on conflict (user_id) do update
set status='active',suspended_at=null,revoked_at=null,updated_at=now();

insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
  ('00000000-0000-0000-0000-00000000a501'::uuid,'network_operations_admin','active',:'owner_id'::uuid,'SA5 acceptance'),
  ('00000000-0000-0000-0000-00000000a502'::uuid,'platform_auditor','active',:'owner_id'::uuid,'SA5 acceptance');

-- Network Operations Admin can enter Company Discovery and receives the complete
-- discovery capability set, but no authority over other operational domains.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a501',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa5_assert(
  public.has_platform_permission('platform.console.access')
  and public.has_platform_permission('discovery.read')
  and public.has_platform_permission('discovery.run')
  and public.has_platform_permission('discovery.review')
  and public.has_platform_permission('discovery.publish')
  and public.has_platform_permission('discovery.enrich')
  and public.has_platform_permission('discovery.close_duplicates')
  and not public.has_platform_permission('discovery.governance_review'),
  'Network Operations Admin must receive the complete Company Discovery capability set'
);

select pg_temp.sa5_assert(
  not public.has_platform_permission('registrations.read')
  and not public.has_platform_permission('claims.read')
  and not public.has_platform_permission('knowledge.read_drafts')
  and not public.has_platform_permission('platform.staff.read'),
  'Network Operations Admin must remain outside Registrations, Claims, Knowledge and staff governance'
);

select public.p3_start_company_discovery_batch(
  'IT',
  '["https://sa5-reject.example/","https://sa5-publish.example/","https://sa5-duplicate.example/","https://sa5-enrich.example/"]'::jsonb,
  'manual_url',
  'SA5 delegated network operations acceptance',
  'SA5 Network Operations'
) as run_payload \gset

select (:'run_payload'::jsonb->>'run_id') as run_id \gset

select pg_temp.sa5_assert(
  :'run_id'::uuid is not null
  and :'run_payload'::jsonb->>'status'='queued',
  'Network Operations Admin must start a discovery run'
);

reset role;

-- Controlled fixtures produced by the worker/staging pipeline.
insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
)
values
(
  '00000000-0000-0000-0000-00000000a5d0'::uuid,
  'SA5 Duplicate Existing S.r.l.','IT',
  'https://sa5-duplicate.example/','sa5-duplicate.example',
  'published','unclaimed','unverified'
),
(
  '00000000-0000-0000-0000-00000000a5e0'::uuid,
  'SA5 Enrichment Existing S.r.l.','IT',
  'https://sa5-enrich.example/','sa5-enrich.example',
  'published','unclaimed','unverified'
);

insert into public.network_company_discovery_candidates(
  id,run_id,source_url,canonical_domain,website_url,legal_name,country_code,
  description,role_keys,subtype_keys,product_relations,evidence,source_urls,
  match_company_id,match_signals,confidence,extraction_version,
  facility_candidates,capability_keys,market_keys,enrichment_quality
)
values
(
  '00000000-0000-0000-0000-00000000a5c1'::uuid,
  :'run_id'::uuid,
  'https://sa5-reject.example/','sa5-reject.example','https://sa5-reject.example/',
  'SA5 Reject Candidate S.r.l.','IT','Delegated review reject fixture.',
  array['producer'],array['tube_pipe_producer'],
  '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
  '[{"url":"https://sa5-reject.example/","snippet":"Tube producer candidate"}]'::jsonb,
  '["https://sa5-reject.example/"]'::jsonb,
  null,'[]'::jsonb,0.82,'sa5-v1',
  '[]'::jsonb,'{}'::text[],'{}'::text[],'{}'::jsonb
),
(
  '00000000-0000-0000-0000-00000000a5c2'::uuid,
  :'run_id'::uuid,
  'https://sa5-publish.example/','sa5-publish.example','https://sa5-publish.example/',
  'SA5 Publish Candidate S.r.l.','IT','Delegated publish fixture.',
  array['producer'],array['tube_pipe_producer'],
  '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
  '[{"url":"https://sa5-publish.example/","snippet":"Steel tube production"}]'::jsonb,
  '["https://sa5-publish.example/"]'::jsonb,
  null,'[]'::jsonb,0.94,'sa5-v1',
  '[]'::jsonb,'{}'::text[],'{}'::text[],'{}'::jsonb
),
(
  '00000000-0000-0000-0000-00000000a5c3'::uuid,
  :'run_id'::uuid,
  'https://sa5-duplicate.example/','sa5-duplicate.example','https://sa5-duplicate.example/',
  'SA5 Duplicate Existing S.r.l.','IT','Exact duplicate without enrichment.',
  array['trader_distributor'],array['distributor'],
  '[{"key":"tubes_pipes","relationship_type":"distributes"}]'::jsonb,
  '[{"url":"https://sa5-duplicate.example/","snippet":"Tube distribution"}]'::jsonb,
  '["https://sa5-duplicate.example/"]'::jsonb,
  '00000000-0000-0000-0000-00000000a5d0'::uuid,
  '["website_domain_exact"]'::jsonb,0.99,'sa5-v1',
  '[]'::jsonb,'{}'::text[],'{}'::text[],'{}'::jsonb
),
(
  '00000000-0000-0000-0000-00000000a5c4'::uuid,
  :'run_id'::uuid,
  'https://sa5-enrich.example/','sa5-enrich.example','https://sa5-enrich.example/',
  'SA5 Enrichment Existing S.r.l.','IT','Exact identity with controlled market enrichment.',
  array['producer'],array['tube_pipe_producer'],
  '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
  '[{"url":"https://sa5-enrich.example/","snippet":"Supplier for automotive market"}]'::jsonb,
  '["https://sa5-enrich.example/"]'::jsonb,
  '00000000-0000-0000-0000-00000000a5e0'::uuid,
  '["website_domain_exact"]'::jsonb,0.97,'sa5-v1',
  '[]'::jsonb,'{}'::text[],array['automotive'],
  '{"market_count":1}'::jsonb
);

update public.network_company_discovery_runs
set status='completed',
    candidate_count=4,
    exact_match_count=2,
    started_at=coalesce(started_at,now()),
    completed_at=now()
where id=:'run_id'::uuid;

-- PA1.5 keeps legal/source governance root-only. The owner clears the source
-- and only the candidates that the delegated operator may materialize/enrich.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.pa1_5_review_discovery_run_governance(
  :'run_id'::uuid,
  'approved',
  'allows_reuse',
  'low_risk',
  'company_data_only',
  'SA5 fixture source cleared by Platform Owner'
);

select public.pa1_5_review_discovery_candidate_governance(
  '00000000-0000-0000-0000-00000000a5c2'::uuid,
  'approved_company_data',
  false,
  '{}'::text[],
  'SA5 delegated publication candidate contains company data only'
);

select public.pa1_5_review_discovery_candidate_governance(
  '00000000-0000-0000-0000-00000000a5c4'::uuid,
  'approved_company_data',
  false,
  '{}'::text[],
  'SA5 delegated enrichment candidate contains company data only'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a501',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p3_admin_discovery_queue('pending_review',100) as queue_payload \gset
select public.p3_admin_discovery_runs(10) as runs_payload \gset
select public.p3_admin_discovery_detail('00000000-0000-0000-0000-00000000a5c1'::uuid) as detail_payload \gset

select pg_temp.sa5_assert(
  (:'queue_payload'::jsonb->>'total')::integer>=4
  and exists (
    select 1 from jsonb_array_elements(:'runs_payload'::jsonb) r
    where r->>'id'=:'run_id'
  )
  and :'detail_payload'::jsonb->'candidate'->>'id'='00000000-0000-0000-0000-00000000a5c1',
  'Network Operations Admin must read queue, run telemetry and candidate detail'
);

select public.p3_review_company_discovery(
  '00000000-0000-0000-0000-00000000a5c1'::uuid,
  'reject',
  null,
  'SA5 delegated rejection'
) as rejected_payload \gset

select pg_temp.sa5_assert(
  :'rejected_payload'::jsonb->>'status'='rejected',
  'discovery.review must allow explicit candidate rejection'
);

select public.p3_review_company_discovery(
  '00000000-0000-0000-0000-00000000a5c2'::uuid,
  'publish_new',
  null,
  'SA5 delegated publication'
) as published_payload \gset

select pg_temp.sa5_assert(
  :'published_payload'::jsonb->>'status'='published'
  and :'published_payload'::jsonb->>'claimed_status'='unclaimed'
  and :'published_payload'::jsonb->>'verification_status'='unverified',
  'discovery.publish must retain unclaimed and unverified publication semantics'
);

select public.p3_close_exact_discovery_duplicates(
  'SA5 delegated exact duplicate closure'
) as close_payload \gset

select pg_temp.sa5_assert(
  (:'close_payload'::jsonb->>'closed_count')::integer=1
  and (:'close_payload'::jsonb->>'merge_performed')::boolean=false,
  'discovery.close_duplicates must close only non-enrichment exact matches without merge'
);

select public.p3_enrich_existing_company_discovery_selected(
  '00000000-0000-0000-0000-00000000a5c4'::uuid,
  '00000000-0000-0000-0000-00000000a5e0'::uuid,
  'SA5 delegated selective enrichment',
  false,
  '{}'::text[],
  array['automotive']
) as enriched_payload \gset

select pg_temp.sa5_assert(
  :'enriched_payload'::jsonb->>'status'='enriched_existing'
  and (:'enriched_payload'::jsonb->>'merge_performed')::boolean=false
  and (:'enriched_payload'::jsonb->>'company_fields_overwritten')::boolean=false,
  'discovery.enrich must remain additive, selective and non-merging'
);

reset role;

select pg_temp.sa5_assert(
  not exists (
    select 1 from public.organization_memberships
    where user_id='00000000-0000-0000-0000-00000000a501'::uuid
  ),
  'Network Operations Admin must not gain tenant membership'
);

select pg_temp.sa5_assert(
  exists (
    select 1 from public.network_company_discovery_candidates
    where id='00000000-0000-0000-0000-00000000a5c3'::uuid
      and review_status='duplicate_existing'
  )
  and exists (
    select 1
    from public.network_company_markets cm
    join public.network_markets m on m.id=cm.market_id
    where cm.company_id='00000000-0000-0000-0000-00000000a5e0'::uuid
      and m.canonical_key='automotive'
  ),
  'delegated duplicate closure and selected market enrichment must persist expected governed results'
);

select pg_temp.sa5_assert(
  exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a501'::uuid
      and permission_key='discovery.run'
      and action='discovery_run_started'
      and entity_id=:'run_id'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a501'::uuid
      and permission_key='discovery.review'
      and action='discovery_candidate_rejected'
      and entity_id='00000000-0000-0000-0000-00000000a5c1'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a501'::uuid
      and permission_key='discovery.publish'
      and action='discovery_candidate_published'
      and entity_id='00000000-0000-0000-0000-00000000a5c2'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a501'::uuid
      and permission_key='discovery.enrich'
      and action='discovery_candidate_enriched'
      and entity_id='00000000-0000-0000-0000-00000000a5c4'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a501'::uuid
      and permission_key='discovery.close_duplicates'
      and action='discovery_exact_duplicates_closed'
  ),
  'delegated Company Discovery mutations must record permission-aware global audit events'
);

-- Platform Auditor keeps read-only visibility over Company Discovery.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a502',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa5_assert(
  public.has_platform_permission('discovery.read')
  and not public.has_platform_permission('discovery.run')
  and not public.has_platform_permission('discovery.review')
  and not public.has_platform_permission('discovery.publish')
  and not public.has_platform_permission('discovery.enrich')
  and not public.has_platform_permission('discovery.close_duplicates'),
  'Platform Auditor must remain read-only for Company Discovery'
);

select pg_temp.sa5_assert(
  jsonb_typeof(public.p3_admin_discovery_queue(null,10)->'items')='array'
  and jsonb_typeof(public.p3_admin_discovery_runs(10))='array',
  'Platform Auditor must read discovery queues and runs'
);

select pg_temp.sa5_assert_raises(
  $$select public.p3_start_company_discovery_batch(
      'IT','["https://sa5-denied.example/"]'::jsonb,
      'manual_url',null,'denied'
    )$$,
  'Platform permission required'
);

select pg_temp.sa5_assert_raises(
  $$select public.p3_review_company_discovery(
      '00000000-0000-0000-0000-00000000a5c4'::uuid,
      'reject',null,null
    )$$,
  'Platform permission required'
);

select pg_temp.sa5_assert_raises(
  $$select public.p3_close_exact_discovery_duplicates('denied')$$,
  'Platform permission required'
);

-- A normal authenticated user cannot read the discovery control plane.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a503',true);

select pg_temp.sa5_assert_raises(
  'select public.p3_admin_discovery_queue(null,10)',
  'Platform permission required'
);

-- Platform Owner retains uninterrupted implicit capability access.
select set_config('request.jwt.claim.sub',:'owner_id',true);
select pg_temp.sa5_assert(
  public.has_platform_permission('discovery.read')
  and public.has_platform_permission('discovery.publish')
  and jsonb_typeof(public.p3_admin_discovery_runs(5))='array',
  'Platform Owner must retain Company Discovery access through the capability model'
);

rollback;
