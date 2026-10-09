-- DEMOTEST2.1 — Four-tenant DB/RLS/RFQ acceptance
-- Execute ONLY against disposable, local Supabase (supabase start + db reset).
-- All identities/companies are invented; all changes ROLLBACK.
-- No SMTP, Resend, provider dispatch, Marketplace publication or production DB writes.
\set ON_ERROR_STOP on
begin;

create temp table demotest2_state (
  key text primary key,
  value jsonb not null
) on commit drop;
grant select,insert,update,delete on demotest2_state to authenticated;

create or replace function pg_temp.dt2_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'DEMOTEST2 assertion failed: %', message;
  end if;
end;
$$;
grant execute on function pg_temp.dt2_assert(boolean,text) to authenticated;

create or replace function pg_temp.dt2_deny(statement text, reason text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate in ('42501','P0001') or
       lower(sqlerrm) like '%not owned%' or
       lower(sqlerrm) like '%not accessible%' or
       lower(sqlerrm) like '%access denied%' then
      return;
    end if;
    raise exception 'DEMOTEST2 unexpected error for %: %',reason,sqlerrm;
  end;
  raise exception 'DEMOTEST2 cross-tenant action unexpectedly succeeded: %',reason;
end;
$$;
grant execute on function pg_temp.dt2_deny(text,text) to authenticated;

-- The local DB is empty, unlike real production. Provision an owner ONLY in
-- disposable CI; this is NOT a production privilege mutation.
do $$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-0000000020ff','demotest2-owner@example.test',now());
    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values ('00000000-0000-0000-0000-0000000020ff',
            'platform_superadmin','active',null,
            'DEMOTEST2 disposable local test owner');
  end if;
end $$;

insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000002001','buyer@example.test',now()),
 ('00000000-0000-0000-0000-000000002002','producer@example.test',now()),
 ('00000000-0000-0000-0000-000000002003','trader@example.test',now()),
 ('00000000-0000-0000-0000-000000002004','processor@example.test',now()),
 ('00000000-0000-0000-0000-000000002011','buyer-rep@example.test',now()),
 ('00000000-0000-0000-0000-000000002012','producer-rep@example.test',now()),
 ('00000000-0000-0000-0000-000000002013','trader-rep@example.test',now()),
 ('00000000-0000-0000-0000-000000002014','processor-rep@example.test',now());

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

-- Registration must be explicit. A submitted application cannot activate itself.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002001',true);
insert into public.company_registration_applications(id,legal_name,country_code,primary_company_type,contact_name)
values ('00000000-0000-0000-0000-000000002021','DEMO Industrial Engineering','IT','end_user','Demo Buyer');
select public.p0a_submit_registration_application('00000000-0000-0000-0000-000000002021');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002002',true);
insert into public.company_registration_applications(id,legal_name,country_code,primary_company_type,contact_name)
values ('00000000-0000-0000-0000-000000002022','DEMO Steel Manufacturing','IT','producer','Demo Producer');
select public.p0a_submit_registration_application('00000000-0000-0000-0000-000000002022');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002003',true);
insert into public.company_registration_applications(id,legal_name,country_code,primary_company_type,contact_name)
values ('00000000-0000-0000-0000-000000002023','DEMO Tubes Trading','IT','trader_distributor','Demo Trader');
select public.p0a_submit_registration_application('00000000-0000-0000-0000-000000002023');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002004',true);
insert into public.company_registration_applications(id,legal_name,country_code,primary_company_type,contact_name)
values ('00000000-0000-0000-0000-000000002024','DEMO Steel Processing','IT','processor_service_provider','Demo Processor');
select public.p0a_submit_registration_application('00000000-0000-0000-0000-000000002024');

select pg_temp.dt2_assert(
  (select count(*)=4 from public.company_registration_applications
   where id in ('00000000-0000-0000-0000-000000002021'::uuid,
                '00000000-0000-0000-0000-000000002022'::uuid,
                '00000000-0000-0000-0000-000000002023'::uuid,
                '00000000-0000-0000-0000-000000002024'::uuid)
     and application_status='submitted' and activated_organization_id is null),
  'four applications require platform approval and are not auto-activated'
);
select pg_temp.dt2_deny(
  $$select public.p0a_activate_registration_application('00000000-0000-0000-0000-000000002024'::uuid)$$,
  'applicant cannot self-activate organization'
);

-- Platform review and activation are separate, audited operations.
select set_config(
 'request.jwt.claim.sub',
 (select user_id::text from public.platform_user_roles
  where role='platform_superadmin' and status='active' limit 1),
 true
);
select public.p0a_approve_registration_application('00000000-0000-0000-0000-000000002021');
select public.p0a_approve_registration_application('00000000-0000-0000-0000-000000002022');
select public.p0a_approve_registration_application('00000000-0000-0000-0000-000000002023');
select public.p0a_approve_registration_application('00000000-0000-0000-0000-000000002024');

insert into demotest2_state(key,value) values
 ('buyer',public.p0a_activate_registration_application('00000000-0000-0000-0000-000000002021')),
 ('producer',public.p0a_activate_registration_application('00000000-0000-0000-0000-000000002022')),
 ('trader',public.p0a_activate_registration_application('00000000-0000-0000-0000-000000002023')),
 ('processor',public.p0a_activate_registration_application('00000000-0000-0000-0000-000000002024'));

select pg_temp.dt2_assert(
  (select count(*)=4 from demotest2_state
   where value->>'status'='activated'
     and value->>'network_link_status'='active'
     and value->>'network_company_id' is not null
     and value->>'claim_id' is not null),
  'each company activation creates an organization, Network link and governed claim'
);
select pg_temp.dt2_assert(
  (select count(distinct value->>'organization_id')=4 from demotest2_state),
  'all four organizations are distinct tenants'
);

-- Platform privileges must never pass to ordinary company accounts.
select pg_temp.dt2_assert(
 not exists (select 1 from public.platform_user_roles
             where user_id in (select id from auth.users
                               where id::text like '00000000-0000-0000-0000-0000000020%')
               and id is not null
               and role='platform_superadmin'
               and user_id <> '00000000-0000-0000-0000-0000000020ff'::uuid),
 'four company admins and reps must not become Platform Superadmin'
);

-- Simulate secondary team members in *local* DB only, leaving invitation/email
-- sending to a separate E2E browser gate.
reset role;
insert into public.organization_memberships(
 organization_id,user_id,role,business_role,status,is_default
)
select (s.value->>'organization_id')::uuid,
       case s.key
         when 'buyer' then '00000000-0000-0000-0000-000000002011'::uuid
         when 'producer' then '00000000-0000-0000-0000-000000002012'::uuid
         when 'trader' then '00000000-0000-0000-0000-000000002013'::uuid
         else '00000000-0000-0000-0000-000000002014'::uuid end,
       'member','salesperson','active',true
from demotest2_state s;

select pg_temp.dt2_assert(
  (select count(*)=8 from public.organization_memberships
   where organization_id in
     (select (value->>'organization_id')::uuid from demotest2_state)
     and status='active'),
  'four tenant admins plus four staff must be active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002001',true);

-- Actual server-side Buyer Distinta RPC, mixing EN 10219 and EN 10210.
insert into demotest2_state(key,value)
select 'distinta',jsonb_build_object('id',public.buyer_create_distinta_snapshot(
 '{"title":"DEMOTEST2 mixed EN 10210 + EN 10219","total_meters":1320,"total_tonnes":16.32}'::jsonb,
 '[
 {"description":"RHS 200 x 100 x 6","standard":"EN 10219","grade":"S355J2H",
  "quantity_mode":"bars","quantity":40,"bar_length_m":12,"weight_kg_m":26.5,
  "line_meters":480,"line_tonnes":12.72},
 {"description":"CHS 168.3 x 6.3","standard":"EN 10210","grade":"S355J2H",
  "quantity_mode":"bars","quantity":80,"bar_length_m":6,"weight_kg_m":5,
  "line_meters":480,"line_tonnes":2.4},
 {"description":"SHS 100 x 100 x 5","standard":"EN 10219","grade":"S235JRH",
  "quantity_mode":"bars","quantity":60,"bar_length_m":6,"weight_kg_m":3.3333333,
  "line_meters":360,"line_tonnes":1.2}
 ]'::jsonb
)) ;

