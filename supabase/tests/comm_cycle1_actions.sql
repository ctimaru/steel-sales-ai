-- COMM-CYCLE1 acceptance: actions and outcomes of the commercial cycle.
-- Allowed transitions, closing as «non conclusa» with reason and exact reopen,
-- office profiles (Ufficio commerciale / acquisti / Direzione), tenant
-- isolation, append-only log, and the expired-offer rule of the index.
begin;

create or replace function pg_temp.cc1_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'COMM-CYCLE1 assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.cc1_as(uid text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;

-- Same session role switch as the other acceptance tests.
create or replace function pg_temp.cc1_denied(p_org uuid, p_kind text, p_id uuid, p_action text, p_reason text default null)
returns text language plpgsql as $$
begin
  perform public.comm_cycle1_apply(p_org, p_kind, p_id, p_action, null, p_reason, null);
  return 'ACCEPTED';
exception when others then
  return sqlerrm;
end;
$$;

insert into auth.users(id, email) values
('00000000-0000-0000-0000-00000000c1a1', 'cc1-direction@example.com'),
('00000000-0000-0000-0000-00000000c1a2', 'cc1-purchasing@example.com'),
('00000000-0000-0000-0000-00000000c1a3', 'cc1-sales@example.com'),
('00000000-0000-0000-0000-00000000c1b1', 'cc1-other@example.com');

insert into public.organizations(id, name, slug, created_by, onboarding_status) values
('00000000-0000-0000-0000-00000000c1f1', 'CC1 Org A', 'cc1-org-a', '00000000-0000-0000-0000-00000000c1a1', 'completed'),
('00000000-0000-0000-0000-00000000c1f2', 'CC1 Org B', 'cc1-org-b', '00000000-0000-0000-0000-00000000c1b1', 'completed');

insert into public.organization_memberships(organization_id, user_id, role, business_role, status, is_default) values
('00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c1a1', 'admin', 'sales_director', 'active', true),
('00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c1a2', 'member', 'purchasing', 'active', true),
('00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c1a3', 'member', 'salesperson', 'active', true),
('00000000-0000-0000-0000-00000000c1f2', '00000000-0000-0000-0000-00000000c1b1', 'admin', 'sales_director', 'active', true);

-- r1: new request with a draft offer (2 lines) → full happy path to delivered.
-- r2: request with a sent offer expired yesterday → «todo», then closed and reopened.
-- o1: order without request or offer, received.
insert into public.rfqs(id, owner_id, organization_id, requested_at, status, priority, created_at) values
('00000000-0000-0000-0000-00000000c111', '00000000-0000-0000-0000-00000000c1a1', '00000000-0000-0000-0000-00000000c1f1', now(), 'new', 'normal', now() - interval '3 days'),
('00000000-0000-0000-0000-00000000c112', '00000000-0000-0000-0000-00000000c1a1', '00000000-0000-0000-0000-00000000c1f1', now(), 'quoted', 'normal', now() - interval '20 days');

insert into public.offers(id, owner_id, organization_id, rfq_id, status, currency, offered_at, valid_until, created_at) values
('00000000-0000-0000-0000-00000000c121', '00000000-0000-0000-0000-00000000c1a1', '00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c111', 'draft', 'EUR', null, current_date + 10, now() - interval '2 days'),
('00000000-0000-0000-0000-00000000c122', '00000000-0000-0000-0000-00000000c1a1', '00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c112', 'sent', 'EUR', now() - interval '15 days', current_date - 1, now() - interval '15 days');

insert into public.offer_lines(id, owner_id, organization_id, offer_id, quantity, quantity_unit, canonical_product_key) values
('00000000-0000-0000-0000-00000000c131', '00000000-0000-0000-0000-00000000c1a1', '00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c121', 9, 'pz', 'tube:v1|family=square_tube|grade=s355j2h|standard=en10219|material=_|geom=80x80|t=10|process=_'),
('00000000-0000-0000-0000-00000000c132', '00000000-0000-0000-0000-00000000c1a1', '00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c121', 4, 'pz', null);

insert into public.orders(id, owner_id, organization_id, status, ordered_at, created_at) values
('00000000-0000-0000-0000-00000000c141', '00000000-0000-0000-0000-00000000c1a1', '00000000-0000-0000-0000-00000000c1f1', 'received', now(), now() - interval '1 day');

insert into public.buyer_distintas(id, owner_user_id, organization_id, title, line_count, total_meters, total_tonnes) values
('00000000-0000-0000-0000-00000000c151', '00000000-0000-0000-0000-00000000c1a2', '00000000-0000-0000-0000-00000000c1f1', 'CC1 distinta', 1, 72, 1.8);
insert into public.buyer_rfq_campaigns(id, owner_user_id, organization_id, source_distinta_id, title, status) values
('00000000-0000-0000-0000-00000000c161', '00000000-0000-0000-0000-00000000c1a2', '00000000-0000-0000-0000-00000000c1f1', '00000000-0000-0000-0000-00000000c151', 'CC1 RFQ fornitori', 'draft');
update public.buyer_rfq_campaigns set status = 'collecting', launched_at = now() where id = '00000000-0000-0000-0000-00000000c161';

