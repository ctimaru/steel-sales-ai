-- P5.3 — Entitlement & Unlock Foundation acceptance.
-- Disposable CI transaction; all fixtures roll back.

begin;

create or replace function pg_temp.p53_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.3 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p53_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P5.3 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P5.3 statement unexpectedly succeeded: %',statement;
end;
$$;

-- Keep the singleton root invariant while making the acceptance self-contained.
update public.platform_user_roles
set status='revoked',revoked_at=now(),reason='P5.3 acceptance temporary root replacement'
where role='platform_superadmin' and status='active';

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005301'::uuid,'p53-buyer@example.test',now()),
  ('00000000-0000-0000-0000-000000005302'::uuid,'p53-specific@example.test',now()),
  ('00000000-0000-0000-0000-000000005303'::uuid,'p53-global@example.test',now()),
  ('00000000-0000-0000-0000-000000005304'::uuid,'p53-expired@example.test',now()),
  ('00000000-0000-0000-0000-000000005305'::uuid,'p53-root@example.test',now());

insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
values(
  '00000000-0000-0000-0000-000000005305'::uuid,
  'platform_superadmin',
  'active',
  null,
  'P5.3 acceptance root'
);

insert into public.organizations(id,name,slug,created_by,country_code,industry)
values
  ('00000000-0000-0000-0000-000000005310'::uuid,'P5.3 Buyer','p53-buyer','00000000-0000-0000-0000-000000005301'::uuid,'IT','steel'),
  ('00000000-0000-0000-0000-000000005311'::uuid,'P5.3 Supplier Specific','p53-supplier-specific','00000000-0000-0000-0000-000000005302'::uuid,'DE','steel'),
  ('00000000-0000-0000-0000-000000005312'::uuid,'P5.3 Supplier Global','p53-supplier-global','00000000-0000-0000-0000-000000005303'::uuid,'AT','steel'),
  ('00000000-0000-0000-0000-000000005313'::uuid,'P5.3 Supplier Expired','p53-supplier-expired','00000000-0000-0000-0000-000000005304'::uuid,'FR','steel');

insert into public.organization_memberships(organization_id,user_id,role,status,is_default)
values
  ('00000000-0000-0000-0000-000000005310'::uuid,'00000000-0000-0000-0000-000000005301'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005311'::uuid,'00000000-0000-0000-0000-000000005302'::uuid,'viewer','active',true),
  ('00000000-0000-0000-0000-000000005312'::uuid,'00000000-0000-0000-0000-000000005303'::uuid,'viewer','active',true),
  ('00000000-0000-0000-0000-000000005313'::uuid,'00000000-0000-0000-0000-000000005304'::uuid,'viewer','active',true);

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,
  description,publication_status,claimed_status,verification_status
)
values (
  '00000000-0000-0000-0000-000000005320'::uuid,
  'P5.3 Named Buyer S.r.l.',
  'P5.3 Named Buyer',
  'IT',
  'https://p53-buyer.example.test',
  'p53-buyer.example.test',
  'P5.3 acceptance public profile',
  'published',
  'unclaimed',
  'verified'
);

insert into public.network_company_claims(
  id,network_company_id,organization_id,requested_by,status,request_note
)
values (
  '00000000-0000-0000-0000-000000005321'::uuid,
  '00000000-0000-0000-0000-000000005320'::uuid,
  '00000000-0000-0000-0000-000000005310'::uuid,
  '00000000-0000-0000-0000-000000005301'::uuid,
  'requested',
  'P5.3 acceptance bridge evidence'
);

insert into public.organization_network_company_links(
  id,organization_id,network_company_id,application_id,link_status,linked_by,claim_id
)
values (
  '00000000-0000-0000-0000-000000005322'::uuid,
  '00000000-0000-0000-0000-000000005310'::uuid,
  '00000000-0000-0000-0000-000000005320'::uuid,
  null,
  'active',
  '00000000-0000-0000-0000-000000005301'::uuid,
  '00000000-0000-0000-0000-000000005321'::uuid
);

