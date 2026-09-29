-- P5.4 — Governed Supplier Response acceptance.
-- Disposable CI transaction; all fixtures roll back.

begin;

create or replace function pg_temp.p54_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.4 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p54_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P5.4 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P5.4 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005401'::uuid,'p54-buyer@example.test',now()),
  ('00000000-0000-0000-0000-000000005402'::uuid,'p54-supplier@example.test',now()),
  ('00000000-0000-0000-0000-000000005403'::uuid,'p54-nonentitled@example.test',now()),
  ('00000000-0000-0000-0000-000000005404'::uuid,'p54-otherbuyer@example.test',now()),
  ('00000000-0000-0000-0000-000000005405'::uuid,'p54-rate@example.test',now());

insert into public.organizations(id,name,slug,created_by,country_code,industry)
values
  ('00000000-0000-0000-0000-000000005410'::uuid,'P5.4 Buyer','p54-buyer','00000000-0000-0000-0000-000000005401'::uuid,'IT','steel'),
  ('00000000-0000-0000-0000-000000005411'::uuid,'P5.4 Supplier','p54-supplier','00000000-0000-0000-0000-000000005402'::uuid,'DE','steel'),
  ('00000000-0000-0000-0000-000000005412'::uuid,'P5.4 Non Entitled','p54-nonentitled','00000000-0000-0000-0000-000000005403'::uuid,'AT','steel'),
  ('00000000-0000-0000-0000-000000005413'::uuid,'P5.4 Other Buyer','p54-otherbuyer','00000000-0000-0000-0000-000000005404'::uuid,'FR','steel'),
  ('00000000-0000-0000-0000-000000005414'::uuid,'P5.4 Rate Supplier','p54-rate-supplier','00000000-0000-0000-0000-000000005405'::uuid,'NL','steel');

insert into public.organization_memberships(organization_id,user_id,role,status,is_default)
values
  ('00000000-0000-0000-0000-000000005410'::uuid,'00000000-0000-0000-0000-000000005401'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005411'::uuid,'00000000-0000-0000-0000-000000005402'::uuid,'member','active',true),
  ('00000000-0000-0000-0000-000000005412'::uuid,'00000000-0000-0000-0000-000000005403'::uuid,'member','active',true),
  ('00000000-0000-0000-0000-000000005413'::uuid,'00000000-0000-0000-0000-000000005404'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-000000005414'::uuid,'00000000-0000-0000-0000-000000005405'::uuid,'member','active',true);

select canonical_key as product_key
from public.network_product_families
where status='active' and searchable=true
order by canonical_key
limit 1 \gset

-- Buyer creates one anonymous opportunity.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005401',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005410'::uuid,
    'P5.4 anonymous governed response acceptance',
    'anonymous'
  )->>'request_id'
) as request_id \gset

select public.p5_1_add_request_line(
  :'request_id'::uuid,
  jsonb_build_object(
    'product_family_key',:'product_key',
    'manufacturing_process','welded',
    'quantity','25',
    'quantity_unit','t',
    'delivery_country_code','IT',
    'delivery_region','Piemonte',
    'requested_delivery_date',(current_date+30)::text,
    'notes','SECRET-P54-BUYER-NOTES'
  )
);

select public.p5_1_publish_request(
  :'request_id'::uuid,
  now()+interval '7 days'
);

reset role;

select id as request_line_id
from public.marketplace_request_lines
where request_id=:'request_id'::uuid
order by line_number
limit 1 \gset

-- Entitlement alone is not response authority.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005402',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_4_response_rights(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'request_id'::uuid
) as no_entitlement_rights \gset

select pg_temp.p54_assert(
  :'no_entitlement_rights'::jsonb->>'reason'='entitlement_required'
  and (:'no_entitlement_rights'::jsonb->>'can_create')::boolean=false,
  'non-entitled supplier must not receive response rights'
);

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-000000005411'::uuid,
  'opportunity_unlock',
  :'request_id'::uuid,
  'credit',
  'credit:p54-main',
  now()+interval '2 days',
  'p54.main.grant.001',
  '{"acceptance":"P5.4"}'::jsonb
);

reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005402',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_4_response_rights(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'request_id'::uuid
) as before_unlock_rights \gset

select pg_temp.p54_assert(
  :'before_unlock_rights'::jsonb->>'reason'='unlock_required'
  and (:'before_unlock_rights'::jsonb->>'can_create')::boolean=false,
  'active entitlement without actual locked-detail access must not grant response rights'
);

select public.p5_3_marketplace_detail(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'request_id'::uuid
) as unlocked_detail \gset

select pg_temp.p54_assert(
  :'unlocked_detail'::jsonb->'buyer'->>'visibility_mode'='anonymous'
  and (:'unlocked_detail'::jsonb->'lines'->0->>'notes_withheld_for_anonymity')::boolean=true
  and not (:'unlocked_detail'::jsonb->'lines'->0 ? 'notes'),
  'P5.3 anonymous detail protection must remain intact before response'
);

select public.p5_4_response_rights(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'request_id'::uuid
) as eligible_rights \gset

select pg_temp.p54_assert(
  :'eligible_rights'::jsonb->>'state'='eligible'
  and (:'eligible_rights'::jsonb->>'can_create')::boolean=true
  and :'eligible_rights'::jsonb->>'reason'='eligible_after_unlock',
  'entitled supplier with actual unlock must receive explicit P5.4 response right'
);

select (
  public.p5_4_create_response(
    '00000000-0000-0000-0000-000000005411'::uuid,
    :'request_id'::uuid,
    'quote',
    'Disponibilità confermata per parte del quantitativo.',
    current_date+10
  )->>'response_id'
) as response_id \gset

select public.p5_4_supplier_workspace(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'request_id'::uuid
) as supplier_workspace \gset

select pg_temp.p54_assert(
  :'supplier_workspace'::jsonb->'rights'->>'response_status'='draft'
  and :'supplier_workspace'::jsonb->'request_lines'->0->>'request_line_id'=:'request_line_id'
  and :'supplier_workspace'::text not like '%P5.4 Buyer%'
  and :'supplier_workspace'::text not like '%00000000-0000-0000-0000-000000005410%'
  and :'supplier_workspace'::text not like '%SECRET-P54-BUYER-NOTES%',
  'supplier response workspace must expose composer line ids without anonymous buyer identity or private notes'
);

select public.p5_4_upsert_response_line(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'response_id'::uuid,
  :'request_line_id'::uuid,
  20,
  't',
  950,
  'EUR',
  21,
  current_date+25,
  'Prezzo franco partenza.'
);

select public.p5_4_submit_response(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'response_id'::uuid
) as submitted \gset

select pg_temp.p54_assert(
  :'submitted'::jsonb->>'status'='submitted',
  'valid quote must transition draft -> submitted'
);

select pg_temp.p54_assert_raises(
  format(
    'select public.p5_4_create_response(%L::uuid,%L::uuid,%L,%L,null)',
    '00000000-0000-0000-0000-000000005411',
    :'request_id',
    'interest',
    'duplicate'
  ),
  'response right not available'
);

-- A different supplier cannot read/mutate the submitted response.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005403',true);

select public.p5_4_supplier_workspace(
  '00000000-0000-0000-0000-000000005412'::uuid,
  :'request_id'::uuid
) as nonentitled_workspace \gset

select pg_temp.p54_assert(
  :'nonentitled_workspace'::jsonb->'rights'->>'reason'='entitlement_required'
  and :'nonentitled_workspace'::jsonb->'response'='null'::jsonb,
  'non-entitled supplier workspace must not expose another supplier response'
);

select pg_temp.p54_assert_raises(
  format(
    'select public.p5_4_update_response(%L::uuid,%L::uuid,%L,%L,null)',
    '00000000-0000-0000-0000-000000005412',
    :'response_id',
    'interest',
    'cross-company mutation'
  ),
  'Marketplace response not found'
);

-- Buyer sees submitted response + supplier identity, but another buyer cannot.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005401',true);

