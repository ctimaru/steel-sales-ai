-- P5.5 — Matching & Notifications acceptance.
-- Disposable CI transaction. All fixtures roll back.

begin;

create or replace function pg_temp.p55_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.5 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p55_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P5.5 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P5.5 statement unexpectedly succeeded: %',statement;
end;
$$;

-- Ensure a Platform superadmin exists for governed claim setup.
do $p55_bootstrap$
begin
  if not exists (
    select 1
    from public.platform_user_roles
    where role='platform_superadmin'
      and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values(
      '00000000-0000-0000-0000-0000000055f0'::uuid,
      'p55-superadmin@example.test',
      now()
    )
    on conflict(id) do nothing;

    insert into public.platform_user_roles(
      user_id,role,status,granted_by,reason
    )
    values(
      '00000000-0000-0000-0000-0000000055f0'::uuid,
      'platform_superadmin',
      'active',
      null,
      'P5.5 acceptance fallback'
    );
  end if;
end;
$p55_bootstrap$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin'
  and status='active'
limit 1 \gset

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005501'::uuid,'p55-buyer@example.test',now()),
  ('00000000-0000-0000-0000-000000005502'::uuid,'p55-supplier-a@example.test',now()),
  ('00000000-0000-0000-0000-000000005503'::uuid,'p55-supplier-b@example.test',now()),
  ('00000000-0000-0000-0000-000000005504'::uuid,'p55-supplier-c@example.test',now());

insert into public.organizations(
  id,name,slug,created_by,country_code,industry
) values
  (
    '00000000-0000-0000-0000-000000005510'::uuid,
    'P5.5 Buyer',
    'p55-buyer',
    '00000000-0000-0000-0000-000000005501'::uuid,
    'IT','steel'
  ),
  (
    '00000000-0000-0000-0000-000000005511'::uuid,
    'P5.5 Supplier A',
    'p55-supplier-a',
    '00000000-0000-0000-0000-000000005502'::uuid,
    'DE','steel'
  ),
  (
    '00000000-0000-0000-0000-000000005512'::uuid,
    'P5.5 Supplier B',
    'p55-supplier-b',
    '00000000-0000-0000-0000-000000005503'::uuid,
    'AT','steel'
  ),
  (
    '00000000-0000-0000-0000-000000005513'::uuid,
    'P5.5 Supplier C Late Claim',
    'p55-supplier-c',
    '00000000-0000-0000-0000-000000005504'::uuid,
    'FR','steel'
  );

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values
  ('00000000-0000-0000-0000-000000005510'::uuid,'00000000-0000-0000-0000-000000005501'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005511'::uuid,'00000000-0000-0000-0000-000000005502'::uuid,'member','active',true),
  ('00000000-0000-0000-0000-000000005512'::uuid,'00000000-0000-0000-0000-000000005503'::uuid,'member','active',true),
  ('00000000-0000-0000-0000-000000005513'::uuid,'00000000-0000-0000-0000-000000005504'::uuid,'member','active',true),
  ('00000000-0000-0000-0000-000000005511'::uuid,:'superadmin_id'::uuid,'admin','active',false),
  ('00000000-0000-0000-0000-000000005512'::uuid,:'superadmin_id'::uuid,'admin','active',false),
  ('00000000-0000-0000-0000-000000005513'::uuid,:'superadmin_id'::uuid,'admin','active',false);

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values
  (
    '00000000-0000-0000-0000-000000005521'::uuid,
    'P5.5 Exact Supplier GmbH',
    'P5.5 Exact Supplier',
    'DE',
    'https://p55-exact.example.test',
    'p55-exact.example.test',
    'P5.5 exact matching acceptance',
    'published','unclaimed','unverified'
  ),
  (
    '00000000-0000-0000-0000-000000005522'::uuid,
    'P5.5 Mismatch Supplier GmbH',
    'P5.5 Mismatch Supplier',
    'AT',
    'https://p55-mismatch.example.test',
    'p55-mismatch.example.test',
    'P5.5 explicit mismatch acceptance',
    'published','unclaimed','unverified'
  ),
  (
    '00000000-0000-0000-0000-000000005523'::uuid,
    'P5.5 Late Claim Supplier SAS',
    'P5.5 Late Claim Supplier',
    'FR',
    'https://p55-late.example.test',
    'p55-late.example.test',
    'P5.5 late claim notification acceptance',
    'published','unclaimed','unverified'
  );

-- Claim Supplier A and B before publication. Supplier C remains unclaimed.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-000000005521'::uuid,
    '00000000-0000-0000-0000-000000005511'::uuid,
    'P5.5 exact supplier claim'
  )->>'claim_id'
) as claim_a_id \gset
select public.p3_6_review_claim_proof(
  :'claim_a_id'::uuid,'verified','P5.5 exact supplier proof'
);
select public.m4_review_company_claim(
  :'claim_a_id'::uuid,'approved','P5.5 exact supplier approval'
);

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-000000005522'::uuid,
    '00000000-0000-0000-0000-000000005512'::uuid,
    'P5.5 mismatch supplier claim'
  )->>'claim_id'
) as claim_b_id \gset
select public.p3_6_review_claim_proof(
  :'claim_b_id'::uuid,'verified','P5.5 mismatch supplier proof'
);
select public.m4_review_company_claim(
  :'claim_b_id'::uuid,'approved','P5.5 mismatch supplier approval'
);

