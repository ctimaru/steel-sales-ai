-- P5.2 — Marketplace Feed + Countdown acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.p52_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.2 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p52_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P5.2 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P5.2 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005201'::uuid,'p52-buyer@example.test',now()),
  ('00000000-0000-0000-0000-000000005202'::uuid,'p52-supplier@example.test',now()),
  ('00000000-0000-0000-0000-000000005203'::uuid,'p52-no-profile@example.test',now())
on conflict (id) do nothing;

insert into public.organizations(id,name,slug,created_by,country_code,industry)
values
  (
    '00000000-0000-0000-0000-000000005210'::uuid,
    'P5.2 Buyer Organization',
    'p52-buyer-organization',
    '00000000-0000-0000-0000-000000005201'::uuid,
    'IT','steel'
  ),
  (
    '00000000-0000-0000-0000-000000005211'::uuid,
    'P5.2 Supplier Organization',
    'p52-supplier-organization',
    '00000000-0000-0000-0000-000000005202'::uuid,
    'DE','steel'
  ),
  (
    '00000000-0000-0000-0000-000000005212'::uuid,
    'P5.2 No Profile Buyer',
    'p52-no-profile-buyer',
    '00000000-0000-0000-0000-000000005203'::uuid,
    'FR','steel'
  );

insert into public.organization_memberships(organization_id,user_id,role,status,is_default)
values
  (
    '00000000-0000-0000-0000-000000005210'::uuid,
    '00000000-0000-0000-0000-000000005201'::uuid,
    'admin','active',true
  ),
  (
    '00000000-0000-0000-0000-000000005211'::uuid,
    '00000000-0000-0000-0000-000000005202'::uuid,
    'viewer','active',true
  ),
  (
    '00000000-0000-0000-0000-000000005212'::uuid,
    '00000000-0000-0000-0000-000000005203'::uuid,
    'admin','active',true
  );

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,
  description,publication_status,claimed_status,verification_status
)
values (
  '00000000-0000-0000-0000-000000005220'::uuid,
  'P5.2 Named Buyer S.r.l.',
  'P5.2 Named Buyer',
  'IT',
  'https://p52-buyer.example.test',
  'p52-buyer.example.test',
  'Named buyer profile for P5.2 acceptance',
  'published',
  'unclaimed',
  'verified'
);

insert into public.network_company_claims(
  id,network_company_id,organization_id,requested_by,status,request_note
)
values (
  '00000000-0000-0000-0000-000000005222'::uuid,
  '00000000-0000-0000-0000-000000005220'::uuid,
  '00000000-0000-0000-0000-000000005210'::uuid,
  '00000000-0000-0000-0000-000000005201'::uuid,
  'requested',
  'P5.2 acceptance origin evidence'
);

insert into public.organization_network_company_links(
  id,organization_id,network_company_id,application_id,link_status,linked_by,claim_id
)
values (
  '00000000-0000-0000-0000-000000005221'::uuid,
  '00000000-0000-0000-0000-000000005210'::uuid,
  '00000000-0000-0000-0000-000000005220'::uuid,
  null,
  'active',
  '00000000-0000-0000-0000-000000005201'::uuid,
  '00000000-0000-0000-0000-000000005222'::uuid
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
where pf.canonical_key='tubes_pipes'
  and pf.status='active'
order by s.code
limit 1 \gset

-- Named and anonymous demand from the same buyer organization.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005201',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005210'::uuid,
    'SECRET-NAMED-CUSTOMER project demand',
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
    'certification','SECRET-CERT-3.1',
    'delivery_country_code','IT',
    'delivery_region','Piemonte',
    'requested_delivery_date',(current_date+30)::text,
    'notes','SECRET-NAMED-NOTES'
  )
);

select public.p5_1_publish_request(
  :'named_request_id'::uuid,
  now()+interval '7 days'
);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005210'::uuid,
    'SECRET-ANON-BUYER project demand',
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
    'certification','SECRET-ANON-CERT',
    'delivery_country_code','IT',
    'delivery_region','Lombardia',
    'requested_delivery_date',(current_date+20)::text,
    'notes','SECRET-ANON-NOTES'
  )
);

