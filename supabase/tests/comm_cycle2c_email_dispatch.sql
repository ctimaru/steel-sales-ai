-- COMM-CYCLE2.C: email-only guarded dispatch, fail-closed unknown results,
-- same-org/office permissions, frozen revision and exact cycle audit.
begin;
create or replace function pg_temp.c2c_assert(ok boolean,msg text)
returns void language plpgsql as $f$
begin if not coalesce(ok,false) then raise exception 'C2C: %',msg; end if; end;
$f$;
create or replace function pg_temp.c2c_as(uid text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub',uid,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated')::text,true);
end;
$f$;
create or replace function pg_temp.c2c_reserve_error(org uuid,offer uuid)
returns text language plpgsql as $f$
begin
  perform public.comm_cycle2c_reserve_email(org,offer,1,'cliente@example.test',
    'Offerta cliente',repeat('a',64));
  return 'ACCEPTED';
exception when others then return sqlerrm;
end;
$f$;
create or replace function pg_temp.c2c_finish_error(org uuid, dispatch uuid)
returns text language plpgsql as $f$
begin
  perform public.comm_cycle2c_complete_email(org,dispatch,'accepted','resend-test-00000001');
  return 'ACCEPTED';
exception when others then return sqlerrm;
end;
$f$;
create or replace function pg_temp.c2c_manual_mark_error(org uuid,offer uuid)
returns text language plpgsql as $f$
begin
  perform public.comm_cycle1_apply(org,'offer',offer,'offer_sent');
  return 'ACCEPTED';
exception when others then return sqlerrm;
end;
$f$;
create or replace function pg_temp.c2c_confirm_error(org uuid, dispatch uuid)
returns text language plpgsql as $f$
begin
  perform public.comm_cycle2c_confirm_sent(org,dispatch);
  return 'ACCEPTED';
exception when others then return sqlerrm;
end;
$f$;
create or replace function pg_temp.c2c_save_error(org uuid,offer uuid)
returns text language plpgsql as $f$
begin
  perform public.comm_cycle2b_save_offer(org,offer,1,current_date+10,
    'EXW','Bonifico 30 gg',null,(select jsonb_agg(jsonb_build_object(
    'line_id',id,'price_value',1100,'price_unit','EUR/t'))
    from public.offer_lines where offer_id=offer));
  return 'ACCEPTED';
exception when others then return sqlerrm;
end;
$f$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-00000000c4a1','c2c-sales@example.test'),
('00000000-0000-0000-0000-00000000c4a2','c2c-buy@example.test'),
('00000000-0000-0000-0000-00000000c4b1','c2c-other@example.test');
insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-00000000c4f1','C2C Sender','c2c-sender',
 '00000000-0000-0000-0000-00000000c4a1','completed'),
('00000000-0000-0000-0000-00000000c4f2','C2C Other','c2c-other',
 '00000000-0000-0000-0000-00000000c4b1','completed');
insert into public.organization_memberships
(organization_id,user_id,role,business_role,status,is_default) values
('00000000-0000-0000-0000-00000000c4f1','00000000-0000-0000-0000-00000000c4a1',
 'member','salesperson','active',true),
('00000000-0000-0000-0000-00000000c4f1','00000000-0000-0000-0000-00000000c4a2',
 'member','purchasing','active',true),
('00000000-0000-0000-0000-00000000c4f2','00000000-0000-0000-0000-00000000c4b1',
 'admin','sales_director','active',true);
insert into public.rfqs(id,owner_id,organization_id,status,priority,requested_at)
values('00000000-0000-0000-0000-00000000c411',
 '00000000-0000-0000-0000-00000000c4a1',
 '00000000-0000-0000-0000-00000000c4f1','new','normal',now());
insert into public.rfq_lines(id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,raw_spec_text)
values('00000000-0000-0000-0000-00000000c421',
 '00000000-0000-0000-0000-00000000c4a1',
 '00000000-0000-0000-0000-00000000c4f1',
 '00000000-0000-0000-0000-00000000c411',10,'t','EN10219 S355');
create temporary table c2c_results(label text primary key,value text) on commit drop;
grant all on c2c_results to authenticated,service_role;

set local role authenticated;
select pg_temp.c2c_as('00000000-0000-0000-0000-00000000c4a1');
insert into c2c_results values ('offer',(
  public.comm_cycle2a_prepare_offer(
    '00000000-0000-0000-0000-00000000c4f1',
    '00000000-0000-0000-0000-00000000c411')->>'offer_id'));
select public.comm_cycle2b_save_offer(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='offer'),0,
  current_date+10,'EXW Milano','Bonifico 30 gg',null,
  (select jsonb_agg(jsonb_build_object('line_id',id,'price_value',1250,'price_unit','EUR/t'))
    from public.offer_lines
    where offer_id=(select value::uuid from c2c_results where label='offer')));
insert into c2c_results values ('first',(
  public.comm_cycle2c_reserve_email(
    '00000000-0000-0000-0000-00000000c4f1',
    (select value::uuid from c2c_results where label='offer'),1,
    'cliente@example.test','Offerta S355',repeat('a',64))->>'dispatch_id'));