-- Build matching-ready product relationships.
select (
  public.p3_7b_set_product(
    '00000000-0000-0000-0000-000000005521'::uuid,
    'tubes_pipes','produces',null,true
  )->>'relation_id'
) as product_a_id \gset

select (
  public.p3_7b_set_product(
    '00000000-0000-0000-0000-000000005522'::uuid,
    'tubes_pipes','stocks',null,true
  )->>'relation_id'
) as product_b_id \gset

reset role;

select
  pf.id as product_family_id,
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

-- Supplier A: exact standard/grade/dimensions.
select public.p3_7e_set_product_standard(
  :'product_a_id'::uuid,:'standard_id'::uuid,true
);
select public.p3_7e_set_product_grade(
  :'product_a_id'::uuid,:'standard_id'::uuid,:'material_grade_id'::uuid,true
);
select public.p3_7e_upsert_product_dimension(
  :'product_a_id'::uuid,'outer_diameter',20,220
);
select public.p3_7e_upsert_product_dimension(
  :'product_a_id'::uuid,'wall_thickness',2,20
);

-- Supplier B: same product and knowledge, explicit OD mismatch.
select public.p3_7e_set_product_standard(
  :'product_b_id'::uuid,:'standard_id'::uuid,true
);
select public.p3_7e_set_product_grade(
  :'product_b_id'::uuid,:'standard_id'::uuid,:'material_grade_id'::uuid,true
);
select public.p3_7e_upsert_product_dimension(
  :'product_b_id'::uuid,'outer_diameter',10,50
);
select public.p3_7e_upsert_product_dimension(
  :'product_b_id'::uuid,'wall_thickness',2,20
);

reset role;

update public.network_companies
set verification_status='verified'
where id='00000000-0000-0000-0000-000000005521'::uuid;

-- Supplier C has matching product family but no declared technical scope and no org link yet.
-- Preserve Network provenance invariants even in this disposable fixture.
insert into public.network_data_assertions(
  id,
  entity_type,
  entity_id,
  field_path,
  asserted_value,
  source_type,
  source_reference,
  ownership_type,
  asserted_by,
  confidence,
  review_state
)
values(
  '00000000-0000-0000-0000-000000005531'::uuid,
  'company_product',
  '00000000-0000-0000-0000-000000005530'::uuid,
  'product_relationship',
  jsonb_build_object(
    'product_family_key','tubes_pipes',
    'relationship_type','distributes'
  ),
  'platform_curated',
  'acceptance:p5.5:late-claim-product',
  'platform_curated',
  :'superadmin_id'::uuid,
  1,
  'accepted'
);

insert into public.network_company_products(
  id,company_id,product_family_id,relationship_type,source_assertion_id
)
values(
  '00000000-0000-0000-0000-000000005530'::uuid,
  '00000000-0000-0000-0000-000000005523'::uuid,
  :'product_family_id'::uuid,
  'distributes',
  '00000000-0000-0000-0000-000000005531'::uuid
);

-- Buyer publishes anonymous structured demand. P5.5 matching trigger executes automatically.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005501',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005510'::uuid,
    'P5.5 deterministic matching acceptance',
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
    'notes','P55-PRIVATE-BUYER-NOTE-MUST-NOT-LEAK'
  )
);

select public.p5_1_publish_request(
  :'request_id'::uuid,
  now()+interval '7 days'
);

reset role;

select pg_temp.p55_assert(
  exists(
    select 1
    from public.marketplace_matches m
    where m.request_id=:'request_id'::uuid
      and m.supplier_network_company_id='00000000-0000-0000-0000-000000005521'::uuid
      and m.supplier_organization_id='00000000-0000-0000-0000-000000005511'::uuid
      and m.status='active'
      and m.match_band='strong'
      and m.match_score>=85
  ),
  'exact governed technical scope must create a strong contactable match'
);

