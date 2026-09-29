-- P5.1 — Demand Listing Foundation acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.p51_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.1 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p51_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P5.1 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P5.1 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005101'::uuid,'p51-admin@example.test',now()),
  ('00000000-0000-0000-0000-000000005102'::uuid,'p51-viewer@example.test',now()),
  ('00000000-0000-0000-0000-000000005103'::uuid,'p51-outsider@example.test',now())
on conflict (id) do nothing;

insert into public.organizations(id,name,slug,created_by,country_code,industry)
values
  (
    '00000000-0000-0000-0000-000000005110'::uuid,
    'P5.1 Buyer Organization',
    'p51-buyer-organization',
    '00000000-0000-0000-0000-000000005101'::uuid,
    'IT','steel'
  ),
  (
    '00000000-0000-0000-0000-000000005111'::uuid,
    'P5.1 Other Organization',
    'p51-other-organization',
    '00000000-0000-0000-0000-000000005103'::uuid,
    'DE','steel'
  );

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values
  (
    '00000000-0000-0000-0000-000000005110'::uuid,
    '00000000-0000-0000-0000-000000005101'::uuid,
    'admin','active',true
  ),
  (
    '00000000-0000-0000-0000-000000005110'::uuid,
    '00000000-0000-0000-0000-000000005102'::uuid,
    'viewer','active',false
  ),
  (
    '00000000-0000-0000-0000-000000005111'::uuid,
    '00000000-0000-0000-0000-000000005103'::uuid,
    'admin','active',true
  );

select
  pf.canonical_key as product_key,
  s.id as standard_id,
  a.material_grade_id
from public.network_product_families pf
join public.network_product_family_steel_mappings map
  on map.network_product_family_id=pf.id
join public.steel_standard_product_families spf
  on spf.product_family=map.steel_product_family
join public.steel_standards s
  on s.id=spf.standard_id and s.status='active'
join public.steel_standard_grade_applicability a
  on a.standard_id=s.id and a.product_family=map.steel_product_family
join public.steel_material_grades mg on mg.id=a.material_grade_id
where pf.canonical_key='tubes_pipes'
  and pf.status='active'
order by s.code,mg.designation
limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005101',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_1_create_request(
  '00000000-0000-0000-0000-000000005110'::uuid,
  'Tubi pressione per consegna Italia',
  'anonymous'
) as create_payload \gset

select (:'create_payload'::jsonb->>'request_id') as request_id \gset

select pg_temp.p51_assert(
  :'create_payload'::jsonb->>'status'='draft'
  and :'create_payload'::jsonb->>'visibility_mode'='anonymous',
  'buyer admin must create an explicit draft request'
);

select public.p5_1_add_request_line(
  :'request_id'::uuid,
  jsonb_build_object(
    'product_family_key',:'product_key',
    'standard_id',:'standard_id',
    'material_grade_id',:'material_grade_id',
    'manufacturing_process','welded',
    'outer_diameter_mm','406.4',
    'thickness_mm','6.3',
    'length_mm','12000',
    'quantity','120',
    'quantity_unit','m',
    'certification','EN 10204 3.1',
    'delivery_country_code','IT',
    'delivery_region','Piemonte',
    'requested_delivery_date',(current_date+30)::text,
    'notes','P5.1 acceptance structured demand'
  )
) as line_payload \gset

select pg_temp.p51_assert(
  :'line_payload'::jsonb->>'line_number'='1',
  'first structured request line must be persisted'
);

select public.p5_1_my_request(:'request_id'::uuid) as draft_payload \gset

select pg_temp.p51_assert(
  :'draft_payload'::jsonb->>'contract'='P5.1-my-request-v1'
  and :'draft_payload'::jsonb->'request'->>'status'='draft'
  and jsonb_array_length(:'draft_payload'::jsonb->'lines')=1
  and :'draft_payload'::jsonb->'lines'->0->>'product_family_key'='tubes_pipes'
  and :'draft_payload'::jsonb->'lines'->0->>'delivery_country_code'='IT',
  'buyer read model must preserve structured draft demand'
);