create temporary table cc1_result(label text primary key, value text) on commit drop;
grant all on cc1_result to authenticated;

-- ── Index before any action: r2's offer expired yesterday → «todo» ──────────
set local role authenticated;
select pg_temp.cc1_as('00000000-0000-0000-0000-00000000c1a3');
insert into cc1_result values ('index_todo',
  (select string_agg(k->>'key', ',' order by k->>'key') from jsonb_array_elements(
    public.comm_deals2_index('00000000-0000-0000-0000-00000000c1f1', 'sales', 'todo')->'keys') k));

-- ── Salesperson: the whole sales path on r1 ─────────────────────────────────
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c111', 'take_charge');
insert into cc1_result values ('r1_taken', (select status || '/' || coalesce(assigned_to_user_id::text, '-') from public.rfqs where id = '00000000-0000-0000-0000-00000000c111'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'offer', '00000000-0000-0000-0000-00000000c121', 'offer_sent');
insert into cc1_result values ('r1_after_sent', (select status from public.rfqs where id = '00000000-0000-0000-0000-00000000c111'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'offer', '00000000-0000-0000-0000-00000000c121', 'offer_accepted');
insert into cc1_result values ('order_id', (public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'offer', '00000000-0000-0000-0000-00000000c121', 'order_registered', null, null, null, 'PO-CC1'))->>'order_id');
insert into cc1_result values ('double_order', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'offer', '00000000-0000-0000-0000-00000000c121', 'order_registered'));
insert into cc1_result values ('take_twice', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c111', 'take_charge'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'order', (select value::uuid from cc1_result where label = 'order_id'), 'order_confirmed');
insert into cc1_result values ('close_confirmed_order', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c111', 'close_lost', 'price'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'order', (select value::uuid from cc1_result where label = 'order_id'), 'order_status', 'delivered');
insert into cc1_result values ('backwards', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'order', (select value::uuid from cc1_result where label = 'order_id'), 'order_confirmed'));

-- ── Salesperson: close r2 as lost, then reopen ──────────────────────────────
insert into cc1_result values ('no_reason', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c112', 'close_lost'));
insert into cc1_result values ('other_no_note', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c112', 'close_lost', 'other'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c112', 'close_lost', null, 'offer_expired', 'Cliente sparito');
insert into cc1_result values ('r2_closed', (select r.status || '/' || f.status from public.rfqs r join public.offers f on f.rfq_id = r.id where r.id = '00000000-0000-0000-0000-00000000c112'));
insert into cc1_result values ('index_closed',
  (select string_agg(k->>'key', ',' order by k->>'key') from jsonb_array_elements(
    public.comm_deals2_index('00000000-0000-0000-0000-00000000c1f1', 'sales', 'closed')->'keys') k));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c112', 'reopen');
insert into cc1_result values ('r2_reopened', (select r.status || '/' || f.status from public.rfqs r join public.offers f on f.rfq_id = r.id where r.id = '00000000-0000-0000-0000-00000000c112'));
insert into cc1_result values ('reopen_twice', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'rfq', '00000000-0000-0000-0000-00000000c112', 'reopen'));

-- ── Salesperson cannot close a supplier RFQ; the log is not writable ────────
insert into cc1_result values ('sales_on_campaign', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'campaign', '00000000-0000-0000-0000-00000000c161', 'close_lost', 'no_response'));
do $$
begin
  insert into public.comm_deal_events(organization_id, deal_kind, deal_id, record_kind, record_id, action, actor_user_id)
  values ('00000000-0000-0000-0000-00000000c1f1', 'inbound-order', gen_random_uuid(), 'order', gen_random_uuid(), 'reopen', '00000000-0000-0000-0000-00000000c1a3');
  insert into cc1_result values ('direct_insert', 'ACCEPTED');
exception when others then
  insert into cc1_result values ('direct_insert', sqlerrm);
end $$;
insert into cc1_result values ('events_a', (select count(*)::text from public.comm_deal_events));