select pg_temp.p55_assert(
  not exists(
    select 1
    from public.marketplace_matches m
    where m.request_id=:'request_id'::uuid
      and m.supplier_network_company_id='00000000-0000-0000-0000-000000005522'::uuid
      and m.status='active'
  ),
  'explicit declared dimension mismatch must exclude supplier'
);

select pg_temp.p55_assert(
  exists(
    select 1
    from public.marketplace_matches m
    where m.request_id=:'request_id'::uuid
      and m.supplier_network_company_id='00000000-0000-0000-0000-000000005523'::uuid
      and m.supplier_organization_id is null
      and m.status='active'
      and m.match_band='broad'
  ),
  'unclaimed matching profile must be retained as a non-contactable broad candidate'
);

select id as notification_a_id
from public.marketplace_notifications
where request_id=:'request_id'::uuid
  and recipient_organization_id='00000000-0000-0000-0000-000000005511'::uuid
  and notification_kind='opportunity_match'
\gset

select pg_temp.p55_assert(
  :'notification_a_id' is not null
  and not exists(
    select 1
    from public.marketplace_notifications
    where request_id=:'request_id'::uuid
      and recipient_organization_id='00000000-0000-0000-0000-000000005512'::uuid
  )
  and not exists(
    select 1
    from public.marketplace_notifications
    where request_id=:'request_id'::uuid
      and recipient_organization_id='00000000-0000-0000-0000-000000005513'::uuid
  ),
  'notifications must be created only for active linked eligible supplier organizations'
);

-- Supplier A sees only privacy-safe teaser + explainable reasons.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005502',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_5_my_notifications(
  '00000000-0000-0000-0000-000000005511'::uuid,
  20,
  0
) as inbox_a \gset

select pg_temp.p55_assert(
  (:'inbox_a'::jsonb->>'unread')::int=1
  and :'inbox_a'::jsonb->'items'->0->>'request_id'=:'request_id'
  and :'inbox_a'::jsonb->'items'->0->'match'->>'band'='strong'
  and :'inbox_a'::jsonb->'items'->0->'teaser'->'buyer'->>'visibility_mode'='anonymous'
  and position('P5.5 Buyer' in :'inbox_a')=0
  and position('00000000-0000-0000-0000-000000005510' in :'inbox_a')=0
  and position('P55-PRIVATE-BUYER-NOTE-MUST-NOT-LEAK' in :'inbox_a')=0,
  'supplier inbox must expose explainable matching without anonymous buyer identity or private notes'
);

select public.p5_3_entitlement_state(
  '00000000-0000-0000-0000-000000005511'::uuid,
  :'request_id'::uuid
) as entitlement_a \gset

select public.p5_4_response_rights(
  '00000000-0000-0000-0000-000000005511'::uuid,
  :'request_id'::uuid
) as response_rights_a \gset

select pg_temp.p55_assert(
  :'entitlement_a'::jsonb->>'state'='locked'
  and (:'entitlement_a'::jsonb->>'can_view_locked_detail')::boolean=false
  and :'response_rights_a'::jsonb->>'reason'='entitlement_required'
  and (:'response_rights_a'::jsonb->>'can_create')::boolean=false,
  'P5.5 match notification must never auto-grant unlock or response rights'
);

-- Normal supplier cannot force match recomputation.
select pg_temp.p55_assert_raises(
  format(
    'select public.p5_5_refresh_request_matches(%L::uuid)',
    :'request_id'
  ),
  'Marketplace entitlement authority required'
);

-- Cross-company BOLA on notification action.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005503',true);

select pg_temp.p55_assert_raises(
  format(
    'select public.p5_5_notification_action(%L::uuid,%L::uuid,%L)',
    '00000000-0000-0000-0000-000000005512',
    :'notification_a_id',
    'read'
  ),
  'Marketplace notification not found'
);

-- Owning supplier read + dismiss lifecycle.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005502',true);

select public.p5_5_notification_action(
  '00000000-0000-0000-0000-000000005511'::uuid,
  :'notification_a_id'::uuid,
  'read'
) as read_a \gset

select pg_temp.p55_assert(
  :'read_a'::jsonb->>'status'='read'
  and (:'read_a'::jsonb->>'changed')::boolean=true,
  'supplier must be able to mark its own notification read'
);

select public.p5_5_notification_action(
  '00000000-0000-0000-0000-000000005511'::uuid,
  :'notification_a_id'::uuid,
  'dismiss'
) as dismissed_a \gset

