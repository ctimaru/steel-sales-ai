-- P3.2 — Web Company Discovery Crawler & Review Pipeline acceptance.
begin;

create or replace function pg_temp.p32_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.2 assertion failed: %',message;
  end if;
end;
$$;

do $p32$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email)
    values ('00000000-0000-0000-0000-0000000032a1','p32-superadmin@example.com')
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-0000000032a1',
      'platform_superadmin','active',
      null,
      'P3.2 acceptance fallback superadmin'
    );
  end if;
end;
$p32$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select (public.p3_start_company_discovery(
  'IT',
  '["https://p32-new.example/"]'::jsonb
)->>'run_id') as run_id \gset

select pg_temp.p32_assert(
  :'run_id'::uuid is not null,
  'superadmin must be able to create a queued discovery run'
);

reset role;

set local role service_role;
select public.p3_claim_next_company_discovery() as claim_payload \gset
select pg_temp.p32_assert(
  :'claim_payload'::jsonb->>'run_id'=:'run_id',
  'service-role worker must atomically claim the queued discovery run'
);
reset role;

insert into public.network_company_discovery_candidates(
  id,run_id,source_url,canonical_domain,website_url,legal_name,country_code,
  vat_id,description,role_keys,subtype_keys,product_relations,
  evidence,source_urls,match_signals,confidence
)
values (
  '00000000-0000-0000-0000-0000000032c1',
  :'run_id'::uuid,
  'https://p32-new.example/',
  'p32-new.example',
  'https://p32-new.example/',
  'P32 New Tubes S.r.l.',
  'IT',
  '03203203203',
  'P3.2 acceptance tube producer.',
  array['producer'],
  array['tube_pipe_producer'],
  '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
  '[{"url":"https://p32-new.example/","snippet":"Produzione tubi saldati"}]'::jsonb,
  '["https://p32-new.example/"]'::jsonb,
  '[]'::jsonb,
  0.9200
);

update public.network_company_discovery_runs
set status='completed',candidate_count=1,completed_at=now()
where id=:'run_id'::uuid;

set local role authenticated;

select public.p3_admin_discovery_queue('pending_review',100) as queue_payload \gset
select pg_temp.p32_assert(
  exists (
    select 1 from jsonb_array_elements(:'queue_payload'::jsonb->'items') x
    where x->>'id'='00000000-0000-0000-0000-0000000032c1'
  ),
  'pending crawler candidate must be visible to superadmin review queue'
);

select public.p3_review_company_discovery(
  '00000000-0000-0000-0000-0000000032c1',
  'publish_new',
  null,
  'P3.2 acceptance promotion'
) as promoted \gset

select pg_temp.p32_assert(
  :'promoted'::jsonb->>'status'='published'
  and :'promoted'::jsonb->>'claimed_status'='unclaimed'
  and :'promoted'::jsonb->>'verification_status'='unverified',
  'explicit publish_new must create only an unclaimed, unverified Network profile'
);

select (:'promoted'::jsonb->>'company_id') as promoted_company_id \gset

reset role;

select pg_temp.p32_assert(
  exists (
    select 1 from public.network_companies c
    where c.id=:'promoted_company_id'::uuid
      and c.publication_status='published'
      and c.claimed_status='unclaimed'
      and c.verification_status='unverified'
  ),
  'promoted company must be published without claim or verification'
);

select pg_temp.p32_assert(
  exists (
    select 1
    from public.network_data_assertions a
    where a.entity_type='company'
      and a.entity_id=:'promoted_company_id'::uuid
      and a.field_path='p3_2_discovery_snapshot'
      and a.source_type='public_web'
      and a.review_state='accepted'
  ),
  'promotion must preserve immutable public-web provenance'
);

select pg_temp.p32_assert(
  exists (
    select 1
    from public.network_company_role_assignments ra
    join public.network_company_roles r on r.id=ra.role_id
    where ra.company_id=:'promoted_company_id'::uuid
      and r.canonical_key='producer'
      and ra.is_primary
  )
  and exists (
    select 1
    from public.network_company_products cp
    join public.network_product_families pf on pf.id=cp.product_family_id
    where cp.company_id=:'promoted_company_id'::uuid
      and pf.canonical_key='tubes_pipes'
      and cp.relationship_type='produces'
  ),
  'review promotion must materialize validated role and product relationships'
);

-- A later crawler run that rediscovers the same identity must not silently create a duplicate.
set local role authenticated;
select (public.p3_start_company_discovery(
  'IT',
  '["https://p32-new.example/products"]'::jsonb
)->>'run_id') as duplicate_run_id \gset
reset role;

set local role service_role;
select public.p3_claim_next_company_discovery() as duplicate_claim_payload \gset
select pg_temp.p32_assert(
  :'duplicate_claim_payload'::jsonb->>'run_id'=:'duplicate_run_id',
  'service-role worker must atomically claim the rediscovery run'
);
reset role;

insert into public.network_company_discovery_candidates(
  id,run_id,source_url,canonical_domain,website_url,legal_name,country_code,
  vat_id,description,role_keys,subtype_keys,product_relations,
  evidence,source_urls,match_company_id,match_signals,confidence
)
values (
  '00000000-0000-0000-0000-0000000032c2',
  :'duplicate_run_id'::uuid,
  'https://p32-new.example/products',
  'p32-new.example',
  'https://p32-new.example/',
  'P32 New Tubes S.r.l.',
  'IT',
  '03203203203',
  'Rediscovered candidate.',
  array['producer'],
  array['tube_pipe_producer'],
  '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
  '[{"url":"https://p32-new.example/products","snippet":"Tubi"}]'::jsonb,
  '["https://p32-new.example/products"]'::jsonb,
  :'promoted_company_id'::uuid,
  '["website_domain_exact","country_vat_exact"]'::jsonb,
  0.9800
);

update public.network_company_discovery_runs
set status='completed',candidate_count=1,completed_at=now()
where id=:'duplicate_run_id'::uuid;

set local role authenticated;

do $$
begin
  begin
    perform public.p3_review_company_discovery(
      '00000000-0000-0000-0000-0000000032c2',
      'publish_new',
      null,
      null
    );
    raise exception 'expected duplicate protection failure';
  exception
    when unique_violation then null;
  end;
end;
$$;

select public.p3_review_company_discovery(
  '00000000-0000-0000-0000-0000000032c2',
  'duplicate_existing',
  :'promoted_company_id'::uuid,
  'Same legal identity'
) as duplicate_decision \gset

select pg_temp.p32_assert(
  :'duplicate_decision'::jsonb->>'status'='duplicate_existing'
  and (:'duplicate_decision'::jsonb->>'merge_performed')::boolean=false,
  'duplicate review must record identity evidence without automatic merge'
);

select pg_temp.p32_assert(
  not has_table_privilege('authenticated','public.network_company_discovery_runs','SELECT')
  and not has_table_privilege('authenticated','public.network_company_discovery_candidates','SELECT'),
  'authenticated users must not have raw staging-table access'
);

select pg_temp.p32_assert(
  not has_function_privilege(
    'authenticated',
    'public.p3_claim_next_company_discovery()',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.p3_claim_next_company_discovery()',
    'EXECUTE'
  ),
  'only service_role may claim discovery work from the durable queue'
);

reset role;
rollback;
