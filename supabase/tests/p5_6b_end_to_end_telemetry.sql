-- P5.6B — End-to-End Telemetry acceptance.
-- Disposable CI transaction. All fixtures roll back.

begin;

create or replace function pg_temp.p56b_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.6B assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p56b_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P5.6B expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P5.6B statement unexpectedly succeeded: %',statement;
end;
$$;

do $bootstrap$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values(
      '00000000-0000-0000-0000-000000005bf0'::uuid,
      'p56b-superadmin@example.test',
      now()
    )
    on conflict(id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values(
      '00000000-0000-0000-0000-000000005bf0'::uuid,
      'platform_superadmin','active',null,'P5.6B acceptance fallback'
    );
  end if;
end;
$bootstrap$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005b01'::uuid,'p56b-buyer@example.test',now()),
  ('00000000-0000-0000-0000-000000005b02'::uuid,'p56b-supplier@example.test',now()),
  ('00000000-0000-0000-0000-000000005b03'::uuid,'p56b-other@example.test',now());

insert into public.organizations(
  id,name,slug,created_by,country_code,industry,onboarding_status,onboarding_completed_at
) values
  (
    '00000000-0000-0000-0000-000000005b10'::uuid,
    'P5.6B Buyer','p56b-buyer',
    '00000000-0000-0000-0000-000000005b01'::uuid,
    'IT','steel','completed',now()
  ),
  (
    '00000000-0000-0000-0000-000000005b11'::uuid,
    'P5.6B Supplier','p56b-supplier',
    '00000000-0000-0000-0000-000000005b02'::uuid,
    'DE','steel','completed',now()
  ),
  (
    '00000000-0000-0000-0000-000000005b12'::uuid,
    'P5.6B Other','p56b-other',
    '00000000-0000-0000-0000-000000005b03'::uuid,
    'FR','steel','completed',now()
  );

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values
  ('00000000-0000-0000-0000-000000005b10'::uuid,'00000000-0000-0000-0000-000000005b01'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005b11'::uuid,'00000000-0000-0000-0000-000000005b02'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005b12'::uuid,'00000000-0000-0000-0000-000000005b03'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005b10'::uuid,:'superadmin_id'::uuid,'admin','active',false),
  ('00000000-0000-0000-0000-000000005b11'::uuid,:'superadmin_id'::uuid,'admin','active',false);

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values
  (
    '00000000-0000-0000-0000-000000005b20'::uuid,
    'P5.6B Buyer Srl','P5.6B Buyer',
    'IT','https://p56b-buyer.example.test','p56b-buyer.example.test',
    'P5.6B buyer fixture','published','unclaimed','unverified'
  ),
  (
    '00000000-0000-0000-0000-000000005b21'::uuid,
    'P5.6B Supplier GmbH','P5.6B Supplier',
    'DE','https://p56b-supplier.example.test','p56b-supplier.example.test',
    'P5.6B supplier fixture','published','unclaimed','unverified'
  );

-- Establish governed Organization ↔ Network Company links.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-000000005b20'::uuid,
    '00000000-0000-0000-0000-000000005b10'::uuid,
    'P5.6B buyer pilot claim'
  )->>'claim_id'
) as buyer_claim_id \gset
select public.p3_6_review_claim_proof(
  :'buyer_claim_id'::uuid,'verified','P5.6B buyer proof'
);
select public.m4_review_company_claim(
  :'buyer_claim_id'::uuid,'approved','P5.6B buyer approval'
);

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-000000005b21'::uuid,
    '00000000-0000-0000-0000-000000005b11'::uuid,
    'P5.6B supplier pilot claim'
  )->>'claim_id'
) as supplier_claim_id \gset
select public.p3_6_review_claim_proof(
  :'supplier_claim_id'::uuid,'verified','P5.6B supplier proof'
);
select public.m4_review_company_claim(
  :'supplier_claim_id'::uuid,'approved','P5.6B supplier approval'
);

-- Create supplier product relation through governed profile APIs.
select (
  public.p3_7b_set_product(
    '00000000-0000-0000-0000-000000005b21'::uuid,
    'tubes_pipes','produces',null,true
  )->>'relation_id'
) as supplier_product_id \gset

reset role;

select
  s.id as standard_id,
  a.material_grade_id
from public.network_product_families pf
join public.network_product_family_steel_mappings map
  on map.network_product_family_id=pf.id
 and map.steel_product_family='round_tube'
join public.steel_standard_product_families spf
  on spf.product_family=map.steel_product_family
join public.steel_standards s
  on s.id=spf.standard_id
 and s.status='active'