select public.p5_4_buyer_inbox(
  '00000000-0000-0000-0000-000000005410'::uuid,
  :'request_id'::uuid,
  20,
  0
) as buyer_inbox \gset

select pg_temp.p54_assert(
  (:'buyer_inbox'::jsonb->>'total')::int=1
  and :'buyer_inbox'::jsonb->'items'->0->>'response_id'=:'response_id'
  and :'buyer_inbox'::jsonb->'items'->0->'supplier'->>'display_name'='P5.4 Supplier',
  'buyer inbox must surface submitted supplier response for its own request'
);

select public.p5_4_buyer_response_detail(
  '00000000-0000-0000-0000-000000005410'::uuid,
  :'response_id'::uuid
) as buyer_detail \gset

select pg_temp.p54_assert(
  :'buyer_detail'::jsonb->'response'->>'status'='submitted'
  and (:'buyer_detail'::jsonb->'lines'->0->>'unit_price')::numeric=950
  and :'buyer_detail'::jsonb->'lines'->0->>'currency_code'='EUR'
  and :'buyer_detail'::jsonb->'supplier'->>'display_name'='P5.4 Supplier',
  'buyer response detail must expose governed commercial response data'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005404',true);

select pg_temp.p54_assert(
  public.p5_4_buyer_response_detail(
    '00000000-0000-0000-0000-000000005413'::uuid,
    :'response_id'::uuid
  ) is null,
  'other buyer organization must not read response detail'
);

select pg_temp.p54_assert_raises(
  format(
    'select public.p5_4_buyer_transition(%L::uuid,%L::uuid,%L)',
    '00000000-0000-0000-0000-000000005413',
    :'response_id',
    'acknowledge'
  ),
  'Marketplace response not found'
);

-- Owning buyer acknowledges then closes.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005401',true);

select public.p5_4_buyer_transition(
  '00000000-0000-0000-0000-000000005410'::uuid,
  :'response_id'::uuid,
  'acknowledge'
) as acknowledged \gset

select pg_temp.p54_assert(
  :'acknowledged'::jsonb->>'status'='acknowledged',
  'buyer must be able to acknowledge submitted response'
);

select public.p5_4_buyer_transition(
  '00000000-0000-0000-0000-000000005410'::uuid,
  :'response_id'::uuid,
  'close'
) as closed_response \gset

select pg_temp.p54_assert(
  :'closed_response'::jsonb->>'status'='closed',
  'buyer must be able to close acknowledged response'
);

reset role;

select array_agg(event_type order by event_sequence) as event_order
from public.marketplace_response_events
where response_id=:'response_id'::uuid \gset

select pg_temp.p54_assert(
  :'event_order'::text[]=
    array['created','line_upserted','submitted','acknowledged','closed']::text[],
  'response audit ledger must preserve deterministic lifecycle order'
);

select pg_temp.p54_assert_raises(
  format(
    'update public.marketplace_response_events set metadata=%L::jsonb where response_id=%L::uuid',
    '{"tampered":true}',
    :'response_id'
  ),
  'append-only'
);

-- Second opportunity proves submitted response withdrawal lifecycle.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005401',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005410'::uuid,
    'P5.4 supplier withdrawal acceptance',
    'anonymous'
  )->>'request_id'
) as withdraw_request_id \gset

select public.p5_1_add_request_line(
  :'withdraw_request_id'::uuid,
  jsonb_build_object(
    'product_family_key',:'product_key',
    'quantity','10',
    'quantity_unit','t',
    'delivery_country_code','IT'
  )
);

select public.p5_1_publish_request(
  :'withdraw_request_id'::uuid,
  now()+interval '5 days'
);

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-000000005411'::uuid,
  'opportunity_unlock',
  :'withdraw_request_id'::uuid,
  'credit',
  'credit:p54-withdraw',
  now()+interval '2 days',
  'p54.withdraw.grant.001',
  '{}'::jsonb
);

reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005402',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_3_marketplace_detail(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'withdraw_request_id'::uuid
);