select pg_temp.dt2_assert(
  (select count(*)=3 and count(distinct standard_code)=2
   from public.buyer_distinta_lines
   where distinta_id=(select (value->>'id')::uuid from demotest2_state where key='distinta')),
  'mixed Distinta preserves three lines and two technical standards'
);
select pg_temp.dt2_assert(
  (select organization_id=(select (value->>'organization_id')::uuid from demotest2_state where key='buyer')
   from public.buyer_distintas
   where id=(select (value->>'id')::uuid from demotest2_state where key='distinta')),
  'buyer Distinta is scoped to its buyer tenant'
);

insert into demotest2_state(key,value)
select 'rfq',jsonb_build_object('id',
 public.rfqh1_create_campaign_from_distinta(
   (select (value->>'id')::uuid from demotest2_state where key='distinta'),
   now()+interval '7 days',
   'DEMOTEST2: local fixture, never dispatch externally'
 ));

select pg_temp.dt2_assert(
 (select source_distinta_id=(select (value->>'id')::uuid from demotest2_state where key='distinta')
    and organization_id=(select (value->>'organization_id')::uuid from demotest2_state where key='buyer')
    and status='draft'
  from public.buyer_rfq_campaigns
  where id=(select (value->>'id')::uuid from demotest2_state where key='rfq')),
 'RFQ created by RPC inherits buyer org and exact mixed Distinta'
);

