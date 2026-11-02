-- NET-CONTACT1 — public company channels acceptance (disposable CI transaction, rolls back).
-- Uses the seeded published company Morandi S.p.A. (website domain morandispa.it).
begin;

create or replace function pg_temp.nc1_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'NET-CONTACT1 assertion failed: %',message; end if;
end $$;

create or replace function pg_temp.nc1_raises(statement text,expected text,message text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected in sqlerrm)=0 and sqlstate<>expected then
      raise exception 'NET-CONTACT1 %: expected "%", got % "%"',message,expected,sqlstate,sqlerrm;
    end if;
    return;
  end;
  raise exception 'NET-CONTACT1 %: statement unexpectedly succeeded',message;
end $$;

-- Privileges: worker RPCs are service-only; review RPCs carry the Platform permission.
select pg_temp.nc1_ok(not has_function_privilege('anon','public.netcontact1_stage_company_channel(uuid,text,text,text)','EXECUTE'),'anon cannot stage');
select pg_temp.nc1_ok(not has_function_privilege('authenticated','public.netcontact1_stage_company_channel(uuid,text,text,text)','EXECUTE'),'browsers cannot stage');
select pg_temp.nc1_ok(has_function_privilege('service_role','public.netcontact1_stage_company_channel(uuid,text,text,text)','EXECUTE'),'worker may stage');
select pg_temp.nc1_ok(not has_function_privilege('authenticated','public.netcontact1_next_batch(integer)','EXECUTE'),'browsers cannot read the crawl queue');
select pg_temp.nc1_ok(not has_function_privilege('anon','public.netcontact1_approve_company_channels(uuid[])','EXECUTE'),'anon cannot approve');
select pg_temp.nc1_ok(not has_function_privilege('anon','public.netcontact1_rfq_reachability(uuid,uuid[])','EXECUTE'),'anon cannot read reachability');
select pg_temp.nc1_ok(position('network.privacy_governance_review' in
  pg_get_functiondef('public.netcontact1_approve_company_channels(uuid[])'::regprocedure))>0,'approve requires privacy review permission');
select pg_temp.nc1_ok(position('lr4_review_contact_privacy_impl' in
  pg_get_functiondef('public.netcontact1_approve_company_channels(uuid[])'::regprocedure))>0,'approve goes through LR4');
select pg_temp.nc1_ok(position('pa1_3_require_network_access' in
  pg_get_functiondef('public.netcontact1_rfq_reachability(uuid,uuid[])'::regprocedure))>0,'reachability carries the paid Network guard');