select
  pf.canonical_key as product_key,
  s.id as standard_id,
  s.code as standard_code,
  a.material_grade_id,
  mg.designation as grade_designation
from public.network_product_families pf
join public.network_product_family_steel_mappings map
  on map.network_product_family_id=pf.id
join public.steel_standard_product_families spf
  on spf.product_family=map.steel_product_family
join public.steel_standards s
  on s.id=spf.standard_id and s.status='active'
join public.steel_standard_grade_applicability a
  on a.standard_id=s.id and a.product_family=map.steel_product_family
join public.steel_material_grades mg
  on mg.id=a.material_grade_id
where pf.canonical_key='tubes_pipes'
  and pf.status='active'
order by s.code,mg.designation
limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005301',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005310'::uuid,
    'SECRET-P53-NAMED-TITLE',
    'named'
  )->>'request_id'
) as named_request_id \gset

select public.p5_1_add_request_line(
  :'named_request_id'::uuid,
  jsonb_build_object(
    'product_family_key',:'product_key',
    'standard_id',:'standard_id',
    'material_grade_id',:'material_grade_id',
    'manufacturing_process','welded',
    'outer_diameter_mm','406.4',
    'thickness_mm','6.3',
    'length_mm','12000',
    'quantity','98765.432',
    'quantity_unit','m',
    'certification','EN 10204 3.1',
    'delivery_country_code','IT',
    'delivery_region','Piemonte',
    'requested_delivery_date',(current_date+30)::text,
    'notes','SECRET-P53-NAMED-NOTES'
  )
);

select public.p5_1_publish_request(
  :'named_request_id'::uuid,
  now()+interval '7 days'
);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005310'::uuid,
    'SECRET-P53-ANON-TITLE',
    'anonymous'
  )->>'request_id'
) as anonymous_request_id \gset

select public.p5_1_add_request_line(
  :'anonymous_request_id'::uuid,
  jsonb_build_object(
    'product_family_key',:'product_key',
    'standard_id',:'standard_id',
    'material_grade_id',:'material_grade_id',
    'manufacturing_process','seamless',
    'outer_diameter_mm','323.9',
    'thickness_mm','7.1',
    'length_mm','12000',
    'quantity','42.5',
    'quantity_unit','t',
    'certification','EN 10204 3.2',
    'delivery_country_code','IT',
    'delivery_region','Lombardia',
    'requested_delivery_date',(current_date+20)::text,
    'notes','SECRET-P53-ANON-NOTES BUYER-IDENTITY-SHOULD-STAY-HIDDEN'
  )
);

select public.p5_1_publish_request(
  :'anonymous_request_id'::uuid,
  now()+interval '6 days'
);

-- Supplier starts locked and cannot self-grant.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005302',true);

select public.p5_3_entitlement_state(
  '00000000-0000-0000-0000-000000005311'::uuid,
  :'named_request_id'::uuid
) as locked_state \gset

select pg_temp.p53_assert(
  :'locked_state'::jsonb->>'state'='locked'
  and (:'locked_state'::jsonb->>'can_view_locked_detail')::boolean=false
  and (:'locked_state'::jsonb->>'can_respond')::boolean=false
  and not (:'locked_state'::jsonb ? 'entitlement_event_id'),
  'supplier must start locked with no response right or internal event id'
);

select pg_temp.p53_assert_raises(
  format(
    'select public.p5_3_marketplace_detail(%L::uuid,%L::uuid)',
    '00000000-0000-0000-0000-000000005311',
    :'named_request_id'
  ),
  'Marketplace entitlement required'
);

select pg_temp.p53_assert_raises(
  format(
    'select public.p5_3_grant_entitlement(%L::uuid,%L,%L::uuid,%L,%L,null,%L,%L::jsonb)',
    '00000000-0000-0000-0000-000000005311',
    'opportunity_unlock',
    :'named_request_id',
    'credit',
    'credit:self-grant',
    'p53.self.grant.blocked',
    '{}'
  ),
  'Marketplace entitlement authority required'
);