select pg_temp.p55_assert(
  :'dismissed_a'::jsonb->>'status'='dismissed',
  'supplier must be able to dismiss its own notification'
);

select public.p5_5_my_notifications(
  '00000000-0000-0000-0000-000000005511'::uuid,
  20,
  0
) as inbox_after_dismiss \gset

select pg_temp.p55_assert(
  (:'inbox_after_dismiss'::jsonb->>'total')::int=0,
  'dismissed notifications must leave the active supplier inbox'
);

reset role;

select array_agg(event_type order by event_sequence) as notification_a_events
from public.marketplace_notification_events
where notification_id=:'notification_a_id'::uuid
\gset

select pg_temp.p55_assert(
  :'notification_a_events'::text[]=
    array['created','read','dismissed']::text[],
  'notification audit events must preserve deterministic lifecycle order'
);

select pg_temp.p55_assert_raises(
  format(
    'update public.marketplace_notification_events set metadata=%L::jsonb where notification_id=%L::uuid',
    '{"tampered":true}',
    :'notification_a_id'
  ),
  'append-only'
);

-- Buyer sees only aggregate matching health, not supplier identities.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005501',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_5_buyer_match_summary(
  '00000000-0000-0000-0000-000000005510'::uuid,
  :'request_id'::uuid
) as buyer_summary \gset

select pg_temp.p55_assert(
  (:'buyer_summary'::jsonb->>'total_matches')::int>=2
  and (:'buyer_summary'::jsonb->>'contactable_matches')::int>=1
  and (:'buyer_summary'::jsonb->>'notifications_created')::int>=1
  and (:'buyer_summary'::jsonb->'bands'->>'strong')::int>=1
  and position('P5.5 Exact Supplier' in :'buyer_summary')=0,
  'buyer matching summary must stay aggregate-only'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005503',true);

select pg_temp.p55_assert_raises(
  format(
    'select public.p5_5_buyer_match_summary(%L::uuid,%L::uuid)',
    '00000000-0000-0000-0000-000000005512',
    :'request_id'
  ),
  'Marketplace buyer request not found'
);

-- Late claim: existing non-contactable match must become contactable and notify automatically.
select set_config('request.jwt.claim.sub',:'superadmin_id',true);

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-000000005523'::uuid,
    '00000000-0000-0000-0000-000000005513'::uuid,
    'P5.5 late claim handoff'
  )->>'claim_id'
) as claim_c_id \gset
select public.p3_6_review_claim_proof(
  :'claim_c_id'::uuid,'verified','P5.5 late claim proof'
);
select public.m4_review_company_claim(
  :'claim_c_id'::uuid,'approved','P5.5 late claim approval'
);

reset role;

select pg_temp.p55_assert(
  exists(
    select 1
    from public.marketplace_matches
    where request_id=:'request_id'::uuid
      and supplier_network_company_id='00000000-0000-0000-0000-000000005523'::uuid
      and supplier_organization_id='00000000-0000-0000-0000-000000005513'::uuid
      and status='active'
  )
  and exists(
    select 1
    from public.marketplace_notifications
    where request_id=:'request_id'::uuid
      and recipient_organization_id='00000000-0000-0000-0000-000000005513'::uuid
      and status='unread'
  ),
  'claim activation must connect an existing match and materialize an in-app notification'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005504',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_5_my_notifications(
  '00000000-0000-0000-0000-000000005513'::uuid,
  20,
  0
) as inbox_c \gset

select pg_temp.p55_assert(
  (:'inbox_c'::jsonb->>'unread')::int=1
  and :'inbox_c'::jsonb->'items'->0->'match'->>'band'='broad',
  'late-claimed supplier must receive the pre-existing broad match notification'
);

reset role;

-- RPC-only data boundary.
select pg_temp.p55_assert(
  not has_table_privilege('authenticated','public.marketplace_matches','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_notifications','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_notification_events','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_matches','INSERT')
  and not has_table_privilege('authenticated','public.marketplace_notifications','UPDATE'),
  'authenticated clients must not access P5.5 tables directly'
);

select pg_temp.p55_assert(
  has_function_privilege(
    'authenticated',
    'public.p5_5_my_notifications(uuid,integer,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.p5_5_notification_action(uuid,uuid,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.p5_5_buyer_match_summary(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p5_5_my_notifications(uuid,integer,integer)',
    'EXECUTE'
  ),
  'P5.5 public RPCs must require authenticated/service authority'
);

rollback;
