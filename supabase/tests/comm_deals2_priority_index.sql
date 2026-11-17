-- COMM-DEALS2 acceptance: one row per deal, priority over the whole
-- organization, exact counters, filters, literal search and tenant isolation.
-- Bucket rules mirror apps/web/lib/commercial-deal-model.ts.
begin;

create or replace function pg_temp.cd2_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'COMM-DEALS2 assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users(id, email) values
('00000000-0000-0000-0000-00000000d2a1', 'cd2-a@example.com'),
('00000000-0000-0000-0000-00000000d2b1', 'cd2-b@example.com');

insert into public.organizations(id, name, slug, created_by, onboarding_status) values
('00000000-0000-0000-0000-00000000d2f1', 'CD2 Org A', 'cd2-org-a', '00000000-0000-0000-0000-00000000d2a1', 'completed'),
('00000000-0000-0000-0000-00000000d2f2', 'CD2 Org B', 'cd2-org-b', '00000000-0000-0000-0000-00000000d2b1', 'completed');

insert into public.organization_memberships(organization_id, user_id, role, business_role, status, is_default) values
('00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d2a1', 'admin', 'sales_director', 'active', true),
('00000000-0000-0000-0000-00000000d2f2', '00000000-0000-0000-0000-00000000d2b1', 'admin', 'sales_director', 'active', true);