select public.p5_1_publish_request(
  :'request_id'::uuid,
  now()+interval '7 days'
) as publish_payload \gset

select pg_temp.p51_assert(
  :'publish_payload'::jsonb->>'status'='published'
  and :'publish_payload'::jsonb->>'visibility_mode'='anonymous'
  and (:'publish_payload'::jsonb->>'line_count')::int=1,
  'explicit publish must activate request with authoritative close time'
);

select pg_temp.p51_assert_raises(
  format(
    $sql$select public.p5_1_add_request_line(
      %L::uuid,
      jsonb_build_object(
        'product_family_key','tubes_pipes',
        'quantity','1',
        'quantity_unit','t',
        'delivery_country_code','IT'
      )
    )$sql$,
    :'request_id'
  ),
  'while request is draft'
);

select public.p5_1_my_requests(
  '00000000-0000-0000-0000-000000005110'::uuid
) as list_payload \gset

select pg_temp.p51_assert(
  :'list_payload'::jsonb->>'contract'='P5.1-my-requests-v1'
  and jsonb_array_length(:'list_payload'::jsonb->'items')=1
  and :'list_payload'::jsonb->'items'->0->>'status'='published'
  and :'list_payload'::jsonb->'items'->0->>'effective_status'='open',
  'organization request list must expose own published request only'
);

select public.p5_1_withdraw_request(:'request_id'::uuid) as withdraw_payload \gset

select pg_temp.p51_assert(
  :'withdraw_payload'::jsonb->>'previous_status'='published'
  and :'withdraw_payload'::jsonb->>'status'='withdrawn',
  'buyer must be able to withdraw its published request'
);

reset role;

select pg_temp.p51_assert(
  (
    select count(*)
    from public.marketplace_request_events
    where request_id=:'request_id'::uuid
      and event_type in ('created','line_added','published','withdrawn')
  )=4,
  'request lifecycle must be auditable through append-only events'
);

select pg_temp.p51_assert(
  not has_table_privilege('authenticated','public.marketplace_requests','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_request_lines','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_request_events','SELECT'),
  'authenticated clients must not receive raw Marketplace table access'
);

select pg_temp.p51_assert(
  not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name in ('marketplace_requests','marketplace_request_lines')
      and column_name in ('rfq_id','source_rfq_id','commercial_product_id','customer_id','price')
  ),
  'P5.1 must remain structurally separate from Commercial Memory RFQs, customers and pricing'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005102',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p51_assert_raises(
  $$select public.p5_1_create_request(
      '00000000-0000-0000-0000-000000005110'::uuid,
      'Viewer cannot publish demand',
      'named'
    )$$,
  'admin/member membership required'
);

select pg_temp.p51_assert(
  jsonb_array_length(
    public.p5_1_my_requests(
      '00000000-0000-0000-0000-000000005110'::uuid
    )->'items'
  )=1,
  'viewer may read own organization Marketplace workspace'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005103',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p51_assert_raises(
  format(
    $sql$select public.p5_1_my_request(%L::uuid)$sql$,
    :'request_id'
  ),
  'active organization membership required'
);

select pg_temp.p51_assert(
  jsonb_array_length(
    public.p5_1_my_requests(
      '00000000-0000-0000-0000-000000005111'::uuid
    )->'items'
  )=0,
  'other organization must not see buyer request through P5.1'
);

select pg_temp.p51_assert(
  jsonb_typeof(public.p5_1_listing_taxonomy()->'product_families')='array'
  and jsonb_typeof(public.p5_1_listing_taxonomy()->'standards')='array'
  and jsonb_typeof(public.p5_1_listing_taxonomy()->'grades')='array',
  'authenticated Marketplace taxonomy must expose governed Network and Steel Knowledge options'
);

reset role;

select pg_temp.p51_assert_raises(
  format(
    $sql$update public.marketplace_request_events
      set metadata='{}'::jsonb
      where request_id=%L::uuid$sql$,
    :'request_id'
  ),
  'append-only'
);

rollback;