-- Platform Owner grants a request-specific credit unlock.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005305',true);

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-000000005311'::uuid,
  'opportunity_unlock',
  :'named_request_id'::uuid,
  'credit',
  'credit:p53-specific',
  now()+interval '2 days',
  'p53.specific.grant.001',
  '{"plan":"single_opportunity"}'::jsonb
) as specific_grant \gset

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-000000005311'::uuid,
  'opportunity_unlock',
  :'named_request_id'::uuid,
  'credit',
  'credit:p53-specific',
  now()+interval '2 days',
  'p53.specific.grant.001',
  '{"plan":"single_opportunity"}'::jsonb
) as specific_grant_retry \gset

select pg_temp.p53_assert(
  :'specific_grant'::jsonb->>'event_id'=:'specific_grant_retry'::jsonb->>'event_id'
  and (:'specific_grant'::jsonb->>'idempotent')::boolean=false
  and (:'specific_grant_retry'::jsonb->>'idempotent')::boolean=true
  and (
    select count(*)
    from public.marketplace_entitlement_events
    where idempotency_key='p53.specific.grant.001'
  )=1,
  'grant must be idempotent and ledger event must remain unique'
);

select pg_temp.p53_assert_raises(
  format(
    'select public.p5_3_grant_entitlement(%L::uuid,%L,%L::uuid,%L,%L,now()+interval ''2 days'',%L,%L::jsonb)',
    '00000000-0000-0000-0000-000000005311',
    'opportunity_unlock',
    :'named_request_id',
    'credit',
    'credit:DIFFERENT',
    'p53.specific.grant.001',
    '{"plan":"single_opportunity"}'
  ),
  'idempotency key conflict'
);

-- Entitled supplier receives the full governed named detail but no response right.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005302',true);

select public.p5_3_entitlement_state(
  '00000000-0000-0000-0000-000000005311'::uuid,
  :'named_request_id'::uuid
) as specific_state \gset

select public.p5_3_marketplace_detail(
  '00000000-0000-0000-0000-000000005311'::uuid,
  :'named_request_id'::uuid
) as named_detail \gset

select pg_temp.p53_assert(
  :'specific_state'::jsonb->>'state'='entitled'
  and :'specific_state'::jsonb->>'entitlement_key'='opportunity_unlock'
  and :'specific_state'::jsonb->>'source_kind'='credit'
  and (:'specific_state'::jsonb->>'can_view_locked_detail')::boolean=true
  and (:'specific_state'::jsonb->>'can_respond')::boolean=false,
  'request-specific entitlement must activate detail without response rights'
);

select pg_temp.p53_assert(
  :'named_detail'::jsonb->>'contract'='P5.3-detail-v1'
  and :'named_detail'::jsonb->'buyer'->>'visibility_mode'='named'
  and :'named_detail'::jsonb->'buyer'->>'display_name'='P5.3 Named Buyer'
  and :'named_detail'::jsonb->'lines'->0->>'standard_code'=:'standard_code'
  and :'named_detail'::jsonb->'lines'->0->>'grade_designation'=:'grade_designation'
  and (:'named_detail'::jsonb->'lines'->0->>'outer_diameter_mm')::numeric=406.4
  and (:'named_detail'::jsonb->'lines'->0->>'thickness_mm')::numeric=6.3
  and (:'named_detail'::jsonb->'lines'->0->>'length_mm')::numeric=12000
  and (:'named_detail'::jsonb->'lines'->0->>'quantity')::numeric=98765.432
  and :'named_detail'::jsonb->'lines'->0->>'certification'='EN 10204 3.1'
  and :'named_detail'::jsonb->'lines'->0->>'delivery_region'='Piemonte'
  and :'named_detail'::jsonb->'lines'->0->>'notes'='SECRET-P53-NAMED-NOTES'
  and (:'named_detail'::jsonb->>'can_respond')::boolean=false
  and position('SECRET-P53-NAMED-TITLE' in :'named_detail')=0
  and position('"organization_id"' in :'named_detail')=0,
  'named unlocked detail must expose governed request detail without buyer tenant id/title or response'
);

