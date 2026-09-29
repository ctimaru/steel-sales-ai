-- P5.6A — Pilot Cohort & Activation acceptance.
-- Disposable CI transaction. All fixtures roll back.

begin;

create or replace function pg_temp.p56a_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.6A assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p56a_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P5.6A expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P5.6A statement unexpectedly succeeded: %',statement;
end;
$$;

do $p56a_bootstrap$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values(
      '00000000-0000-0000-0000-0000000056f0'::uuid,
      'p56a-superadmin@example.test',
      now()
    )
    on conflict(id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values(
      '00000000-0000-0000-0000-0000000056f0'::uuid,
      'platform_superadmin','active',null,'P5.6A acceptance fallback'
    );
  end if;
end;
$p56a_bootstrap$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005601'::uuid,'p56a-buyer@example.test',now()),
  ('00000000-0000-0000-0000-000000005602'::uuid,'p56a-supplier@example.test',now()),
  ('00000000-0000-0000-0000-000000005603'::uuid,'p56a-blocked@example.test',now());

insert into public.organizations(
  id,name,slug,created_by,country_code,industry,onboarding_status,onboarding_completed_at
) values
  (
    '00000000-0000-0000-0000-000000005610'::uuid,
    'P5.6A Buyer','p56a-buyer',
    '00000000-0000-0000-0000-000000005601'::uuid,
    'IT','steel','completed',now()
  ),
  (
    '00000000-0000-0000-0000-000000005611'::uuid,
    'P5.6A Supplier','p56a-supplier',
    '00000000-0000-0000-0000-000000005602'::uuid,
    'DE','steel','completed',now()
  ),
  (
    '00000000-0000-0000-0000-000000005612'::uuid,
    'P5.6A Blocked','p56a-blocked',
    '00000000-0000-0000-0000-000000005603'::uuid,
    'FR','steel','completed',now()
  );

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values
  ('00000000-0000-0000-0000-000000005610'::uuid,'00000000-0000-0000-0000-000000005601'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005611'::uuid,'00000000-0000-0000-0000-000000005602'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005612'::uuid,'00000000-0000-0000-0000-000000005603'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005610'::uuid,:'superadmin_id'::uuid,'admin','active',false),
  ('00000000-0000-0000-0000-000000005611'::uuid,:'superadmin_id'::uuid,'admin','active',false);

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values
  (
    '00000000-0000-0000-0000-000000005620'::uuid,
    'P5.6A Buyer Srl','P5.6A Buyer',
    'IT','https://p56a-buyer.example.test','p56a-buyer.example.test',
    'Buyer pilot fixture','published','unclaimed','unverified'
  ),
  (
    '00000000-0000-0000-0000-000000005621'::uuid,
    'P5.6A Supplier GmbH','P5.6A Supplier',
    'DE','https://p56a-supplier.example.test','p56a-supplier.example.test',
    'Supplier pilot fixture','published','unclaimed','unverified'
  );

-- Establish valid Organization ↔ Network Company linkage through the governed claim workflow.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-000000005620'::uuid,
    '00000000-0000-0000-0000-000000005610'::uuid,
    'P5.6A buyer pilot claim'
  )->>'claim_id'
) as buyer_claim_id \gset
select public.p3_6_review_claim_proof(
  :'buyer_claim_id'::uuid,'verified','P5.6A buyer proof'
);
select public.m4_review_company_claim(
  :'buyer_claim_id'::uuid,'approved','P5.6A buyer approval'
);

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-000000005621'::uuid,
    '00000000-0000-0000-0000-000000005611'::uuid,
    'P5.6A supplier pilot claim'
  )->>'claim_id'
) as supplier_claim_id \gset
select public.p3_6_review_claim_proof(
  :'supplier_claim_id'::uuid,'verified','P5.6A supplier proof'
);
select public.m4_review_company_claim(
  :'supplier_claim_id'::uuid,'approved','P5.6A supplier approval'
);

reset role;

select id as product_family_id
from public.network_product_families
where canonical_key='tubes_pipes'
limit 1 \gset

select id as standard_id
from public.steel_standards
where status='active'
order by code
limit 1 \gset