-- Real server-side supplier-selection RPC, but no launch/dispatch calls.
select public.rfqh1_add_supplier(
 (select (value->>'id')::uuid from demotest2_state where key='rfq'),
 'DEMO Steel Manufacturing','offers@producer.example.test',null,null
);
select public.rfqh1_add_supplier(
 (select (value->>'id')::uuid from demotest2_state where key='rfq'),
 'DEMO Tubes Trading','offers@trader.example.test',null,null
);
select public.rfqh1_add_supplier(
 (select (value->>'id')::uuid from demotest2_state where key='rfq'),
 'DEMO Steel Processing','jobs@processor.example.test',null,null
);

select pg_temp.dt2_assert(
  (select count(*)=3 from public.buyer_rfq_suppliers
   where rfq_id=(select (value->>'id')::uuid from demotest2_state where key='rfq')),
  'three suppliers selected without sending any email'
);
select pg_temp.dt2_assert(
  not exists (select 1 from public.buyer_rfq_dispatches d
              where d.rfq_id=(select (value->>'id')::uuid from demotest2_state where key='rfq'))
  and not exists (select 1 from public.buyer_rfq_marketplace_bridges b
                  where b.rfq_id=(select (value->>'id')::uuid from demotest2_state where key='rfq'))
  and (select marketplace_request_id is null from public.buyer_rfq_campaigns
       where id=(select (value->>'id')::uuid from demotest2_state where key='rfq')),
  'supplier selection must not dispatch or publish to Marketplace'
);
select pg_temp.dt2_assert(
  jsonb_typeof(public.rfqh5_quote_comparison(
    (select (value->>'id')::uuid from demotest2_state where key='rfq')
  ))='object',
  'RFQ quote comparison returns a structured buyer-only document'
);

-- Three non-buyer tenants + buyer colleague must NOT see the private Distinta
-- or run owner-only RFQ actions. Test actual RLS under their jwt identities.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002002',true);
select pg_temp.dt2_assert(
 (select count(*)=0 from public.buyer_distintas where
   id=(select (value->>'id')::uuid from demotest2_state where key='distinta'))
 and (select count(*)=0 from public.buyer_rfq_campaigns where
   id=(select (value->>'id')::uuid from demotest2_state where key='rfq')),
 'producer cannot read buyer Distinta or RFQ despite being invited'
);
select pg_temp.dt2_deny(
 format('select public.rfqh5_quote_comparison(%L::uuid)',
    (select value->>'id' from demotest2_state where key='rfq')),
 'producer must not read buyer comparison'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002003',true);
select pg_temp.dt2_assert(
 (select count(*)=0 from public.buyer_rfq_campaigns where
   id=(select (value->>'id')::uuid from demotest2_state where key='rfq')),
 'trader cannot read buyer RFQ'
);
select pg_temp.dt2_deny(
 format('select public.rfqh1_add_supplier(%L::uuid,%L,%L,null,null)',
    (select value->>'id' from demotest2_state where key='rfq'),
    'Unauthorized supplier','blocked@example.test'),
 'trader cannot change buyer RFQ supplier list'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002004',true);
select pg_temp.dt2_assert(
 (select count(*)=0 from public.buyer_distinta_lines where
   distinta_id=(select (value->>'id')::uuid from demotest2_state where key='distinta')),
 'processor cannot browse undisclosed buyer specification'
);
select pg_temp.dt2_deny(
 format('select public.rfqh1_create_campaign_from_distinta(%L::uuid,null,null)',
    (select value->>'id' from demotest2_state where key='distinta')),
 'processor cannot create RFQ from another company Distinta'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002011',true);
select pg_temp.dt2_assert(
 (select count(*)=0 from public.buyer_distintas where
   id=(select (value->>'id')::uuid from demotest2_state where key='distinta')),
 'same-organization staff cannot see owner-personal Distinta without delegation'
);

-- Role suspension revokes organization selection in the same JWT context.
reset role;
update public.organization_memberships set status='suspended'
where user_id='00000000-0000-0000-0000-000000002011'::uuid;
set local role authenticated;
select pg_temp.dt2_assert(
 public.default_organization_for_user('00000000-0000-0000-0000-000000002011'::uuid) is null,
 'suspended teammate must no longer resolve an active organization'
);

-- Last check: no actual outbound call was made, and all writes are ephemeral.
select pg_temp.dt2_assert(
 (select count(*)=0 from public.buyer_rfq_dispatch_messages m
  where m.rfq_id=(select (value->>'id')::uuid from demotest2_state where key='rfq'))
 and (select count(*)=0 from public.buyer_purchase_order_versions v
  where v.rfq_id=(select (value->>'id')::uuid from demotest2_state where key='rfq')),
 'no emails or purchase orders are queued, issued or simulated as live'
);

select 'DEMOTEST2.1 PASS — 4 activated tenants; 8 persons; mixed RFQ; 3 suppliers; tenant isolation; no dispatch' as result;
rollback;
