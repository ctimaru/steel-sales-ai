-- COMM-CYCLE2.B guarded customer-offer editing: two tenants, office profiles,
-- quote pricing and weight, history, concurrency and send readiness.
begin;

create or replace function pg_temp.c2b_assert(ok boolean, msg text)
returns void language plpgsql as $f$
begin
  if not coalesce(ok,false) then raise exception 'COMM-CYCLE2.B: %',msg; end if;
end;
$f$;
create or replace function pg_temp.c2b_as(uid text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub',uid,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated')::text,true);
end;
$f$;
create or replace function pg_temp.c2b_save_error(org uuid, offer uuid, ver integer, payload jsonb)
returns text language plpgsql as $f$
begin
  perform public.comm_cycle2b_save_offer(org,offer,ver,current_date+5,
    'EXW','30 giorni',null,payload);
  return 'ACCEPTED';
exception when others then return sqlerrm;
end;
$f$;
create or replace function pg_temp.c2b_send_error(org uuid, offer uuid)
returns text language plpgsql as $f$
begin
  perform public.comm_cycle1_apply(org,'offer',offer,'offer_sent');
  return 'ACCEPTED';
exception when others then return sqlerrm;
end;
$f$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-00000000c3a1','c2b-sales@example.test'),
('00000000-0000-0000-0000-00000000c3a2','c2b-purchasing@example.test'),
('00000000-0000-0000-0000-00000000c3b1','c2b-other@example.test');
insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-00000000c3f1','C2B A','c2b-a',
 '00000000-0000-0000-0000-00000000c3a1','completed'),
('00000000-0000-0000-0000-00000000c3f2','C2B B','c2b-b',
 '00000000-0000-0000-0000-00000000c3b1','completed');
insert into public.organization_memberships(organization_id,user_id,role,business_role,status,is_default) values
('00000000-0000-0000-0000-00000000c3f1','00000000-0000-0000-0000-00000000c3a1','member','salesperson','active',true),
('00000000-0000-0000-0000-00000000c3f1','00000000-0000-0000-0000-00000000c3a2','member','purchasing','active',true),
('00000000-0000-0000-0000-00000000c3f2','00000000-0000-0000-0000-00000000c3b1','admin','sales_director','active',true);
insert into public.rfqs(id,owner_id,organization_id,status,priority,requested_at) values
('00000000-0000-0000-0000-00000000c311','00000000-0000-0000-0000-00000000c3a1',
 '00000000-0000-0000-0000-00000000c3f1','new','normal',now()),
('00000000-0000-0000-0000-00000000c312','00000000-0000-0000-0000-00000000c3b1',
 '00000000-0000-0000-0000-00000000c3f2','new','normal',now());
insert into public.rfq_lines(id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,raw_spec_text) values
('00000000-0000-0000-0000-00000000c321','00000000-0000-0000-0000-00000000c3a1','00000000-0000-0000-0000-00000000c3f1',
 '00000000-0000-0000-0000-00000000c311',10,'t','EN10219 S355'),
('00000000-0000-0000-0000-00000000c322','00000000-0000-0000-0000-00000000c3a1','00000000-0000-0000-0000-00000000c3f1',
 '00000000-0000-0000-0000-00000000c311',100,'m','EN10219 S235');

create temporary table c2b_results(label text primary key,value text) on commit drop;
grant all on c2b_results to authenticated;
set local role authenticated;
select pg_temp.c2b_as('00000000-0000-0000-0000-00000000c3a1');
insert into c2b_results values ('offer1',(
  public.comm_cycle2a_prepare_offer('00000000-0000-0000-0000-00000000c3f1',
    '00000000-0000-0000-0000-00000000c311')->>'offer_id'));
insert into c2b_results values ('send_incomplete',pg_temp.c2b_send_error(
  '00000000-0000-0000-0000-00000000c3f1',
  (select value::uuid from c2b_results where label='offer1')));

insert into c2b_results values ('saved',(
  public.comm_cycle2b_save_offer(
    '00000000-0000-0000-0000-00000000c3f1',
    (select value::uuid from c2b_results where label='offer1'),
    0,current_date+10,'EXW Milano','Bonifico 30 gg','Offerta cliente',
    (select jsonb_agg(jsonb_build_object(
       'line_id',id,'price_value',
       case when rfq_line_id='00000000-0000-0000-0000-00000000c321' then 1250 else 27 end,
       'price_unit',case when rfq_line_id='00000000-0000-0000-0000-00000000c321' then 'EUR/t' else 'EUR/m' end,
       'weight_kg_m',case when rfq_line_id='00000000-0000-0000-0000-00000000c321' then 15.42 else null end))
     from public.offer_lines where offer_id=(select value::uuid from c2b_results where label='offer1'))
  )->>'draft_edit_version'));
insert into c2b_results values ('stale',pg_temp.c2b_save_error(
  '00000000-0000-0000-0000-00000000c3f1',
  (select value::uuid from c2b_results where label='offer1'),0,
  (select jsonb_agg(jsonb_build_object('line_id',id,'price_value',1200,'price_unit','EUR/t'))
    from public.offer_lines where offer_id=(select value::uuid from c2b_results where label='offer1'))));