select pg_temp.nc1_ok(position('''email'',' in
  pg_get_functiondef('public.netcontact1_rfq_reachability(uuid,uuid[])'::regprocedure))=0,'reachability never returns the address');

-- Generic-mailbox and domain rules.
select pg_temp.nc1_ok(private.netcontact1_generic_local_part('info'),'info is generic');
select pg_temp.nc1_ok(private.netcontact1_generic_local_part('ufficio.commerciale'),'ufficio.commerciale is generic');
select pg_temp.nc1_ok(private.netcontact1_generic_local_part('sales.it'),'sales.it is generic');
select pg_temp.nc1_ok(not private.netcontact1_generic_local_part('mario.rossi'),'personal name is not generic');
select pg_temp.nc1_ok(not private.netcontact1_generic_local_part('info.mario'),'info + name is not generic');
select pg_temp.nc1_ok(private.netcontact1_domain_matches('info@morandispa.it','morandispa.it'),'same domain');
select pg_temp.nc1_ok(private.netcontact1_domain_matches('info@mail.morandispa.it','www.morandispa.it'),'subdomain');
select pg_temp.nc1_ok(not private.netcontact1_domain_matches('info@gmail.com','morandispa.it'),'free mail rejected');
select pg_temp.nc1_ok(not private.netcontact1_domain_matches('info@evilmorandispa.it','morandispa.it'),'look-alike domain rejected');

-- Fixture identities: temporary platform root (same pattern as PA1.3) and an outsider.
update public.platform_user_roles
set status='revoked',revoked_at=now(),reason='NET-CONTACT1 acceptance temporary root replacement'
where role='platform_superadmin' and status='active';
insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000120001'::uuid,'netcontact1-root@example.test',now()),
  ('00000000-0000-0000-0000-000000120002'::uuid,'netcontact1-outsider@example.test',now());
insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
values('00000000-0000-0000-0000-000000120001'::uuid,'platform_superadmin','active',null,'NET-CONTACT1 acceptance root');

-- Start from a Morandi without company channels (rolled back).
update public.network_contacts set publication_status='archived',archived_at=now()
where company_id='51100000-0000-5000-8000-000000000005'::uuid and archived_at is null;

-- Worker staging (service role).
set local role service_role;
do $t$
declare
  morandi constant uuid:='51100000-0000-5000-8000-000000000005';
  r jsonb;
  q jsonb;
begin
  q:=public.netcontact1_next_batch(25);
  perform pg_temp.nc1_ok(q->>'contract'='netcontact1-next-v1','queue contract');
  perform pg_temp.nc1_ok(jsonb_array_length(q->'items')<=25,'queue batch capped at 25');

  r:=public.netcontact1_stage_company_channel(morandi,'mario.rossi@morandispa.it',null,'https://www.morandispa.it/contatti');
  perform pg_temp.nc1_ok(r->>'status'='rejected_channel','personal address never staged');
  r:=public.netcontact1_stage_company_channel(morandi,'info@gmail.com',null,'https://www.morandispa.it/contatti');
  perform pg_temp.nc1_ok(r->>'status'='rejected_channel','foreign-domain address never staged');

  r:=public.netcontact1_stage_company_channel(morandi,'Vendite@MorandiSpa.it','+39 0372 123 456','https://www.morandispa.it/contatti');
  perform pg_temp.nc1_ok(r->>'status'='staged' and (r->>'email_staged')::boolean and (r->>'phone_staged')::boolean,'company channel staged');
  perform pg_temp.nc1_ok(exists(select 1 from public.network_contacts nc
    join public.network_data_assertions a on a.id=nc.source_assertion_id
    where nc.id=(r->>'contact_id')::uuid and nc.publication_status='pending_review'
      and nc.email='vendite@morandispa.it' and nc.phone='+390372123456' and nc.contact_type='sales'
      and a.source_type='public_web' and a.source_reference='https://www.morandispa.it/contatti'),
    'staged as pending_review with public_web provenance');

  r:=public.netcontact1_stage_company_channel(morandi,'vendite@morandispa.it',null,'https://www.morandispa.it/');
  perform pg_temp.nc1_ok(r->>'status'='existing','duplicate deduplicated');

  q:=public.netcontact1_next_batch(25);
  perform pg_temp.nc1_ok(not exists(select 1 from jsonb_array_elements(q->'items') i where (i->>'company_id')::uuid=morandi),
    'company with a pending channel leaves the queue');
end
$t$;
select pg_temp.nc1_raises($s$select public.netcontact1_stage_company_channel('51100000-0000-5000-8000-000000000005'::uuid,'info@morandispa.it',null,'https://example.com/contatti')$s$,
  '22023','source outside the company site refused');
select pg_temp.nc1_raises($s$select public.netcontact1_stage_company_channel('51100000-0000-5000-8000-000000000005'::uuid,'info@morandispa.it',null,'http://www.morandispa.it/')$s$,
  '22023','non-https source refused');
reset role;

-- Nothing staged is visible or RFQ-usable before review.
select pg_temp.nc1_ok(not exists(select 1 from private.rfqh2_best_network_contact('51100000-0000-5000-8000-000000000005'::uuid)),
  'pending channel is not RFQ-usable');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000120002',true);
select pg_temp.nc1_raises($s$select public.netcontact1_pending_company_channels(100)$s$,'42501','outsider cannot read the review queue');
select pg_temp.nc1_raises($s$select public.netcontact1_approve_company_channels(array[gen_random_uuid()])$s$,'42501','outsider cannot approve');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000120001',true);
do $t$
declare
  r jsonb;
  ids uuid[];
begin
  r:=public.netcontact1_pending_company_channels(100);
  perform pg_temp.nc1_ok(r->>'contract'='netcontact1-review-v1','review contract');
  select array_agg((i->>'contact_id')::uuid) into ids from jsonb_array_elements(r->'items') i
  where (i->>'company_id')::uuid='51100000-0000-5000-8000-000000000005'::uuid;
  perform pg_temp.nc1_ok(cardinality(ids)=1,'Morandi channel in the review queue');
  r:=public.netcontact1_approve_company_channels(ids);
  perform pg_temp.nc1_ok((r->>'published')::int=1,'bulk approval publishes');
end
$t$;
select pg_temp.nc1_raises($s$select public.netcontact1_approve_company_channels(array[]::uuid[])$s$,'22023','empty selection refused');
reset role;

select pg_temp.nc1_ok(exists(select 1 from public.network_contacts
  where company_id='51100000-0000-5000-8000-000000000005'::uuid and email='vendite@morandispa.it'
    and publication_status='published' and privacy_classification='company_channel'
    and privacy_review_expires_at>now()+interval '11 months'),
  'published as LR4 company channel with 12-month review');
select pg_temp.nc1_ok(exists(select 1 from public.network_data_governance_events e
  join public.network_contacts nc on nc.id=e.subject_id
  where nc.email='vendite@morandispa.it' and e.action='contact_privacy_reviewed'),
  'LR4 audit event recorded');
select pg_temp.nc1_ok((select email from private.rfqh2_best_network_contact('51100000-0000-5000-8000-000000000005'::uuid))='vendite@morandispa.it',
  'approved channel is RFQ-usable by email');

-- A wrong channel is rejected in bulk: archived, never published, audited.
set local role service_role;
select pg_temp.nc1_ok(public.netcontact1_stage_company_channel('51100000-0000-5000-8000-000000000005'::uuid,
  null,'+39 0372 999999','https://www.morandispa.it/chi-siamo')->>'status'='staged','second channel staged');
reset role;
select set_config('nc1.reject_id',(select id::text from public.network_contacts where phone='+390372999999'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000120001',true);
select pg_temp.nc1_ok((public.netcontact1_reject_company_channels(
  array[current_setting('nc1.reject_id')::uuid],'Numero fax, non centralino')->>'rejected')::int=1,
  'bulk rejection archives');
reset role;
select pg_temp.nc1_ok(exists(select 1 from public.network_contacts
  where phone='+390372999999' and publication_status='archived' and archived_at is not null),'rejected channel archived');
select pg_temp.nc1_ok(exists(select 1 from public.network_data_governance_events e
  join public.network_contacts nc on nc.id=e.subject_id
  where nc.phone='+390372999999' and e.after_state->>'decision'='rejected'),'rejection audited');

rollback;