select public.p5_1_publish_request(
  :'anonymous_request_id'::uuid,
  now()+interval '12 hours'
);

-- Buyer never sees own listings in the supplier feed.
select public.p5_2_marketplace_feed(
  '00000000-0000-0000-0000-000000005210'::uuid,
  null,null,null,25,0
) as buyer_feed \gset

select pg_temp.p52_assert(
  :'buyer_feed'::jsonb->>'contract'='P5.2-feed-v1'
  and jsonb_array_length(:'buyer_feed'::jsonb->'items')=0
  and (:'buyer_feed'::jsonb->>'total')::int=0,
  'buyer organization must not receive its own demand in supplier feed'
);

reset role;

-- Supplier-side feed is cross-organization and privacy-safe.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005202',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_2_marketplace_feed(
  '00000000-0000-0000-0000-000000005211'::uuid,
  array['tubes_pipes']::text[],
  array['IT']::text[],
  null,
  25,
  0
) as supplier_feed \gset

select pg_temp.p52_assert(
  :'supplier_feed'::jsonb->>'contract'='P5.2-feed-v1'
  and jsonb_array_length(:'supplier_feed'::jsonb->'items')=2
  and (:'supplier_feed'::jsonb->>'total')::int=2,
  'supplier feed must expose two open foreign listings'
);

select pg_temp.p52_assert(
  not (:'supplier_feed'::jsonb ? 'organization_id')
  and position('"organization_id"' in :'supplier_feed')=0
  and position('SECRET-NAMED-CUSTOMER' in :'supplier_feed')=0
  and position('SECRET-ANON-BUYER' in :'supplier_feed')=0
  and position('SECRET-CERT' in :'supplier_feed')=0
  and position('SECRET-ANON-CERT' in :'supplier_feed')=0
  and position('SECRET-NAMED-NOTES' in :'supplier_feed')=0
  and position('SECRET-ANON-NOTES' in :'supplier_feed')=0
  and position('98765.432' in :'supplier_feed')=0
  and position('"standard_id"' in :'supplier_feed')=0
  and position('"material_grade_id"' in :'supplier_feed')=0
  and position('"outer_diameter_mm"' in :'supplier_feed')=0
  and position('"thickness_mm"' in :'supplier_feed')=0
  and position('"length_mm"' in :'supplier_feed')=0
  and position('"requested_delivery_date"' in :'supplier_feed')=0,
  'free feed must never expose locked or Commercial Memory-like detail'
);

select public.p5_2_marketplace_teaser(
  '00000000-0000-0000-0000-000000005211'::uuid,
  :'named_request_id'::uuid
) as named_teaser \gset

select pg_temp.p52_assert(
  :'named_teaser'::jsonb->'buyer'->>'visibility_mode'='named'
  and :'named_teaser'::jsonb->'buyer'->>'network_company_id'='00000000-0000-0000-0000-000000005220'
  and :'named_teaser'::jsonb->'buyer'->>'display_name'='P5.2 Named Buyer'
  and :'named_teaser'::jsonb->'buyer'->>'verification_status'='verified'
  and :'named_teaser'::jsonb->'teaser_lines'->0->>'delivery_region'='Piemonte'
  and :'named_teaser'::jsonb->'teaser_lines'->0->>'quantity_band'='5.000+ m'
  and (:'named_teaser'::jsonb->>'seconds_remaining')::bigint>0,
  'named teaser may expose only governed public buyer identity plus safe demand bands'
);

select public.p5_2_marketplace_teaser(
  '00000000-0000-0000-0000-000000005211'::uuid,
  :'anonymous_request_id'::uuid
) as anonymous_teaser \gset