join public.steel_standard_grade_applicability a
  on a.standard_id=s.id
 and a.product_family=map.steel_product_family
where pf.canonical_key='tubes_pipes'
order by s.code,a.material_grade_id
limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p3_7e_set_product_standard(
  :'supplier_product_id'::uuid,:'standard_id'::uuid,true
);
select public.p3_7e_set_product_grade(
  :'supplier_product_id'::uuid,:'standard_id'::uuid,:'material_grade_id'::uuid,true
);
select public.p3_7e_upsert_product_dimension(
  :'supplier_product_id'::uuid,'outer_diameter',20,220
);
select public.p3_7e_upsert_product_dimension(
  :'supplier_product_id'::uuid,'wall_thickness',2,20
);

-- Start P5.6 and activate both real-role participants.
select public.p5_6a_start_pilot(
  'P5.6B acceptance pilot',
  now()+interval '60 days'
);

select (
  public.p5_6a_upsert_participant(
    '00000000-0000-0000-0000-000000005b10'::uuid,'buyer'
  )->>'participant_id'
) as buyer_participant_id \gset
select (
  public.p5_6a_upsert_participant(
    '00000000-0000-0000-0000-000000005b11'::uuid,'supplier'
  )->>'participant_id'
) as supplier_participant_id \gset

select public.p5_6a_transition_participant(
  :'buyer_participant_id'::uuid,'activate'
);
select public.p5_6a_transition_participant(
  :'supplier_participant_id'::uuid,'activate'
);

reset role;

-- Buyer publishes a real structured anonymous listing while active.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005b01',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005b10'::uuid,
    'P56B-PRIVATE-TITLE-MUST-NOT-LEAK',
    'anonymous'
  )->>'request_id'
) as request_id \gset

select public.p5_1_add_request_line(
  :'request_id'::uuid,
  jsonb_build_object(
    'product_family_key','tubes_pipes',
    'standard_id',:'standard_id',
    'material_grade_id',:'material_grade_id',
    'manufacturing_process','welded',
    'outer_diameter_mm','100',
    'thickness_mm','5',
    'quantity','25',
    'quantity_unit','t',
    'delivery_country_code','IT',
    'delivery_region','Piemonte',
    'requested_delivery_date',(current_date+30)::text,
    'notes','P56B-PRIVATE-NOTE-MUST-NOT-LEAK'
  )
);

select public.p5_1_publish_request(
  :'request_id'::uuid,
  now()+interval '7 days'
);

reset role;

select id as notification_id
from public.marketplace_notifications
where request_id=:'request_id'::uuid
  and recipient_organization_id='00000000-0000-0000-0000-000000005b11'::uuid
limit 1 \gset

select pg_temp.p56b_assert(
  :'notification_id' is not null,
  'published pilot listing must create a supplier notification'
);

-- Supplier reads notification, opens opportunity, unlocks detail and responds.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005b02',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_5_notification_action(
  '00000000-0000-0000-0000-000000005b11'::uuid,
  :'notification_id'::uuid,
  'read'
);

select public.p5_6b_record_notification_open(
  '00000000-0000-0000-0000-000000005b11'::uuid,
  :'notification_id'::uuid,
  :'request_id'::uuid
) as first_open \gset

select public.p5_6b_record_notification_open(
  '00000000-0000-0000-0000-000000005b11'::uuid,
  :'notification_id'::uuid,
  :'request_id'::uuid
) as second_open \gset

select pg_temp.p56b_assert(
  (:'first_open'::jsonb->>'recorded')::boolean=true
  and (:'first_open'::jsonb->>'idempotent')::boolean=false
  and (:'second_open'::jsonb->>'idempotent')::boolean=true,
  'notification-driven opportunity open must be first-open idempotent'
);

select public.p5_3_marketplace_detail(
  '00000000-0000-0000-0000-000000005b11'::uuid,
  :'request_id'::uuid
);

select (
  public.p5_4_create_response(
    '00000000-0000-0000-0000-000000005b11'::uuid,
    :'request_id'::uuid,
    'interest',
    'P56B-PRIVATE-RESPONSE-MESSAGE-MUST-NOT-LEAK',
    null
  )->>'response_id'
) as response_id \gset

select public.p5_4_submit_response(
  '00000000-0000-0000-0000-000000005b11'::uuid,
  :'response_id'::uuid
);

reset role;

-- Buyer engages with the submitted response.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005b01',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_4_buyer_transition(
  '00000000-0000-0000-0000-000000005b10'::uuid,
  :'response_id'::uuid,
  'acknowledge'
);

reset role;

