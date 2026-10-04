-- PA1.5 — Public Company Data Governance & Legal Gate acceptance.
-- Disposable CI transaction; all fixtures roll back.

begin;

create or replace function pg_temp.pa15_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA1.5 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.pa15_assert_raises(
  statement text,
  expected_fragment text
)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'PA1.5 expected error containing "%", got "%"',
        expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'PA1.5 statement unexpectedly succeeded: %',statement;
end;
$$;

do $owner$
begin
  if not exists (
    select 1
    from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-000000015000'::uuid,
      'pa15-owner@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-000000015000'::uuid,
      'platform_superadmin','active',null,'PA1.5 acceptance fallback owner'
    );
  end if;
end
$owner$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (public.p3_start_company_discovery_batch(
  'IT',
  '["https://pa15-governance.example.test/"]'::jsonb,
  'manual_url',
  'https://pa15-governance.example.test/terms',
  'PA1.5 governance acceptance'
)->>'run_id') as run_id \gset

reset role;

insert into public.network_company_discovery_candidates(
  id,run_id,source_url,canonical_domain,website_url,legal_name,country_code,
  vat_id,description,role_keys,subtype_keys,product_relations,
  evidence,source_urls,match_signals,confidence
)
values(
  '00000000-0000-0000-0000-000000015010'::uuid,
  :'run_id'::uuid,
  'https://pa15-governance.example.test/',
  'pa15-governance.example.test',
  'https://pa15-governance.example.test/',
  'PA15 Governance Tubes S.r.l.',
  'IT',
  '99999015010',
  'Company-only industrial description.',
  array['producer'],
  array['tube_pipe_producer'],
  '[{"key":"tubes_pipes","relationship_type":"produces"}]'::jsonb,
  '[{"url":"https://pa15-governance.example.test/","snippet":"Industrial tube producer"}]'::jsonb,
  '["https://pa15-governance.example.test/"]'::jsonb,
  '[]'::jsonb,
  0.9500
);

-- Existing discovery review is now fail-closed until both governance layers pass.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.pa15_assert_raises(
  $$select public.p3_review_company_discovery(
    '00000000-0000-0000-0000-000000015010'::uuid,
    'publish_new',
    null,
    'must be blocked before PA1.5 review'
  )$$,
  'PA1.5 governance gate blocks publication/enrichment'
);

reset role;

select pg_temp.pa15_assert(
  not exists (
    select 1 from public.network_companies
    where legal_name='PA15 Governance Tubes S.r.l.'
  ),
  'blocked discovery publication must roll back company materialization'
);

-- A source cannot be approved if terms/database-rights/personal-data checks
-- are unresolved or restrictive.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.pa15_assert_raises(
  format(
    $$select public.pa1_5_review_discovery_run_governance(
      %L::uuid,'approved','unknown','unknown','legal_review_required','invalid'
    )$$,
    :'run_id'
  ),
  'approved source requires reusable terms'
);

select public.pa1_5_review_discovery_run_governance(
  :'run_id'::uuid,
  'approved',
  'allows_reuse',
  'low_risk',
  'exclude_personal_data',
  'Official/company source reviewed; publication limited to company data.'
) as source_review \gset

select pg_temp.pa15_assert(
  :'source_review'::jsonb->>'governance_status'='approved'
  and (:'source_review'::jsonb->>'publication_source_ready')::boolean,
  'source review must expose an explicit publication-ready decision'
);

-- Personal-data-bearing candidates cannot be cleared as company-data-only.
select pg_temp.pa15_assert_raises(
  $$select public.pa1_5_review_discovery_candidate_governance(
    '00000000-0000-0000-0000-000000015010'::uuid,
    'approved_company_data',
    true,
    array['employee_email'],
    'must fail'
  )$$,
  'candidate with personal data cannot be approved as company-data-only'
);

select public.pa1_5_review_discovery_candidate_governance(
  '00000000-0000-0000-0000-000000015010'::uuid,
  'approved_company_data',
  false,
  '{}'::text[],
  'Legal-entity identity and company-level industrial facts only.'
) as candidate_review \gset

select pg_temp.pa15_assert(
  :'candidate_review'::jsonb->>'governance_status'='approved_company_data'
  and (:'candidate_review'::jsonb->>'publication_candidate_ready')::boolean,
  'company-data-only candidate must become governance-ready'
);

select public.pa1_5_discovery_governance_state(250) as governance_state \gset

select pg_temp.pa15_assert(
  exists (
    select 1
    from jsonb_array_elements(:'governance_state'::jsonb->'candidates') x
    where x->>'candidate_id'='00000000-0000-0000-0000-000000015010'
      and (x->>'publication_gate_ready')::boolean
  ),
  'admin governance read model must expose publication readiness'
);

select public.p3_review_company_discovery(
  '00000000-0000-0000-0000-000000015010'::uuid,
  'publish_new',
  null,
  'PA1.5 governed publication'
) as published \gset

select pg_temp.pa15_assert(
  :'published'::jsonb->>'status'='published',
  'publication must succeed only after source and candidate governance approval'
);

reset role;

select pg_temp.pa15_assert(
  exists (
    select 1
    from public.network_data_governance_events
    where subject_type='discovery_run'
      and subject_id=:'run_id'::uuid
      and action='source_governance_reviewed'
  )
  and exists (
    select 1
    from public.network_data_governance_events
    where subject_type='discovery_candidate'
      and subject_id='00000000-0000-0000-0000-000000015010'::uuid
      and action='candidate_governance_reviewed'
  ),
  'source and candidate decisions must be recorded in immutable governance audit'
);

-- Public correction/removal/privacy channel is available without exposing its
-- internal queue or the paid Network graph.
set local role anon;
select set_config('request.jwt.claim.role','anon',true);

select public.pa1_5_submit_company_data_request(
  'correction',
  'PA15 Governance Tubes S.r.l.',
  'IT',
  'governance-requester@example.test',
  'https://pa15-governance.example.test/',
  'Please correct the public legal identity source reference.'
) as intake \gset

select pg_temp.pa15_assert(
  :'intake'::jsonb->>'status'='received'
  and :'intake'::jsonb->>'request_id' is not null,
  'anonymous correction request must be accepted through the minimal intake RPC'
);

select pg_temp.pa15_assert(
  not has_table_privilege(
    'anon','public.company_data_governance_requests','SELECT'
  )
  and not has_table_privilege(
    'anon','public.network_data_governance_events','SELECT'
  )
  and not has_table_privilege(
    'anon','public.network_companies','SELECT'
  ),
  'public intake must not expose governance queues or paid Network tables'
);

select pg_temp.pa15_assert(
  (public.pa1_5_company_data_policy()->>'network_public')::boolean=false,
  'PA1.5 policy must explicitly preserve the private Network boundary'
);

reset role;

rollback;