insert into public.companies(id, owner_id, organization_id, name, company_type, country) values
('00000000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', 'Rossi Costruzioni', 'customer', 'IT'),
('00000000-0000-0000-0000-00000000d202', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', 'Metalcarp', 'customer', 'IT');

-- Sales: 1) request + sent offer + received order (one deal, «todo»)
--        2) request due tomorrow, nothing else (todo, due → first)
--        3) request with a sent offer (waiting)
--        4) request closed_won (closed)
insert into public.rfqs(id, owner_id, organization_id, company_id, requested_at, status, priority, due_at, created_at) values
('00000000-0000-0000-0000-00000000d211', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d201', now(), 'quoted', 'normal', null, now() - interval '20 days'),
('00000000-0000-0000-0000-00000000d212', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d202', now(), 'new', 'normal', now() + interval '1 day', now() - interval '30 days'),
('00000000-0000-0000-0000-00000000d213', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d202', now(), 'quoted', 'normal', null, now() - interval '5 days'),
('00000000-0000-0000-0000-00000000d214', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d201', now(), 'closed_won', 'normal', null, now() - interval '1 day');

insert into public.rfq_lines(id, owner_id, organization_id, rfq_id, requested_quantity, quantity_unit, requested_standard, requested_grade) values
('00000000-0000-0000-0000-00000000d221', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d212', 24, 'barre', 'EN 10219', 'S355J2H');

insert into public.offers(id, owner_id, organization_id, rfq_id, status, currency, offered_at, created_at) values
('00000000-0000-0000-0000-00000000d231', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d211', 'sent', 'EUR', now(), now() - interval '10 days'),
('00000000-0000-0000-0000-00000000d232', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d213', 'sent', 'EUR', now(), now() - interval '4 days');

insert into public.orders(id, owner_id, organization_id, rfq_id, offer_id, status, ordered_at, created_at) values
('00000000-0000-0000-0000-00000000d241', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d211', '00000000-0000-0000-0000-00000000d231', 'received', now(), now() - interval '2 days');

-- Purchase: a used bill of material + draft campaign, a free bill of material,
-- a launched campaign without responses (waiting).
insert into public.buyer_distintas(id, owner_user_id, organization_id, title, line_count, total_meters, total_tonnes) values
('00000000-0000-0000-0000-00000000d251', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', 'CD2 usata', 1, 72, 1.8),
('00000000-0000-0000-0000-00000000d252', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', 'CD2 libera', 1, 72, 1.8),
('00000000-0000-0000-0000-00000000d253', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', 'CD2 inviata', 1, 72, 1.8);

insert into public.buyer_rfq_campaigns(id, owner_user_id, organization_id, source_distinta_id, title, status, due_at) values
('00000000-0000-0000-0000-00000000d261', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d251', 'CD2 RFQ bozza 50% sconto', 'draft', now() + interval '14 days'),
('00000000-0000-0000-0000-00000000d262', '00000000-0000-0000-0000-00000000d2a1', '00000000-0000-0000-0000-00000000d2f1', '00000000-0000-0000-0000-00000000d253', 'CD2 RFQ inviata', 'draft', now() + interval '20 days');
-- Launch via status update so any launch-time guards on insert do not apply.
update public.buyer_rfq_campaigns set status = 'collecting' where id = '00000000-0000-0000-0000-00000000d262';

create temporary table cd2_result(label text primary key, payload jsonb) on commit drop;
grant all on cd2_result to authenticated;

-- Caller A (member of org A), through RLS.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000d2a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d2a1","role":"authenticated"}', true);

insert into cd2_result values
('all', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1')),
('page2', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'all', '', '', 2, 2)),
('todo', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'all', 'todo')),
('drafts', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'all', 'drafts')),
('purchase', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'purchase')),
('search', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'all', '', 'rossi')),
('literal', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'all', 'drafts', '50%')),
('wildcard', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'all', 'drafts', '_')),
('percent', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1', 'all', 'drafts', 'D2%R'));

-- Caller B (other tenant) asking for org A gets nothing.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000d2b1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d2b1","role":"authenticated"}', true);
insert into cd2_result values ('alien', public.comm_deals2_index('00000000-0000-0000-0000-00000000d2f1'));
reset role;

-- One row per deal: 4 sales + 2 campaigns; the free bill of material is not in «Tutte».
select pg_temp.cd2_assert((select (payload->>'total')::int = 6 from cd2_result where label = 'all'), 'six deals in Tutte');
select pg_temp.cd2_assert((
  select array_agg(k->>'key' order by ord) = array[
    'inbound-rfq:00000000-0000-0000-0000-00000000d212',   -- todo, due tomorrow
    'inbound-rfq:00000000-0000-0000-0000-00000000d211',   -- todo: confirm the received order
    'campaign:00000000-0000-0000-0000-00000000d261',      -- draft RFQ
    'campaign:00000000-0000-0000-0000-00000000d262',      -- waiting for suppliers (most recent)
    'inbound-rfq:00000000-0000-0000-0000-00000000d213',   -- waiting for the customer
    'inbound-rfq:00000000-0000-0000-0000-00000000d214'    -- closed last
  ]
  from cd2_result, jsonb_array_elements(payload->'keys') with ordinality as t(k, ord) where label = 'all'
), 'priority order over the whole organization');
select pg_temp.cd2_assert((
  select array_agg(k->>'key' order by ord) = array['campaign:00000000-0000-0000-0000-00000000d261', 'campaign:00000000-0000-0000-0000-00000000d262']
  from cd2_result, jsonb_array_elements(payload->'keys') with ordinality as t(k, ord) where label = 'page2'
), 'pagination continues the same order');
select pg_temp.cd2_assert((
  select payload->'counts' = '{"segments":{"all":5,"sales":3,"purchase":2},"filters":{"todo":2,"waiting":2,"due":1,"drafts":2,"closed":1}}'::jsonb
  from cd2_result where label = 'all'
), 'exact counters');
select pg_temp.cd2_assert((select (payload->>'total')::int = 2 from cd2_result where label = 'todo'), 'todo filter');
select pg_temp.cd2_assert((
  select array_agg(k->>'key' order by k->>'key') = array['campaign:00000000-0000-0000-0000-00000000d261', 'distinta:00000000-0000-0000-0000-00000000d252']
  from cd2_result, jsonb_array_elements(payload->'keys') as k where label = 'drafts'
), 'drafts: draft RFQ plus the unused bill of material only');
select pg_temp.cd2_assert((
  select (payload->>'total')::int = 2 and (payload->'counts'->'filters'->>'todo')::int = 0
  from cd2_result where label = 'purchase'
), 'purchase segment');
select pg_temp.cd2_assert((select (payload->>'total')::int = 2 from cd2_result where label = 'search'), 'search by customer');
select pg_temp.cd2_assert((select (payload->>'total')::int = 1 from cd2_result where label = 'literal'), 'percent sign is literal');
select pg_temp.cd2_assert((select (payload->>'total')::int = 0 from cd2_result where label = 'wildcard'), 'underscore is literal');
select pg_temp.cd2_assert((select (payload->>'total')::int = 0 from cd2_result where label = 'percent'), 'percent is not a wildcard');
select pg_temp.cd2_assert((
  select (payload->>'total')::int = 0 and (payload->'counts'->'segments'->>'all')::int = 0
  from cd2_result where label = 'alien'
), 'another tenant sees nothing');

rollback;
select 'COMM-DEALS2 priority index acceptance passed' as result;