insert into c2b_results values ('duplicate',pg_temp.c2b_save_error(
  '00000000-0000-0000-0000-00000000c3f1',
  (select value::uuid from c2b_results where label='offer1'),1,
  (select jsonb_build_array(
    jsonb_build_object('line_id',id,'price_value',1200,'price_unit','EUR/t'),
    jsonb_build_object('line_id',id,'price_value',1300,'price_unit','EUR/m'))
    from public.offer_lines where offer_id=(select value::uuid from c2b_results where label='offer1')
    order by id limit 1)));
do $c2b_direct$
begin
  update public.offer_lines set price_value=1
    where offer_id=(select value::uuid from c2b_results where label='offer1');
  insert into c2b_results values ('direct_edit','ACCEPTED');
exception when others then
  insert into c2b_results values ('direct_edit',sqlerrm);
end;
$c2b_direct$;
select public.comm_cycle1_apply('00000000-0000-0000-0000-00000000c3f1','offer',
  (select value::uuid from c2b_results where label='offer1'),'offer_sent');
insert into c2b_results values ('offer2',(
  public.comm_cycle2a_prepare_offer('00000000-0000-0000-0000-00000000c3f1',
    '00000000-0000-0000-0000-00000000c311')->>'offer_id'));
insert into c2b_results values ('sent_save',pg_temp.c2b_save_error(
  '00000000-0000-0000-0000-00000000c3f1',
  (select value::uuid from c2b_results where label='offer1'),1,'[]'::jsonb));

select pg_temp.c2b_as('00000000-0000-0000-0000-00000000c3a2');
insert into c2b_results values ('purchasing_denied',pg_temp.c2b_save_error(
  '00000000-0000-0000-0000-00000000c3f1',
  (select value::uuid from c2b_results where label='offer2'),0,'[]'::jsonb));
select pg_temp.c2b_as('00000000-0000-0000-0000-00000000c3b1');
insert into c2b_results values ('other_tenant',pg_temp.c2b_save_error(
  '00000000-0000-0000-0000-00000000c3f1',
  (select value::uuid from c2b_results where label='offer2'),0,'[]'::jsonb));
insert into c2b_results values ('foreign_id',pg_temp.c2b_save_error(
  '00000000-0000-0000-0000-00000000c3f2',
  (select value::uuid from c2b_results where label='offer2'),0,'[]'::jsonb));
insert into c2b_results values ('foreign_events',(
  select count(*)::text from public.comm_deal_events
  where organization_id='00000000-0000-0000-0000-00000000c3f1'));
reset role;

select pg_temp.c2b_assert((select value like '%completa validità%' from c2b_results where label='send_incomplete'),
  'cannot mark an incomplete generated quote as sent');
select pg_temp.c2b_assert((select value='1' from c2b_results where label='saved'),
  'atomic save increments optimistic version');
select pg_temp.c2b_assert((select value like '%modificata altrove%' from c2b_results where label='stale'),
  'stale edit conflict denied');
select pg_temp.c2b_assert((select value not like 'ACCEPTED' from c2b_results where label='duplicate'),
  'invalid line set denied');
select pg_temp.c2b_assert((select value like '%usa Salva bozza%' from c2b_results where label='direct_edit'),
  'no direct authenticated managed price editing');
select pg_temp.c2b_assert((select price_value=1250 and price_unit='EUR/t' and weight_kg_m=15.42
  from public.offer_lines where offer_id=(select value::uuid from c2b_results where label='offer1')
    and rfq_line_id='00000000-0000-0000-0000-00000000c321'),'customer rate and weight persisted');
select pg_temp.c2b_assert((select price_value=1250 and price_unit='EUR/t' and weight_kg_m=15.42
  from public.offer_lines where offer_id=(select value::uuid from c2b_results where label='offer2')
    and rfq_line_id='00000000-0000-0000-0000-00000000c321'),'new revision inherits customer rate and verified weight');
select pg_temp.c2b_assert((select delivery_term='EXW Milano' and payment_terms='Bonifico 30 gg'
  and notes='Offerta cliente' and valid_until=current_date+10
  from public.offers where id=(select value::uuid from c2b_results where label='offer2')),
  'revision inherits terms and validity');
select pg_temp.c2b_assert((select value like '%ultima bozza%' from c2b_results where label='sent_save'),
  'cannot rewrite previously sent quote');
select pg_temp.c2b_assert((select value like 'office_profile_read_only%' from c2b_results where label='purchasing_denied'),
  'purchasing role cannot save customer quote');
select pg_temp.c2b_assert((select value like '%non autorizzato%' from c2b_results where label='other_tenant'),
  'other company cannot write');
select pg_temp.c2b_assert((select value like '%offerta non trovata%' from c2b_results where label='foreign_id'),
  'same-org lookup protects IDOR');
select pg_temp.c2b_assert((select value='0' from c2b_results where label='foreign_events'),
  'audit is tenant-isolated');
select pg_temp.c2b_assert((select count(*)=1 from public.comm_deal_events
  where organization_id='00000000-0000-0000-0000-00000000c3f1' and action='offer_edited'
    and changes='[]'::jsonb),'save logged without fictitious status change');
rollback;
