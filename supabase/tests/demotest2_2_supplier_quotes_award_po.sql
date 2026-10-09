-- DEMOTEST2.2: buyer + three registered suppliers, guest quotations, mixed
-- EN 10210 / EN 10219, split award, approval segregation, PO confirmation.
-- LOCAL SUPABASE ONLY. All SQL writes roll back; no provider/SMTP is invoked.
\set ON_ERROR_STOP on
begin;

create temp table dt22_state(key text primary key, value jsonb not null) on commit drop;
grant select,insert,update,delete on dt22_state to anon,authenticated;

create or replace function pg_temp.dt22_assert(ok boolean, explanation text)
returns void language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'DEMOTEST2.2 FAIL: %',explanation; end if;
end $$;
grant execute on function pg_temp.dt22_assert(boolean,text) to anon,authenticated;

create or replace function pg_temp.dt22_denied(statement text, expected text)
returns void language plpgsql as $$
begin
 begin
  execute statement;
 exception when others then
  if position(lower(expected) in lower(sqlerrm))>0 then return; end if;
  raise exception 'DEMOTEST2.2 unexpected error: % (expected %)',sqlerrm,expected;
 end;
 raise exception 'DEMOTEST2.2 operation unexpectedly allowed: %',statement;
end $$;
grant execute on function pg_temp.dt22_denied(text,text) to anon,authenticated;

-- Synthetic Auth identities and distinct registered organizations.
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000002201','dt22-buyer@example.test',now()),
 ('00000000-0000-0000-0000-000000002202','dt22-producer@example.test',now()),
 ('00000000-0000-0000-0000-000000002203','dt22-trader@example.test',now()),
 ('00000000-0000-0000-0000-000000002204','dt22-processor@example.test',now()),
 ('00000000-0000-0000-0000-000000002211','dt22-buyer-approver@example.test',now());

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values
 ('00000000-0000-0000-0000-000000002231','DEMO Industrial Engineering','dt22-buyer','00000000-0000-0000-0000-000000002201','completed'),
 ('00000000-0000-0000-0000-000000002232','DEMO Steel Manufacturing','dt22-producer','00000000-0000-0000-0000-000000002202','completed'),
 ('00000000-0000-0000-0000-000000002233','DEMO Tubes Trading','dt22-trader','00000000-0000-0000-0000-000000002203','completed'),
 ('00000000-0000-0000-0000-000000002234','DEMO Steel Processing','dt22-processor','00000000-0000-0000-0000-000000002204','completed');

insert into public.organization_memberships(organization_id,user_id,role,business_role,status,is_default)
values
 ('00000000-0000-0000-0000-000000002231','00000000-0000-0000-0000-000000002201','admin','sales_director','active',true),
 ('00000000-0000-0000-0000-000000002232','00000000-0000-0000-0000-000000002202','admin','sales_director','active',true),
 ('00000000-0000-0000-0000-000000002233','00000000-0000-0000-0000-000000002203','admin','sales_director','active',true),
 ('00000000-0000-0000-0000-000000002234','00000000-0000-0000-0000-000000002204','admin','operations','active',true),
 ('00000000-0000-0000-0000-000000002231','00000000-0000-0000-0000-000000002211','admin','sales_director','active',true);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002201',true);

insert into dt22_state(key,value)
select 'distinta',jsonb_build_object('id',public.buyer_create_distinta_snapshot(
 '{"title":"DEMOTEST2.2 mixed structural tubes","total_meters":1320,"total_tonnes":29.904,"target_total_eur":29904}'::jsonb,
 '[
  {"description":"RHS 200x100x6","standard":"EN 10219","grade":"S355J2H","quantity_mode":"bars","quantity":40,"bar_length_m":12,"weight_kg_m":26.5,"line_meters":480,"line_tonnes":12.72,"target_eur_t":1000,"target_eur_m":26.5,"target_total_eur":12720},
  {"description":"CHS 168.3x6.3","standard":"EN 10210","grade":"S355J2H","quantity_mode":"bars","quantity":80,"bar_length_m":6,"weight_kg_m":25,"line_meters":480,"line_tonnes":12,"target_eur_t":1000,"target_eur_m":25,"target_total_eur":12000},
  {"description":"SHS 100x100x5","standard":"EN 10219","grade":"S235JRH","quantity_mode":"bars","quantity":60,"bar_length_m":6,"weight_kg_m":14.4,"line_meters":360,"line_tonnes":5.184,"target_eur_t":1000,"target_eur_m":14.4,"target_total_eur":5184}
 ]'::jsonb
));