select (
  public.p5_4_create_response(
    '00000000-0000-0000-0000-000000005411'::uuid,
    :'withdraw_request_id'::uuid,
    'interest',
    'Siamo interessati e disponibili a verificare la fornitura.',
    current_date+7
  )->>'response_id'
) as withdraw_response_id \gset

select public.p5_4_submit_response(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'withdraw_response_id'::uuid
);

select public.p5_4_withdraw_response(
  '00000000-0000-0000-0000-000000005411'::uuid,
  :'withdraw_response_id'::uuid
) as withdrawn \gset

select pg_temp.p54_assert(
  :'withdrawn'::jsonb->>'status'='withdrawn',
  'supplier must be able to withdraw submitted response'
);

-- Rate guard: entitlement + unlock remains insufficient after response-volume threshold.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005401',true);
select set_config('request.jwt.claim.role','authenticated',true);

select (
  public.p5_1_create_request(
    '00000000-0000-0000-0000-000000005410'::uuid,
    'P5.4 rate limited target opportunity',
    'anonymous'
  )->>'request_id'
) as rate_request_id \gset

select public.p5_1_add_request_line(
  :'rate_request_id'::uuid,
  jsonb_build_object(
    'product_family_key',:'product_key',
    'quantity','8',
    'quantity_unit','t',
    'delivery_country_code','IT'
  )
);

select public.p5_1_publish_request(
  :'rate_request_id'::uuid,
  now()+interval '4 days'
);

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-000000005414'::uuid,
  'opportunity_unlock',
  :'rate_request_id'::uuid,
  'pilot',
  null,
  now()+interval '1 day',
  'p54.rate.grant.001',
  '{}'::jsonb
);

reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005405',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_3_marketplace_detail(
  '00000000-0000-0000-0000-000000005414'::uuid,
  :'rate_request_id'::uuid
);

reset role;

insert into public.marketplace_requests(
  id,organization_id,created_by_user_id,title,visibility_mode,status,source_kind
)
select
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000005413'::uuid,
  '00000000-0000-0000-0000-000000005404'::uuid,
  'P5.4 rate fixture '||g,
  'anonymous',
  'draft',
  'manual'
from generate_series(1,15) g;

insert into public.marketplace_responses(
  request_id,supplier_organization_id,created_by_user_id,response_kind,status,message
)
select
  r.id,
  '00000000-0000-0000-0000-000000005414'::uuid,
  '00000000-0000-0000-0000-000000005405'::uuid,
  'interest',
  'draft',
  'rate fixture'
from public.marketplace_requests r
where r.organization_id='00000000-0000-0000-0000-000000005413'::uuid
  and r.title like 'P5.4 rate fixture %';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005405',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p5_4_response_rights(
  '00000000-0000-0000-0000-000000005414'::uuid,
  :'rate_request_id'::uuid
) as rate_rights \gset

select pg_temp.p54_assert(
  :'rate_rights'::jsonb->>'reason'='rate_limited'
  and (:'rate_rights'::jsonb->>'can_create')::boolean=false,
  'per-user anti-spam rate limit must block response creation even after entitlement + unlock'
);

reset role;

-- Data API boundaries: authenticated clients use RPCs only.
select pg_temp.p54_assert(
  not has_table_privilege('authenticated','public.marketplace_responses','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_response_lines','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_response_events','SELECT')
  and not has_table_privilege('authenticated','public.marketplace_responses','INSERT')
  and not has_table_privilege('authenticated','public.marketplace_response_lines','INSERT')
  and not has_table_privilege('authenticated','public.marketplace_response_events','INSERT'),
  'authenticated clients must not access P5.4 tables directly'
);

select pg_temp.p54_assert(
  has_function_privilege(
    'authenticated',
    'public.p5_4_response_rights(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.p5_4_supplier_workspace(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.p5_4_buyer_inbox(uuid,uuid,integer,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p5_4_create_response(uuid,uuid,text,text,date)',
    'EXECUTE'
  ),
  'P5.4 public RPCs must require authenticated/service authority'
);

rollback;
