-- COMM-CYCLE2.A acceptance — versioned offer drafts and immutable sent history.
-- Disposable local CI transaction. No production DDL/fixtures.
begin;

create or replace function pg_temp.cc2_assert(ok boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'COMM-CYCLE2.A: %',msg; end if;
end $$;
create or replace function pg_temp.cc2_as(uid text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',uid,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',uid,'role','authenticated')::text,true);
end $$;
create or replace function pg_temp.cc2_denied(org uuid, rfq uuid)
returns text language plpgsql as $$
begin
  perform public.comm_cycle2a_prepare_offer(org,rfq);
  return 'ACCEPTED';
exception when others then return sqlerrm;
end $$;
create or replace function pg_temp.cc2_try_accept(org uuid, offer uuid)
returns text language plpgsql as $$
begin
  perform public.comm_cycle1_apply(org,'offer',offer,'offer_accepted');
  return 'ACCEPTED';
exception when others then return sqlerrm;
end $$;

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-00000000c2a1','cc2-sales@example.test'),
  ('00000000-0000-0000-0000-00000000c2a2','cc2-purchase@example.test'),
  ('00000000-0000-0000-0000-00000000c2b1','cc2-other@example.test');
insert into public.organizations(id,name,slug,created_by,onboarding_status) values
  ('00000000-0000-0000-0000-00000000c2f1','CC2 Company A','cc2-company-a',
   '00000000-0000-0000-0000-00000000c2a1','completed'),
  ('00000000-0000-0000-0000-00000000c2f2','CC2 Company B','cc2-company-b',
   '00000000-0000-0000-0000-00000000c2b1','completed');
insert into public.organization_memberships(organization_id,user_id,role,business_role,status,is_default) values
  ('00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c2a1','member','salesperson','active',true),
  ('00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c2a2','member','purchasing','active',true),
  ('00000000-0000-0000-0000-00000000c2f2','00000000-0000-0000-0000-00000000c2b1','admin','sales_director','active',true);

insert into public.rfqs(id,owner_id,organization_id,status,priority,requested_at)
values
  ('00000000-0000-0000-0000-00000000c211','00000000-0000-0000-0000-00000000c2a1','00000000-0000-0000-0000-00000000c2f1','new','normal',now()),
  ('00000000-0000-0000-0000-00000000c212','00000000-0000-0000-0000-00000000c2a1','00000000-0000-0000-0000-00000000c2f1','new','normal',now());
insert into public.rfq_lines(id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,requested_standard,raw_spec_text)
values
  ('00000000-0000-0000-0000-00000000c221','00000000-0000-0000-0000-00000000c2a1','00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c211',10,'t','S355J2H','EN 10219','Tubo tondo Ø 168.3 × 6.3'),
  ('00000000-0000-0000-0000-00000000c222','00000000-0000-0000-0000-00000000c2a1','00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c211',120,'m','S235JRH','EN 10219','Tubo quadro 80 × 80 × 4'),
  ('00000000-0000-0000-0000-00000000c223','00000000-0000-0000-0000-00000000c2a1','00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c212',5,'t','S355','EN 10210','Altra RFQ');

create temporary table cc2_results(label text primary key,value text) on commit drop;
grant all on cc2_results to authenticated;

set local role authenticated;
select pg_temp.cc2_as('00000000-0000-0000-0000-00000000c2a1');
insert into cc2_results values ('offer1',
  (public.comm_cycle2a_prepare_offer('00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c211')->>'offer_id'));
insert into cc2_results values ('same',
  (public.comm_cycle2a_prepare_offer('00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c211')->>'created'));
insert into cc2_results values ('initial_events',
  (select count(*)::text from public.comm_deal_events
     where action='offer_prepared' and organization_id='00000000-0000-0000-0000-00000000c2f1'));
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c2f1',
  'offer',(select value::uuid from cc2_results where label='offer1'),'offer_sent');
insert into cc2_results values ('offer2',
  (public.comm_cycle2a_prepare_offer('00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c211')->>'offer_id'));
insert into cc2_results values ('accept_old',
  pg_temp.cc2_try_accept('00000000-0000-0000-0000-00000000c2f1',
    (select value::uuid from cc2_results where label='offer1')));

-- Office profile check is enforced in the DB, not only in the UI.
select pg_temp.cc2_as('00000000-0000-0000-0000-00000000c2a2');
insert into cc2_results values ('purchasing',
  pg_temp.cc2_denied('00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c212'));
select pg_temp.cc2_as('00000000-0000-0000-0000-00000000c2b1');
insert into cc2_results values ('other_tenant',
  pg_temp.cc2_denied('00000000-0000-0000-0000-00000000c2f1','00000000-0000-0000-0000-00000000c211'));
insert into cc2_results values ('cross_org_id',
  pg_temp.cc2_denied('00000000-0000-0000-0000-00000000c2f2','00000000-0000-0000-0000-00000000c211'));
insert into cc2_results values ('other_visible_events',
  (select count(*)::text from public.comm_deal_events
   where organization_id='00000000-0000-0000-0000-00000000c2f1'));