select pg_temp.p52_assert(
  :'anonymous_teaser'::jsonb->'buyer'=jsonb_build_object('visibility_mode','anonymous')
  and not (:'anonymous_teaser'::jsonb->'teaser_lines'->0 ? 'delivery_region')
  and :'anonymous_teaser'::jsonb->'teaser_lines'->0->>'delivery_country_code'='IT'
  and :'anonymous_teaser'::jsonb->'teaser_lines'->0->>'quantity_band'='20–50 t'
  and :'anonymous_teaser'::jsonb->>'effective_status'='closing_soon'
  and position('P5.2 Named Buyer' in :'anonymous_teaser')=0
  and position('network_company_id' in :'anonymous_teaser')=0
  and position('Lombardia' in :'anonymous_teaser')=0,
  'anonymous teaser must not leak buyer identity or sub-country geography'
);

select pg_temp.p52_assert(
  public.p5_2_marketplace_teaser(
    '00000000-0000-0000-0000-000000005210'::uuid,
    :'named_request_id'::uuid
  ) is null,
  'buyer cannot use supplier teaser endpoint for own listing'
);

select pg_temp.p52_assert_raises(
  $$select public.p5_2_marketplace_feed(
    '00000000-0000-0000-0000-000000005211'::uuid,
    null,null,721,25,0
  )$$,
  'closing_within_hours must be between 1 and 720'
);

reset role;

-- Named publication without a public Network Company profile must fail.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005203',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005212'::uuid,
    'Named without Network profile',
    'named'
  )->>'request_id'
) as no_profile_named_id \gset

select public.p5_1_add_request_line(
  :'no_profile_named_id'::uuid,
  jsonb_build_object(
    'product_family_key','tubes_pipes',
    'quantity','12',
    'quantity_unit','t',
    'delivery_country_code','FR'
  )
);

select pg_temp.p52_assert_raises(
  format(
    'select public.p5_1_publish_request(%L::uuid,now()+interval ''2 days'')',
    :'no_profile_named_id'
  ),
  'requires an active published Network Company profile'
);

-- Anonymous publication does not require a public company profile.
select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005212'::uuid,
    'Anonymous without Network profile',
    'anonymous'
  )->>'request_id'
) as no_profile_anon_id \gset

select public.p5_1_add_request_line(
  :'no_profile_anon_id'::uuid,
  jsonb_build_object(
    'product_family_key','tubes_pipes',
    'quantity','12',
    'quantity_unit','t',
    'delivery_country_code','FR',
    'delivery_region','Île-de-France'
  )
);

select public.p5_1_publish_request(
  :'no_profile_anon_id'::uuid,
  now()+interval '2 days'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005202',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_2_marketplace_feed(
  '00000000-0000-0000-0000-000000005211'::uuid,
  null,null,null,25,0
) as supplier_feed_three \gset

select pg_temp.p52_assert(
  (:'supplier_feed_three'::jsonb->>'total')::int=3,
  'anonymous demand from a buyer without public profile must enter the free feed'
);

reset role;

-- Expired listings disappear without a browser timer or status rewrite.
update public.marketplace_requests
set closes_at=now()-interval '1 minute'
where id=:'no_profile_anon_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005202',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p52_assert(
  (
    public.p5_2_marketplace_feed(
      '00000000-0000-0000-0000-000000005211'::uuid,
      null,null,null,25,0
    )->>'total'
  )::int=2,
  'expired listing must disappear from feed based on database close time'
);

select pg_temp.p52_assert(
  public.p5_2_marketplace_teaser(
    '00000000-0000-0000-0000-000000005211'::uuid,
    :'no_profile_anon_id'::uuid
  ) is null,
  'expired teaser must not remain addressable'
);

reset role;

select pg_temp.p52_assert(
  not has_table_privilege('authenticated','public.marketplace_requests','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_request_lines','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_request_events','SELECT'),
  'P5.2 must preserve RPC-only Marketplace table access'
);

select pg_temp.p52_assert(
  not has_function_privilege(
    'anon',
    'public.p5_2_marketplace_feed(uuid,text[],text[],integer,integer,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.p5_2_marketplace_feed(uuid,text[],text[],integer,integer,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p5_2_marketplace_teaser(uuid,uuid)',
    'EXECUTE'
  ),
  'feed and teaser must require authentication'
);

rollback;