insert into public.network_data_assertions(
  id,entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,asserted_by,confidence,review_state
) values
  (
    '00000000-0000-0000-0000-000000005640'::uuid,
    'company_product','00000000-0000-0000-0000-000000005650'::uuid,
    'product_relationship',
    jsonb_build_object('product_family_key','tubes_pipes','relationship_type','produces'),
    'platform_curated','acceptance:p5.6a:product','platform_curated',
    :'superadmin_id'::uuid,1,'accepted'
  ),
  (
    '00000000-0000-0000-0000-000000005641'::uuid,
    'company_product','00000000-0000-0000-0000-000000005650'::uuid,
    'technical_scope.standard',
    jsonb_build_object('standard_id',:'standard_id'),
    'platform_curated','acceptance:p5.6a:standard','platform_curated',
    :'superadmin_id'::uuid,1,'accepted'
  );

insert into public.network_company_products(
  id,company_id,product_family_id,relationship_type,source_assertion_id
) values(
  '00000000-0000-0000-0000-000000005650'::uuid,
  '00000000-0000-0000-0000-000000005621'::uuid,
  :'product_family_id'::uuid,
  'produces',
  '00000000-0000-0000-0000-000000005640'::uuid
);

insert into public.network_company_product_standard_scopes(
  id,company_product_id,standard_id,source_assertion_id,verification_status
) values(
  '00000000-0000-0000-0000-000000005651'::uuid,
  '00000000-0000-0000-0000-000000005650'::uuid,
  :'standard_id'::uuid,
  '00000000-0000-0000-0000-000000005641'::uuid,
  'unverified'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_6a_start_pilot(
  'P5.6A Acceptance Pilot',
  now()+interval '60 days'
) as start_payload \gset

select pg_temp.p56a_assert(
  :'start_payload'::jsonb->>'status'='active'
  and :'start_payload'::jsonb->>'protocol_version'='P5.6-v1',
  'Platform Owner must be able to start the controlled pilot'
);

select public.p5_6a_start_pilot(
  'Ignored duplicate kickoff',
  now()+interval '30 days'
) as start_again \gset

select pg_temp.p56a_assert(
  (:'start_again'::jsonb->>'idempotent')::boolean=true
  and :'start_again'::jsonb->>'id'=:'start_payload'::jsonb->>'id',
  'pilot kickoff must be idempotent while an active run exists'
);

select public.p5_6a_upsert_participant(
  '00000000-0000-0000-0000-000000005610'::uuid,'buyer'
) as buyer_candidate \gset

select public.p5_6a_upsert_participant(
  '00000000-0000-0000-0000-000000005611'::uuid,'supplier'
) as supplier_candidate \gset

select public.p5_6a_upsert_participant(
  '00000000-0000-0000-0000-000000005612'::uuid,'supplier'
) as blocked_candidate \gset

select pg_temp.p56a_assert(
  (:'buyer_candidate'::jsonb->'readiness'->>'ready')::boolean=true,
  'linked claimed published buyer must be ready'
);

select pg_temp.p56a_assert(
  (:'supplier_candidate'::jsonb->'readiness'->>'ready')::boolean=true
  and (:'supplier_candidate'::jsonb->'readiness'->>'supplier_product_relationships')::int=1
  and (:'supplier_candidate'::jsonb->'readiness'->>'technical_scope_products')::int=1,
  'supplier must require matching-ready product and technical scope'
);

select pg_temp.p56a_assert(
  (:'blocked_candidate'::jsonb->'readiness'->>'ready')::boolean=false
  and :'blocked_candidate'::jsonb->'readiness'->'blockers' ? 'network_company_link_required',
  'candidate admission must preserve readiness blockers instead of fabricating activation'
);

select public.p5_6a_transition_participant(
  (:'buyer_candidate'::jsonb->>'participant_id')::uuid,'activate'
) as buyer_active \gset

select public.p5_6a_transition_participant(
  (:'supplier_candidate'::jsonb->>'participant_id')::uuid,'activate'
) as supplier_active \gset

select pg_temp.p56a_assert(
  :'buyer_active'::jsonb->>'status'='active'
  and :'supplier_active'::jsonb->>'status'='active',
  'ready buyer and supplier must activate'
);

-- Inspect protected ledgers only from the privileged SQL harness.
reset role;

select pg_temp.p56a_assert(
  exists(
    select 1
    from public.marketplace_entitlement_events e
    where e.supplier_organization_id='00000000-0000-0000-0000-000000005611'::uuid
      and e.entitlement_key='marketplace_access'
      and e.event_type='granted'
      and e.source_kind='pilot'
      and e.source_reference like 'P5.6A:%'
  ),
  'supplier activation must grant only the existing P5.3 pilot marketplace_access entitlement'
);

select pg_temp.p56a_assert(
  not exists(
    select 1
    from public.marketplace_unlocks u
    where u.supplier_organization_id='00000000-0000-0000-0000-000000005611'::uuid
  ),
  'cohort activation must never create an opportunity unlock'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p56a_assert_raises(
  format(
    'select public.p5_6a_transition_participant(%L::uuid,%L)',
    :'blocked_candidate'::jsonb->>'participant_id','activate'
  ),
  'Pilot participant not ready'
);

select pg_temp.p56a_assert_raises(
  format(
    'select public.p5_6a_upsert_participant(%L::uuid,%L)',
    '00000000-0000-0000-0000-000000005611','buyer'
  ),
  'Pause active participant'
);

select public.p5_6a_pilot_control() as control_payload \gset

select pg_temp.p56a_assert(
  (:'control_payload'::jsonb->'counts'->>'active')::int=2
  and (:'control_payload'::jsonb->'counts'->>'buyers')::int=1
  and (:'control_payload'::jsonb->'counts'->>'suppliers')::int=1
  and jsonb_array_length(:'control_payload'::jsonb->'participants')=3,
  'Platform Owner control plane must expose cohort counts without tenant Commercial Memory'
);

select public.p5_6a_transition_participant(
  (:'supplier_candidate'::jsonb->>'participant_id')::uuid,'pause'
) as supplier_paused \gset

reset role;

select pg_temp.p56a_assert(
  :'supplier_paused'::jsonb->>'status'='paused'
  and exists(
    select 1
    from public.marketplace_entitlement_events e
    where e.supplier_organization_id='00000000-0000-0000-0000-000000005611'::uuid
      and e.entitlement_key='marketplace_access'
      and e.event_type='revoked'
      and e.source_kind='pilot'
      and e.source_reference like 'P5.6A:%'
  ),
  'pausing an active supplier must revoke the pilot marketplace_access entitlement'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_6a_transition_participant(
  (:'supplier_candidate'::jsonb->>'participant_id')::uuid,'resume'
) as supplier_resumed \gset

select pg_temp.p56a_assert(
  :'supplier_resumed'::jsonb->>'status'='active'
  and (:'supplier_resumed'::jsonb->>'activation_cycle')::int=2,
  'resume must revalidate readiness and use a new entitlement cycle'
);

reset role;

select pg_temp.p56a_assert(
  (
    select array_agg(event_type order by event_sequence)
    from public.marketplace_pilot_participant_events
    where participant_id=(:'supplier_candidate'::jsonb->>'participant_id')::uuid
  ) = array['candidate_added','activated','paused','resumed']::text[],
  'participant event ledger must preserve deterministic lifecycle order'
);

select pg_temp.p56a_assert_raises(
  format(
    'update public.marketplace_pilot_participant_events set metadata=%L::jsonb where participant_id=%L::uuid',
    '{"tampered":true}',
    :'supplier_candidate'::jsonb->>'participant_id'
  ),
  'append-only'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005601',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p56a_assert_raises(
  'select public.p5_6a_pilot_control()',
  'Platform Owner authority required'
);

select pg_temp.p56a_assert_raises(
  format(
    'select public.p5_6a_upsert_participant(%L::uuid,%L)',
    '00000000-0000-0000-0000-000000005610','buyer'
  ),
  'Platform Owner authority required'
);

reset role;

select pg_temp.p56a_assert(
  not has_table_privilege('authenticated','public.marketplace_pilot_runs','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_pilot_participants','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_pilot_participant_events','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_pilot_participants','UPDATE'),
  'P5.6A tables must remain RPC-only'
);

rollback;