-- ── Purchasing office closes and reopens the supplier RFQ ───────────────────
reset role;
set local role authenticated;
select pg_temp.cc1_as('00000000-0000-0000-0000-00000000c1a2');
insert into cc1_result values ('purchasing_on_sales', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'order', '00000000-0000-0000-0000-00000000c141', 'close_lost', 'price'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'campaign', '00000000-0000-0000-0000-00000000c161', 'close_lost', null, 'no_response');
insert into cc1_result values ('campaign_closed', (select status || '/' || (closed_at is not null)::text from public.buyer_rfq_campaigns where id = '00000000-0000-0000-0000-00000000c161'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'campaign', '00000000-0000-0000-0000-00000000c161', 'reopen');
insert into cc1_result values ('campaign_reopened', (select status || '/' || (closed_at is not null)::text from public.buyer_rfq_campaigns where id = '00000000-0000-0000-0000-00000000c161'));

-- ── Direction closes the orphan order as lost ───────────────────────────────
reset role;
set local role authenticated;
select pg_temp.cc1_as('00000000-0000-0000-0000-00000000c1a1');
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c1f1', 'order', '00000000-0000-0000-0000-00000000c141', 'close_lost', null, 'cancelled_by_customer');
insert into cc1_result values ('o1_closed', (select status from public.orders where id = '00000000-0000-0000-0000-00000000c141'));

-- ── Other tenant: no actions, no events ─────────────────────────────────────
reset role;
set local role authenticated;
select pg_temp.cc1_as('00000000-0000-0000-0000-00000000c1b1');
insert into cc1_result values ('alien_action', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f1', 'order', '00000000-0000-0000-0000-00000000c141', 'reopen'));
insert into cc1_result values ('alien_cross_org', pg_temp.cc1_denied('00000000-0000-0000-0000-00000000c1f2', 'order', '00000000-0000-0000-0000-00000000c141', 'reopen'));
insert into cc1_result values ('events_b', (select count(*)::text from public.comm_deal_events));
reset role;

-- ── Assertions ──────────────────────────────────────────────────────────────
select pg_temp.cc1_assert((select value like '%inbound-rfq:00000000-0000-0000-0000-00000000c112%' from cc1_result where label = 'index_todo'), 'expired sent offer is todo');
select pg_temp.cc1_assert((select value = 'in_progress/00000000-0000-0000-0000-00000000c1a3' from cc1_result where label = 'r1_taken'), 'take charge assigns the caller');
select pg_temp.cc1_assert((select value = 'quoted' from cc1_result where label = 'r1_after_sent'), 'sent offer marks the request quoted');
select pg_temp.cc1_assert((select value like '%ha già un ordine%' from cc1_result where label = 'double_order'), 'one order per accepted offer');
select pg_temp.cc1_assert((select value like '%già in lavorazione%' from cc1_result where label = 'take_twice'), 'take charge only once');
select pg_temp.cc1_assert((select value like '%ordine confermato o in corso%' from cc1_result where label = 'close_confirmed_order'), 'no lost close with a running order');
select pg_temp.cc1_assert((select count(*) = 2 from public.order_lines where order_id = (select value::uuid from cc1_result where label = 'order_id')), 'order lines copied from the offer');
select pg_temp.cc1_assert((select status = 'delivered' and customer_order_ref = 'PO-CC1' from public.orders where id = (select value::uuid from cc1_result where label = 'order_id')), 'order delivered with reference');
select pg_temp.cc1_assert((select status = 'closed_won' from public.rfqs where id = '00000000-0000-0000-0000-00000000c111'), 'delivered order wins the request');
select pg_temp.cc1_assert((select value like '%solo un ordine ricevuto%' from cc1_result where label = 'backwards'), 'no going back');
select pg_temp.cc1_assert((select value like '%indica il motivo%' from cc1_result where label = 'no_reason'), 'reason required');
select pg_temp.cc1_assert((select value like '%serve una nota%' from cc1_result where label = 'other_no_note'), 'note required with other');
select pg_temp.cc1_assert((select value = 'closed_lost/rejected' from cc1_result where label = 'r2_closed'), 'close cascades to the offer');
select pg_temp.cc1_assert((select value like '%inbound-rfq:00000000-0000-0000-0000-00000000c112%' from cc1_result where label = 'index_closed'), 'closed deal in Archiviate');
select pg_temp.cc1_assert((select value = 'quoted/sent' from cc1_result where label = 'r2_reopened'), 'reopen restores exact statuses');
select pg_temp.cc1_assert((select value like '%non è chiusa%' from cc1_result where label = 'reopen_twice'), 'reopen only once');
select pg_temp.cc1_assert((select value like 'office_profile_read_only%' from cc1_result where label = 'sales_on_campaign'), 'sales office cannot close supplier RFQs');
select pg_temp.cc1_assert((select value like 'office_profile_read_only%' from cc1_result where label = 'purchasing_on_sales'), 'purchasing office cannot close sales deals');
select pg_temp.cc1_assert((select value like '%permission denied%' from cc1_result where label = 'direct_insert'), 'log written only by the function');
select pg_temp.cc1_assert((select value::int >= 8 from cc1_result where label = 'events_a'), 'members read their log');
select pg_temp.cc1_assert((select value = 'closed/true' from cc1_result where label = 'campaign_closed'), 'purchasing closes the RFQ');
select pg_temp.cc1_assert((select value = 'collecting/false' from cc1_result where label = 'campaign_reopened'), 'reopen restores the RFQ');
select pg_temp.cc1_assert((select value = 'cancelled' from cc1_result where label = 'o1_closed'), 'direction closes any deal');
select pg_temp.cc1_assert((select value like '%non autorizzato%' from cc1_result where label = 'alien_action'), 'other tenant refused');
select pg_temp.cc1_assert((select value like '%non trovato%' from cc1_result where label = 'alien_cross_org'), 'record of another organization not found');
select pg_temp.cc1_assert((select value = '0' from cc1_result where label = 'events_b'), 'other tenant sees no events');
select pg_temp.cc1_assert((select count(*) = 1 from public.comm_deal_events where action = 'close_lost' and reason = 'offer_expired' and note = 'Cliente sparito'), 'reason and note stored');

rollback;