insert into c2c_results values ('double',pg_temp.c2c_reserve_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='offer')));
insert into c2c_results values ('frozen',pg_temp.c2c_save_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='offer')));
insert into c2c_results values ('manual_while_reserved',pg_temp.c2c_manual_mark_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='offer')));
-- The authenticated application role must never attest provider acceptance:
-- only the server (service role) may record the verified Resend response.
insert into c2c_results values ('forged_acceptance',pg_temp.c2c_finish_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='first')));

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.comm_cycle2c_complete_email(
 '00000000-0000-0000-0000-00000000c4f1',
 (select value::uuid from c2c_results where label='first'),'failed');
set local role authenticated;
select pg_temp.c2c_as('00000000-0000-0000-0000-00000000c4a1');

insert into c2c_results values ('retry',(
  public.comm_cycle2c_reserve_email(
    '00000000-0000-0000-0000-00000000c4f1',
    (select value::uuid from c2c_results where label='offer'),1,
    'cliente@example.test','Offerta S355',repeat('b',64))->>'dispatch_id'));

-- User cannot change status even if the resend ID is guessed.
insert into c2c_results values ('unverified_confirm',pg_temp.c2c_confirm_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='retry')));


set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.comm_cycle2c_complete_email(
 '00000000-0000-0000-0000-00000000c4f1',
 (select value::uuid from c2c_results where label='retry'),
 'accepted','resend-test-00000002');
insert into c2c_results values ('replayed',pg_temp.c2c_finish_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='retry')));
set local role authenticated;
select pg_temp.c2c_as('00000000-0000-0000-0000-00000000c4a1');

insert into c2c_results values ('provider_recorded_before_status',
 (select status from public.offers
  where id=(select value::uuid from c2c_results where label='offer')));
select public.comm_cycle2c_confirm_sent(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='retry'));
select public.comm_cycle2c_confirm_sent(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='retry'));

select pg_temp.c2c_as('00000000-0000-0000-0000-00000000c4a2');
insert into c2c_results values ('purchasing',pg_temp.c2c_reserve_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='offer')));
select pg_temp.c2c_as('00000000-0000-0000-0000-00000000c4b1');
insert into c2c_results values ('foreign',pg_temp.c2c_confirm_error(
  '00000000-0000-0000-0000-00000000c4f1',
  (select value::uuid from c2c_results where label='first')));
insert into c2c_results values ('other_tenant_visibility',
 (select count(*)::text from public.comm_offer_email_dispatches
  where organization_id='00000000-0000-0000-0000-00000000c4f1'));
reset role;

select pg_temp.c2c_assert((select value <> 'ACCEPTED' from c2c_results
  where label='forged_acceptance'), 'authenticated caller cannot forge provider acceptance');
select pg_temp.c2c_assert((select value like '%provider non ha confermato%' from c2c_results
  where label='unverified_confirm'), 'no sent status before verified provider acceptance');
select pg_temp.c2c_assert((select value='draft' from c2c_results
  where label='provider_recorded_before_status'), 'verified provider alone does not bypass authenticated cycle');
select pg_temp.c2c_assert((select value like '%invio già avviato%' from c2c_results where label='double'),
  'duplicate concurrent send refused');
select pg_temp.c2c_assert((select value like '%bloccata durante l''invio%' from c2c_results where label='manual_while_reserved'),
  'even an external sent action cannot spoof delivery while provider outcome is reserved');
select pg_temp.c2c_assert((select value like '%bloccate durante l''invio%' or value like '%bloccata durante l''invio%' from c2c_results where label='frozen'),
  'quote snapshot frozen while sending');
select pg_temp.c2c_assert((select count(*)=2 from public.comm_offer_email_dispatches
  where offer_id=(select value::uuid from c2c_results where label='offer')
    and status in ('accepted','failed')), 'failed then explicit new attempt');
select pg_temp.c2c_assert((select status='sent' from public.offers
  where id=(select value::uuid from c2c_results where label='offer')), 'success updates sent');
select pg_temp.c2c_assert((select count(*)=1 from public.comm_deal_events
  where action='offer_sent' and record_id=(select value::uuid from c2c_results where label='offer')),
 'single event through COMM-CYCLE1');
select pg_temp.c2c_assert((select value like '%esito già registrato%' from c2c_results where label='replayed'),
 'cannot forge duplicate acknowledgement');
select pg_temp.c2c_assert((select value like 'office_profile_read_only%' from c2c_results where label='purchasing'),
 'purchasing denied');
select pg_temp.c2c_assert((select value like '%non autorizzato%' from c2c_results where label='foreign'),
 'foreign tenant denied');
select pg_temp.c2c_assert((select value='0' from c2c_results where label='other_tenant_visibility'),
 'email dispatch history tenant isolated');
select pg_temp.c2c_assert(
  (select not has_function_privilege('anon',oid,'EXECUTE')
   from pg_proc where oid=to_regprocedure('public.comm_cycle2c_reserve_email(uuid,uuid,integer,text,text,text)')),
 'anon cannot reserve');
select pg_temp.c2c_assert(
  (select not has_function_privilege('authenticated',oid,'EXECUTE')
   from pg_proc where oid=to_regprocedure('public.comm_cycle2c_complete_email(uuid,uuid,text,text)')),
  'provider confirmation not callable by authenticated users');
select pg_temp.c2c_assert(
  (select has_function_privilege('service_role',oid,'EXECUTE')
   from pg_proc where oid=to_regprocedure('public.comm_cycle2c_complete_email(uuid,uuid,text,text)')),
  'service can register provider results');
rollback;