select public.p5_3_marketplace_detail(
  '00000000-0000-0000-0000-000000005311'::uuid,
  :'named_request_id'::uuid
);

select pg_temp.p53_assert(
  (
    select count(*)
    from public.marketplace_unlocks
    where request_id=:'named_request_id'::uuid
      and supplier_organization_id='00000000-0000-0000-0000-000000005311'::uuid
  )=1,
  'repeated detail views must preserve one immutable first-unlock audit row'
);

-- Revoke request-specific access; history remains.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005305',true);

select public.p5_3_revoke_entitlement(
  '00000000-0000-0000-0000-000000005311'::uuid,
  'opportunity_unlock',
  :'named_request_id'::uuid,
  'credit',
  'credit:p53-specific',
  'p53.specific.revoke.001',
  '{"reason":"acceptance"}'::jsonb
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005302',true);

select public.p5_3_entitlement_state(
  '00000000-0000-0000-0000-000000005311'::uuid,
  :'named_request_id'::uuid
) as revoked_state \gset

select pg_temp.p53_assert(
  :'revoked_state'::jsonb->>'state'='locked'
  and (
    select count(*)
    from public.marketplace_entitlement_events
    where supplier_organization_id='00000000-0000-0000-0000-000000005311'::uuid
      and request_id=:'named_request_id'::uuid
  )=2,
  'revoke must relock without deleting entitlement history'
);

select pg_temp.p53_assert_raises(
  format(
    'select public.p5_3_marketplace_detail(%L::uuid,%L::uuid)',
    '00000000-0000-0000-0000-000000005311',
    :'named_request_id'
  ),
  'Marketplace entitlement required'
);

-- Global subscription entitlement unlocks foreign requests, including anonymous,
-- but anonymous buyer identity, free title and notes remain withheld.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005305',true);

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-000000005312'::uuid,
  'marketplace_access',
  null,
  'subscription',
  'subscription:p53-global',
  now()+interval '5 days',
  'p53.global.grant.001',
  '{"tier":"marketplace_access"}'::jsonb
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005303',true);

select public.p5_3_entitlement_state(
  '00000000-0000-0000-0000-000000005312'::uuid,
  :'anonymous_request_id'::uuid
) as global_state \gset

select public.p5_3_marketplace_detail(
  '00000000-0000-0000-0000-000000005312'::uuid,
  :'anonymous_request_id'::uuid
) as anonymous_detail \gset

select pg_temp.p53_assert(
  :'global_state'::jsonb->>'state'='entitled'
  and :'global_state'::jsonb->>'entitlement_key'='marketplace_access'
  and :'global_state'::jsonb->>'source_kind'='subscription'
  and (:'global_state'::jsonb->>'can_respond')::boolean=false,
  'organization-wide marketplace_access must satisfy detail entitlement only'
);

select pg_temp.p53_assert(
  :'anonymous_detail'::jsonb->'buyer'=jsonb_build_object('visibility_mode','anonymous')
  and :'anonymous_detail'::jsonb->'lines'->0->>'standard_code'=:'standard_code'
  and :'anonymous_detail'::jsonb->'lines'->0->>'grade_designation'=:'grade_designation'
  and (:'anonymous_detail'::jsonb->'lines'->0->>'outer_diameter_mm')::numeric=323.9
  and (:'anonymous_detail'::jsonb->'lines'->0->>'quantity')::numeric=42.5
  and :'anonymous_detail'::jsonb->'lines'->0->>'delivery_region'='Lombardia'
  and (:'anonymous_detail'::jsonb->'lines'->0->>'notes_withheld_for_anonymity')::boolean=true
  and not (:'anonymous_detail'::jsonb->'lines'->0 ? 'notes')
  and position('SECRET-P53-ANON-TITLE' in :'anonymous_detail')=0
  and position('SECRET-P53-ANON-NOTES' in :'anonymous_detail')=0
  and position('BUYER-IDENTITY-SHOULD-STAY-HIDDEN' in :'anonymous_detail')=0
  and position('network_company_id' in :'anonymous_detail')=0
  and position('"organization_id"' in :'anonymous_detail')=0
  and (:'anonymous_detail'::jsonb->>'can_respond')::boolean=false,
  'anonymous unlock must reveal governed opportunity detail without buyer identity or free-text notes'
);

-- Expiry is server-derived from the append-only ledger.
reset role;

insert into public.marketplace_entitlement_events(
  supplier_organization_id,request_id,entitlement_key,event_type,source_kind,
  source_reference,idempotency_key,effective_at,expires_at,
  actor_user_id,actor_authority_type,metadata
)
values(
  '00000000-0000-0000-0000-000000005313'::uuid,
  null,
  'marketplace_access',
  'granted',
  'pilot',
  'expired-fixture',
  'p53.expired.fixture.001',
  now()-interval '2 hours',
  now()-interval '1 hour',
  null,
  'system',
  '{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005304',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_3_entitlement_state(
  '00000000-0000-0000-0000-000000005313'::uuid,
  :'named_request_id'::uuid
) as expired_state \gset

select pg_temp.p53_assert(
  :'expired_state'::jsonb->>'state'='expired'
  and (:'expired_state'::jsonb->>'can_view_locked_detail')::boolean=false,
  'expired entitlement must not expose locked detail'
);

select pg_temp.p53_assert_raises(
  format(
    'select public.p5_3_marketplace_detail(%L::uuid,%L::uuid)',
    '00000000-0000-0000-0000-000000005313',
    :'named_request_id'
  ),
  'Marketplace entitlement required'
);

-- Buyer cannot consume own listing through the supplier entitlement endpoints.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005301',true);

select pg_temp.p53_assert(
  public.p5_3_entitlement_state(
    '00000000-0000-0000-0000-000000005310'::uuid,
    :'named_request_id'::uuid
  ) is null,
  'buyer must not receive supplier entitlement state for own listing'
);

reset role;

-- Closed listings remain unavailable even with historical/global entitlement.
update public.marketplace_requests
set closes_at=now()-interval '1 minute'
where id=:'anonymous_request_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005303',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p53_assert(
  public.p5_3_entitlement_state(
    '00000000-0000-0000-0000-000000005312'::uuid,
    :'anonymous_request_id'::uuid
  ) is null,
  'expired listing must not become readable because entitlement exists'
);

select pg_temp.p53_assert(
  public.p5_3_marketplace_detail(
    '00000000-0000-0000-0000-000000005312'::uuid,
    :'anonymous_request_id'::uuid
  ) is null,
  'closed listing detail must not remain addressable'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005305',true);

select pg_temp.p53_assert_raises(
  format(
    'select public.p5_3_grant_entitlement(%L::uuid,%L,%L::uuid,%L,%L,null,%L,%L::jsonb)',
    '00000000-0000-0000-0000-000000005311',
    'opportunity_unlock',
    :'anonymous_request_id',
    'credit',
    'credit:closed',
    'p53.closed.grant.001',
    '{}'
  ),
  'requires an open published Marketplace request'
);

reset role;

-- Append-only history and API privilege boundaries.
select pg_temp.p53_assert_raises(
  format(
    'update public.marketplace_entitlement_events set metadata=%L::jsonb where id=%L::uuid',
    '{"mutated":true}',
    :'specific_grant'::jsonb->>'event_id'
  ),
  'append-only'
);

select pg_temp.p53_assert(
  not has_table_privilege('authenticated','public.marketplace_entitlement_events','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_unlocks','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_entitlement_events','INSERT')
  and not has_table_privilege('authenticated','public.marketplace_unlocks','INSERT'),
  'authenticated clients must not access entitlement/unlock tables directly'
);

select pg_temp.p53_assert(
  has_function_privilege(
    'authenticated',
    'public.p5_3_entitlement_state(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.p5_3_marketplace_detail(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p5_3_entitlement_state(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p5_3_marketplace_detail(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p5_3_grant_entitlement(uuid,text,uuid,text,text,timestamptz,text,jsonb)',
    'EXECUTE'
  ),
  'P5.3 public RPCs must require authentication/service authority'
);

rollback;