-- Soft telemetry contains only fixed identifiers/allowlisted metadata.
select pg_temp.p56b_assert(
  (
    select count(*)
    from public.pilot_usage_events
    where organization_id='00000000-0000-0000-0000-000000005b11'::uuid
      and event_name='marketplace_opportunity_opened'
      and entity_type='marketplace_notification'
      and entity_id=:'notification_id'
  )=1,
  'first opportunity open must be recorded exactly once'
);

select pg_temp.p56b_assert(
  (
    select metadata - array['source','surface','format']::text[]
    from public.pilot_usage_events
    where organization_id='00000000-0000-0000-0000-000000005b11'::uuid
      and event_name='marketplace_opportunity_opened'
      and entity_id=:'notification_id'
  )='{}'::jsonb,
  'soft telemetry metadata must remain allowlist-only'
);

-- Platform Owner reads the full funnel.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_6b_pilot_telemetry() as telemetry \gset

select pg_temp.p56b_assert(
  :'telemetry'::jsonb->>'contract'='P5.6B-v1',
  'telemetry contract version must be P5.6B-v1'
);

select pg_temp.p56b_assert(
  (:'telemetry'::jsonb->'funnel'->>'listings_published')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'listings_with_match')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'notifications_created')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'notifications_read')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'opportunities_opened')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'unlocks')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'response_drafts')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'responses_submitted')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'buyer_engaged_responses')::int=1,
  'canonical end-to-end funnel must observe the complete pilot cycle'
);

select pg_temp.p56b_assert(
  (:'telemetry'::jsonb->'funnel'->>'listing_match_rate')::numeric=1
  and (:'telemetry'::jsonb->'funnel'->>'notification_read_rate')::numeric=1
  and (:'telemetry'::jsonb->'funnel'->>'notification_to_open_rate')::numeric=1
  and (:'telemetry'::jsonb->'funnel'->>'open_to_unlock_rate')::numeric=1
  and (:'telemetry'::jsonb->'funnel'->>'unlock_to_submit_rate')::numeric=1
  and (:'telemetry'::jsonb->'funnel'->>'submitted_to_buyer_engagement_rate')::numeric=1,
  'complete acceptance cycle must produce 100% stage conversion'
);

select pg_temp.p56b_assert(
  (:'telemetry'::jsonb->'funnel'->>'distinct_buyer_organizations')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'distinct_supplier_organizations')::int=1
  and (:'telemetry'::jsonb->'funnel'->>'distinct_organizations')::int=2,
  'distinct organization participation must be measured'
);

select pg_temp.p56b_assert(
  (:'telemetry'::jsonb->'latencies'->'listing_to_first_match'->>'samples')::int=1
  and (:'telemetry'::jsonb->'latencies'->'match_to_notification_read'->>'samples')::int=1
  and (:'telemetry'::jsonb->'latencies'->'notification_to_opportunity_open'->>'samples')::int=1
  and (:'telemetry'::jsonb->'latencies'->'opportunity_open_to_unlock'->>'samples')::int=1
  and (:'telemetry'::jsonb->'latencies'->'unlock_to_draft_response'->>'samples')::int=1
  and (:'telemetry'::jsonb->'latencies'->'unlock_to_submitted_response'->>'samples')::int=1
  and (:'telemetry'::jsonb->'latencies'->'submitted_response_to_buyer_engagement'->>'samples')::int=1,
  'all requested time-to-stage metrics must have one canonical sample'
);

select pg_temp.p56b_assert(
  jsonb_array_length(:'telemetry'::jsonb->'participants')=2
  and jsonb_array_length(:'telemetry'::jsonb->'listings')=1,
  'scorecard must expose participant and per-listing diagnostic read models'
);

select pg_temp.p56b_assert(
  position('P56B-PRIVATE-TITLE-MUST-NOT-LEAK' in :'telemetry')=0
  and position('P56B-PRIVATE-NOTE-MUST-NOT-LEAK' in :'telemetry')=0
  and position('P56B-PRIVATE-RESPONSE-MESSAGE-MUST-NOT-LEAK' in :'telemetry')=0,
  'telemetry must not copy Marketplace commercial content'
);

reset role;

-- BOLA: another tenant cannot record a supplier notification open.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005b03',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p56b_assert_raises(
  format(
    'select public.p5_6b_record_notification_open(%L::uuid,%L::uuid,%L::uuid)',
    '00000000-0000-0000-0000-000000005b12',
    :'notification_id',
    :'request_id'
  ),
  'Marketplace notification not found for organization'
);

select pg_temp.p56b_assert_raises(
  'select public.p5_6b_pilot_telemetry()',
  'Platform Owner authority required'
);

reset role;

rollback;