insert into dt22_state(key,value)
select 'rfq',jsonb_build_object('id',public.rfqh1_create_campaign_from_distinta(
 (select (value->>'id')::uuid from dt22_state where key='distinta'),
 now()+interval '14 days','LOCAL TEST: do not send an RFQ'
));

select public.rfqh1_add_supplier(
 (select (value->>'id')::uuid from dt22_state where key='rfq'),
 'DEMO Steel Manufacturing','offers@producer.example.test',null,'00000000-0000-0000-0000-000000002232'::uuid
);
select public.rfqh1_add_supplier(
 (select (value->>'id')::uuid from dt22_state where key='rfq'),
 'DEMO Tubes Trading','offers@trader.example.test',null,'00000000-0000-0000-0000-000000002233'::uuid
);
select public.rfqh1_add_supplier(
 (select (value->>'id')::uuid from dt22_state where key='rfq'),
 'DEMO Steel Processing','jobs@processor.example.test',null,'00000000-0000-0000-0000-000000002234'::uuid
);
select pg_temp.dt22_assert(
 (select count(distinct supplier_organization_id)=3
  from public.buyer_rfq_suppliers
  where rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')),
 'three supplier identities map to three separate registered tenants'
);

-- An RFQ launch creates local QUEUED delivery rows, not any provider sends.
insert into dt22_state(key,value)
select 'launch',public.rfqh3_launch_campaign(
 (select (value->>'id')::uuid from dt22_state where key='rfq'),
 now()+interval '14 days',
 'LOCAL TEST ONLY — no email will be sent',
 (select jsonb_agg(jsonb_build_object(
    'supplier_id',s.id,
    'dispatch_id',gen_random_uuid(),
    'token_hash',case s.supplier_organization_id
      when '00000000-0000-0000-0000-000000002232'::uuid then repeat('a',64)
      when '00000000-0000-0000-0000-000000002233'::uuid then repeat('b',64)
      else repeat('c',64) end,
    'idempotency_key','dt22-'||s.id::text
  ) order by s.id)
  from public.buyer_rfq_suppliers s
  where s.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq'))
);

select pg_temp.dt22_assert(
 (select count(*)=3 from public.buyer_rfq_dispatches d
  where d.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
    and d.status='queued' and d.provider_message_id is null)
 and (select count(*)=0 from public.buyer_rfq_dispatch_messages m
      where m.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')),
 'RFQ launch must create only unsent local dispatches with no provider message'
);

-- Construct payloads before switching to anonymous supplier-token portal.
insert into dt22_state(key,value)
select 'producer_lines',jsonb_agg(jsonb_build_object(
 'line_id',l.id,'response_status','quoted','price_basis','eur_t',
 'unit_price',845,'lead_time_days',18
) order by l.line_position)
from public.buyer_distinta_lines l
where l.distinta_id=(select (value->>'id')::uuid from dt22_state where key='distinta');

insert into dt22_state(key,value)
select 'trader_lines',jsonb_agg(jsonb_build_object(
 'line_id',l.id,
 'response_status',case when l.line_position=3 then 'not_available' else 'quoted' end,
 'price_basis',case when l.line_position=3 then null else 'eur_t' end,
 'unit_price',case when l.line_position=3 then null else 870 end,
 'lead_time_days',8
) order by l.line_position)
from public.buyer_distinta_lines l
where l.distinta_id=(select (value->>'id')::uuid from dt22_state where key='distinta');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);

select pg_temp.dt22_assert(
 coalesce((public.rfqh4_get_portal(repeat('d',64))->>'valid')::boolean,false)=false,
 'unknown guest token must not reveal an RFQ'
);
select pg_temp.dt22_assert(
 (public.rfqh4_get_portal(repeat('a',64))->>'valid')='true'
 and (public.rfqh4_get_portal(repeat('b',64))->>'valid')='true',
 'both tokenized supplier portals are available to invited guests'
);

select public.rfqh4_save_quote(repeat('a',64),
 '{"incoterm":"EXW","lead_time_days":18,"notes":"PRODUCER_PRIVATE_2F93Q"}'::jsonb,
 (select value from dt22_state where key='producer_lines')
);
select pg_temp.dt22_assert(
 (public.rfqh4_submit_quote(repeat('a',64))->>'status')='submitted',
 'producer submits a complete 3/3 quote'
);

select public.rfqh4_save_quote(repeat('b',64),
 '{"incoterm":"DAP","lead_time_days":8,"notes":"TRADER_PRIVATE_7J28L"}'::jsonb,
 (select value from dt22_state where key='trader_lines')
);
select pg_temp.dt22_assert(
 (public.rfqh4_submit_quote(repeat('b',64))->>'status')='submitted',
 'trader submits 2/3 lines plus one explicit not-available response'
);
select pg_temp.dt22_assert(
 position('PRODUCER_PRIVATE_2F93Q' in public.rfqh4_get_portal(repeat('b',64))::text)=0
 and position('TRADER_PRIVATE_7J28L' in public.rfqh4_get_portal(repeat('a',64))::text)=0,
 'one supplier portal must not expose competitor notes or price terms'
);

select pg_temp.dt22_assert(
 (public.rfqh4_decline(repeat('c',64),'Processing capacity not available')->>'status')='declined',
 'processor can decline its invited opportunity'
);
select pg_temp.dt22_denied(
 $$select public.rfqh4_submit_quote(repeat('c',64))$$,
 'RFQ invite is not available'
);

reset role;
select pg_temp.dt22_assert(
 (select count(*)=2 from public.buyer_rfq_quotes q
  where q.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
    and q.status='submitted')
 and (select count(*)=1 from public.buyer_rfq_quotes q
  where q.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
    and q.status='declined'),
 'two submitted quotes and one declined supplier are recorded'
);
select pg_temp.dt22_assert(
 (select count(*)=3 from public.buyer_rfq_quote_lines ql
  join public.buyer_rfq_quotes q on q.id=ql.quote_id
  join public.buyer_rfq_suppliers s on s.id=q.supplier_id
  where s.supplier_organization_id='00000000-0000-0000-0000-000000002232'::uuid
    and ql.response_status='quoted')
 and (select count(*)=2 from public.buyer_rfq_quote_lines ql
  join public.buyer_rfq_quotes q on q.id=ql.quote_id
  join public.buyer_rfq_suppliers s on s.id=q.supplier_id
  where s.supplier_organization_id='00000000-0000-0000-0000-000000002233'::uuid
    and ql.response_status='quoted'),
 'quote normalization differentiates full 3/3 vs partial 2/3 cover'
);

-- Buyer only may compare competitors and confirm an award.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002202',true);
select pg_temp.dt22_denied(
 format('select public.rfqh5_quote_comparison(%L::uuid)',
 (select value->>'id' from dt22_state where key='rfq')),
 'RFQ not found or not accessible'
);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002203',true);
select pg_temp.dt22_denied(
 format('select public.rfqh7_confirm_award(%L::uuid,%L,%L::jsonb)',
 (select value->>'id' from dt22_state where key='rfq'),
 'Unauthorized award','[{"line_id":"00000000-0000-0000-0000-000000002245","supplier_id":"00000000-0000-0000-0000-000000002246","awarded_tonnes":1}]'),
 'RFQ not found or not accessible'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002201',true);
insert into dt22_state(key,value)
select 'comparison',public.rfqh5_quote_comparison((select (value->>'id')::uuid from dt22_state where key='rfq'));
select pg_temp.dt22_assert(
 jsonb_typeof((select value from dt22_state where key='comparison'))='object',
 'buyer obtains canonical normalized comparison JSON'
);
select pg_temp.dt22_assert(
 (select (value->'summary'->>'supplier_count')::int=3
         and (value->'summary'->>'comparable_supplier_count')::int=2
         and (value->'summary'->>'complete_offer_count')::int=1
         and (value->'summary'->>'declined_supplier_count')::int=1
  from dt22_state where key='comparison')
 and (select count(*)=1 from dt22_state t,
      jsonb_array_elements(t.value->'suppliers') s
      where t.key='comparison' and (s->>'fully_covered_lines')::int=3)
 and (select count(*)=1 from dt22_state t,
      jsonb_array_elements(t.value->'suppliers') s
      where t.key='comparison' and (s->>'fully_covered_lines')::int=2),
 'comparison must label 1 full 3/3 offer, 1 partial 2/3 offer, 1 decline'
);

insert into dt22_state(key,value)
select 'allocations',jsonb_agg(jsonb_build_object(
 'line_id',l.id,
 'supplier_id',case when l.line_position=2 then
  (select id from public.buyer_rfq_suppliers s
   where s.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
     and s.supplier_organization_id='00000000-0000-0000-0000-000000002233'::uuid)
 else
  (select id from public.buyer_rfq_suppliers s
   where s.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
     and s.supplier_organization_id='00000000-0000-0000-0000-000000002232'::uuid)
 end,
 'awarded_tonnes',l.line_tonnes
) order by l.line_position)
from public.buyer_distinta_lines l
where l.distinta_id=(select (value->>'id')::uuid from dt22_state where key='distinta');

-- Governed approval must be reviewed by a DIFFERENT buyer-team administrator.
select public.rfqh13_set_governance('00000000-0000-0000-0000-000000002231'::uuid,true,true);
select pg_temp.dt22_denied(
 format('select public.rfqh7_confirm_award(%L::uuid,%L,%L::jsonb)',
 (select value->>'id' from dt22_state where key='rfq'),
 'Split allocation after quote comparison',
 (select value::text from dt22_state where key='allocations')),
 'RFQH13 award approval required'
);

insert into dt22_state(key,value)
select 'award_approval',public.rfqh13_request_approval(
 (select (value->>'id')::uuid from dt22_state where key='rfq'),
 'award',null::uuid,
 'Split allocation after quote comparison',
 jsonb_build_object('allocations',(select value from dt22_state where key='allocations'))
);
select pg_temp.dt22_assert(
 (select value->>'status'='pending' from dt22_state where key='award_approval'),
 'split award requires an explicit pending approval'
);
select pg_temp.dt22_denied(
 format('select public.rfqh13_decide_approval(%L::uuid,%L,null)',
 (select value->>'approval_id' from dt22_state where key='award_approval'),
 'approved'),
 'Requester cannot approve or reject own request'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002211',true);
select pg_temp.dt22_assert(
 (public.rfqh13_decide_approval(
  (select (value->>'approval_id')::uuid from dt22_state where key='award_approval'),
  'approved','Approved in isolated DEMOTEST2.2'
 )->>'status')='approved',
 'independent buyer approver may approve the award'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002201',true);
insert into dt22_state(key,value)
select 'award',public.rfqh7_confirm_award(
 (select (value->>'id')::uuid from dt22_state where key='rfq'),
 'Split allocation after quote comparison',
 (select value from dt22_state where key='allocations')
);
select pg_temp.dt22_assert(
 (select value->>'award_mode'='split' and (value->>'supplier_count')::int=2
  from dt22_state where key='award')
 and (select count(*)=2 from public.buyer_purchase_order_drafts
      where rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')),
 'approved split award creates exactly two PO drafts, none externally sent'
);
select pg_temp.dt22_assert(
 (select count(*)=3 from public.buyer_purchase_order_lines l
  join public.buyer_purchase_order_drafts p on p.id=l.po_draft_id
  where p.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')),
 'draft PO lines cover the complete mixed-standard source request'
);

-- One PO is issued *within rollback transaction only*, to verify tokenized
-- supplier confirmation and immutable version snapshot, with NO provider call.
insert into dt22_state(key,value)
select 'po_draft',jsonb_build_object('id',p.id)
from public.buyer_purchase_order_drafts p
join public.buyer_rfq_suppliers s on s.id=p.supplier_id
where p.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
  and s.supplier_organization_id='00000000-0000-0000-0000-000000002232'::uuid;
insert into dt22_state(key,value)
values ('po_due',jsonb_build_object('date',(now()+interval '3 days')::text));

select pg_temp.dt22_denied(
 format('select public.rfqh9_prepare_issue(%L::uuid,%L,%L,%L,%L::timestamptz)',
 (select value->>'id' from dt22_state where key='po_draft'),
 repeat('d',64),'dt22-po-local-01','LOCAL ONLY, DO NOT SEND',
 (select value->>'date' from dt22_state where key='po_due')),
 'RFQH13 PO approval required'
);

insert into dt22_state(key,value)
select 'po_approval',public.rfqh13_request_approval(
 (select (value->>'id')::uuid from dt22_state where key='rfq'),
 'po_issue',
 (select (value->>'id')::uuid from dt22_state where key='po_draft'),
 'Validate local-only purchase order issue',
 jsonb_build_object(
 'buyer_message','LOCAL ONLY, DO NOT SEND',
 'confirmation_due_at',(select value->>'date' from dt22_state where key='po_due')
 ));
select pg_temp.dt22_assert(
 (select value->>'status'='pending' from dt22_state where key='po_approval'),
 'PO issue requires an independently approved snapshot'
);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002211',true);
select pg_temp.dt22_assert(
 (public.rfqh13_decide_approval(
   (select (value->>'approval_id')::uuid from dt22_state where key='po_approval'),
   'approved','Approved local PO acceptance only'
 )->>'status')='approved',
 'second buyer approver approves the PO version'
);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002201',true);
insert into dt22_state(key,value)
select 'po_version',public.rfqh9_prepare_issue(
 (select (value->>'id')::uuid from dt22_state where key='po_draft'),
 repeat('d',64),'dt22-po-local-01','LOCAL ONLY, DO NOT SEND',
 (select (value->>'date')::timestamptz from dt22_state where key='po_due')
);
select pg_temp.dt22_assert(
 (select length(value->>'snapshot_sha256')=64
         and (value->>'version_no')::int=1
  from dt22_state where key='po_version')
 and (select count(*)=1 from public.buyer_purchase_order_versions v
      where v.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
        and v.provider_message_id is null and v.delivery_status<>'sent'),
 'PO version must snapshot immutable hash without sending any provider message'
);

set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.dt22_assert(
 (public.rfqh9_supplier_portal(repeat('d',64))->>'valid')='true'
 and (public.rfqh9_supplier_portal(repeat('e',64))->>'valid')='false',
 'supplier PO portal exposes only a valid token'
);
select pg_temp.dt22_assert(
 (public.rfqh9_supplier_decide(
  repeat('d',64),'confirmed','Local-only confirmation',
  current_date+25,'DT22-CONF-01'
 )->>'decision')='confirmed',
 'supplier confirms local PO through issued version token'
);
select pg_temp.dt22_assert(
 (public.rfqh9_supplier_decide(
  repeat('d',64),'confirmed',null,null,null
 )->>'already_responded')='true',
 'replayed supplier confirmation is idempotent'
);

reset role;
select pg_temp.dt22_assert(
 (select count(*)=1 from public.buyer_purchase_order_supplier_responses r
  where r.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq'))
 and (select count(*)=1 from public.buyer_procurement_approvals a
      where a.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
        and a.action_type='award' and a.consumed_at is not null)
 and (select count(*)=1 from public.buyer_procurement_approvals a
      where a.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
        and a.action_type='po_issue' and a.consumed_at is not null),
 'one supplier confirmation and exactly two consumed independent approvals'
);
select pg_temp.dt22_assert(
 (select count(*)=0 from public.buyer_rfq_dispatch_messages m
  where m.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq'))
 and not exists(
  select 1 from public.buyer_rfq_dispatches d
  where d.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
    and d.provider_message_id is not null)
 and not exists(
  select 1 from public.buyer_purchase_order_versions v
  where v.rfq_id=(select (value->>'id')::uuid from dt22_state where key='rfq')
    and v.provider_message_id is not null),
 'no actual provider dispatch or PO delivery happened'
);

select 'DEMOTEST2.2 PASS — 4 tenants, 3 supplier tokens, 3/3 and 2/3 quotes, split award, independent approvals, local PO confirmed, ROLLBACK' as result;
rollback;