reset role;

-- Test immutable stored data as the owner of the tables to isolate trigger
-- enforcement from RLS. Neither admin nor client may rewrite a sent version.
do $$
begin
  update public.offer_lines set quantity=999
    where offer_id=(select value::uuid from cc2_results where label='offer1');
  insert into cc2_results values ('edit_sent_line','ACCEPTED');
exception when others then
  insert into cc2_results values ('edit_sent_line',sqlerrm);
end $$;
do $$
begin
  update public.offers set payment_terms='changed after send'
    where id=(select value::uuid from cc2_results where label='offer1');
  insert into cc2_results values ('edit_sent_terms','ACCEPTED');
exception when others then
  insert into cc2_results values ('edit_sent_terms',sqlerrm);
end $$;
do $$
begin
  update public.offer_lines set rfq_line_id='00000000-0000-0000-0000-00000000c223'
    where offer_id=(select value::uuid from cc2_results where label='offer2')
      and rfq_line_id='00000000-0000-0000-0000-00000000c221';
  insert into cc2_results values ('wrong_rfq_line','ACCEPTED');
exception when others then
  insert into cc2_results values ('wrong_rfq_line',sqlerrm);
end $$;

-- Closing and reopening restores exact prior statuses across both revisions.
set local role authenticated;
select pg_temp.cc2_as('00000000-0000-0000-0000-00000000c2a1');
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c2f1',
  'rfq','00000000-0000-0000-0000-00000000c211','close_lost',null,'price');
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c2f1',
  'rfq','00000000-0000-0000-0000-00000000c211','reopen');
reset role;

select pg_temp.cc2_assert(
  (select value='false' from cc2_results where label='same'), 'duplicate click idempotent');
select pg_temp.cc2_assert(
  (select value='1' from cc2_results where label='initial_events'), 'single prepare event');
select pg_temp.cc2_assert(
  (select count(*)=2 from public.offers where rfq_id='00000000-0000-0000-0000-00000000c211'),
  'exactly two revisions');
select pg_temp.cc2_assert(
  (select revision_no=1 and revision_managed and previous_offer_id is null
    from public.offers where id=(select value::uuid from cc2_results where label='offer1')),
  'first revision managed');
select pg_temp.cc2_assert(
  (select revision_no=2 and revision_managed and
    previous_offer_id=(select value::uuid from cc2_results where label='offer1')
    from public.offers where id=(select value::uuid from cc2_results where label='offer2')),
  'second revision linked to first');
select pg_temp.cc2_assert(
  (select count(*)=4 from public.offer_lines where offer_id in
    ((select value::uuid from cc2_results where label='offer1'),
     (select value::uuid from cc2_results where label='offer2'))), 'RFQ lines copied twice');
select pg_temp.cc2_assert(
  (select count(*)=4 from public.offer_lines where offer_id in
    ((select value::uuid from cc2_results where label='offer1'),
     (select value::uuid from cc2_results where label='offer2'))
    and rfq_line_id is not null and price_value is null and price_unit is null),
  'all lines linked and no private price copied');
select pg_temp.cc2_assert(
  (select value like '%solo l''ultima revisione%' from cc2_results where label='accept_old'),
  'obsolete revision cannot be accepted');
select pg_temp.cc2_assert(
  (select value like 'office_profile_read_only%' from cc2_results where label='purchasing'),
  'purchasing cannot write customer offers');
select pg_temp.cc2_assert(
  (select value like '%non autorizzato%' from cc2_results where label='other_tenant'),
  'foreign member cannot prepare');
select pg_temp.cc2_assert(
  (select value like '%richiesta non trovata%' from cc2_results where label='cross_org_id'),
  'same-org row lookup enforced');
select pg_temp.cc2_assert(
  (select value='0' from cc2_results where label='other_visible_events'),
  'event log isolated');
select pg_temp.cc2_assert(
  (select value like '%righe di revisione inviata immutabili%' from cc2_results where label='edit_sent_line'),
  'sent lines frozen');
select pg_temp.cc2_assert(
  (select value like '%contenuto di revisione inviata immutabile%' from cc2_results where label='edit_sent_terms'),
  'sent header frozen');
select pg_temp.cc2_assert(
  (select value like '%riga non appartenente alla richiesta%' from cc2_results where label='wrong_rfq_line'),
  'same-org but wrong RFQ line rejected');
select pg_temp.cc2_assert(
  (select status='sent' from public.offers where id=(select value::uuid from cc2_results where label='offer1')),
  'reopen restores first sent revision');
select pg_temp.cc2_assert(
  (select status='draft' from public.offers where id=(select value::uuid from cc2_results where label='offer2')),
  'reopen restores latest draft revision');
select pg_temp.cc2_assert(
  (select count(*)=1 from public.comm_deal_events
    where action='offer_revised' and deal_id='00000000-0000-0000-0000-00000000c211'
      and changes @> '[{"from":null,"to":"draft","record_kind":"offer"}]'::jsonb),
  'exact new revision state persisted in append-only audit');

rollback;
