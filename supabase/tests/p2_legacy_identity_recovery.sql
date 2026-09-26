-- P2.3 Legacy Message Identity Recovery & RFQ Attribution acceptance.
begin;

create or replace function pg_temp.p23_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P2.3 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.p23_assert(
  not has_function_privilege(
    'anon',
    'public.p2_recover_legacy_message_identity(uuid,uuid,text,text,text,text,text,timestamptz,text)',
    'EXECUTE'
  ),
  'anonymous role must not materialize recovered message identity'
);

select pg_temp.p23_assert(
  not has_function_privilege(
    'anon',
    'public.p2_finalize_legacy_conversation_identity(uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous role must not finalize recovered conversation identity'
);

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000023a1','p23@example.com'),
('00000000-0000-0000-0000-0000000023b1','p23-other@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-0000000023f1','P23 Org','p23-org','00000000-0000-0000-0000-0000000023a1','completed'),
('00000000-0000-0000-0000-0000000023f2','P23 Other','p23-other','00000000-0000-0000-0000-0000000023b1','completed');

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
('00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-0000000023a1','admin','sales_director','active',true),
('00000000-0000-0000-0000-0000000023f2','00000000-0000-0000-0000-0000000023b1','admin','sales_director','active',true);

insert into public.companies(id,owner_id,organization_id,name,company_type,country) values
('00000000-0000-0000-0000-000000002301','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','Verified A','customer','IT'),
('00000000-0000-0000-0000-000000002302','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','Verified B','customer','DE');

insert into public.commercial_company_identity_verifications(
  organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values
('00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002301','vat_number','IT00000000001','vat_document','00000000-0000-0000-0000-0000000023a1'),
('00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002302','vat_number','DE00000000001','vat_document','00000000-0000-0000-0000-0000000023a1');

insert into public.contacts(id,owner_id,organization_id,company_id,full_name,email) values
('00000000-0000-0000-0000-000000002311','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002301','Known A','known.a@example.com'),
('00000000-0000-0000-0000-000000002312','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1',null,'Pending','pending@example.com'),
('00000000-0000-0000-0000-000000002313','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002302','Known B','known.b@example.com');

insert into public.conversations(id,owner_id,organization_id,subject,external_thread_id,status) values
('00000000-0000-0000-0000-000000002321','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','Consensus A','p23-thread-a','open'),
('00000000-0000-0000-0000-000000002322','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','Pending mapping','p23-thread-pending','open'),
('00000000-0000-0000-0000-000000002323','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','Conflict','p23-thread-conflict','open'),
('00000000-0000-0000-0000-000000002329','00000000-0000-0000-0000-0000000023b1','00000000-0000-0000-0000-0000000023f2','Other','p23-other','open');

insert into public.rfqs(id,owner_id,organization_id,conversation_id,requested_at,status,priority) values
('00000000-0000-0000-0000-000000002331','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002321',now(),'qualified','normal'),
('00000000-0000-0000-0000-000000002332','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002322',now(),'qualified','normal'),
('00000000-0000-0000-0000-000000002333','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002323',now(),'qualified','normal');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000023a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p2_recover_legacy_message_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002321',
  'legacy-a-1.eml',repeat('a',64),'known.a@example.com','Known A','inbound',
  now()-interval '2 days','A1'
);
select public.p2_recover_legacy_message_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002321',
  'legacy-a-2.eml',repeat('b',64),'known.a@example.com','Known A','inbound',
  now()-interval '1 day','A2'
);

select pg_temp.p23_assert(
  (select company_id from public.rfqs where id='00000000-0000-0000-0000-000000002331') is null,
  'materialization phase must not propagate Company before finalization'
);

select public.p2_finalize_legacy_conversation_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002321'
);

select pg_temp.p23_assert(
  (select company_id from public.rfqs where id='00000000-0000-0000-0000-000000002331')
    ='00000000-0000-0000-0000-000000002301',
  'same verified Company across multiple inbound messages must propagate'
);

select pg_temp.p23_assert(
  (select contact_id from public.rfqs where id='00000000-0000-0000-0000-000000002331')
    ='00000000-0000-0000-0000-000000002311',
  'same exact Contact across multiple inbound messages must propagate'
);

select public.p2_recover_legacy_message_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002322',
  'legacy-pending.eml',repeat('c',64),'pending@example.com','Pending','inbound',
  now(),'Pending'
);
select public.p2_finalize_legacy_conversation_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002322'
);

select pg_temp.p23_assert(
  (select contact_id from public.rfqs where id='00000000-0000-0000-0000-000000002332')
    ='00000000-0000-0000-0000-000000002312'
  and (select company_id from public.rfqs where id='00000000-0000-0000-0000-000000002332') is null,
  'exact Contact may propagate while Company waits for human verified mapping'
);

select public.p2_recover_legacy_message_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002323',
  'legacy-conflict-a.eml',repeat('d',64),'known.a@example.com','Known A','inbound',
  now()-interval '1 hour','Conflict A'
);
select public.p2_recover_legacy_message_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002323',
  'legacy-conflict-b.eml',repeat('e',64),'known.b@example.com','Known B','inbound',
  now(),'Conflict B'
);
select public.p2_finalize_legacy_conversation_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002323'
);

select pg_temp.p23_assert(
  (select company_id from public.rfqs where id='00000000-0000-0000-0000-000000002333') is null
  and (select contact_id from public.rfqs where id='00000000-0000-0000-0000-000000002333') is null,
  'conflicting inbound identities must not propagate Contact or Company'
);

select pg_temp.p23_assert(
  (public.p2_rfq_attribution_recovery_status(
    '00000000-0000-0000-0000-0000000023f1',100
  )#>>'{summary,pending_company_confirmation}')::int=1,
  'pending Company confirmation must be visible'
);

select pg_temp.p23_assert(
  (public.p2_rfq_attribution_recovery_status(
    '00000000-0000-0000-0000-0000000023f1',100
  )#>>'{summary,blocked_identity_conflict}')::int=1,
  'identity conflicts must be visible'
);

select pg_temp.p23_assert(
  (select count(*)
   from public.commercial_message_identity_recoveries
   where organization_id='00000000-0000-0000-0000-0000000023f1')=5,
  'every recovered legacy message must retain an audit row'
);

select public.p2_recover_legacy_message_identity(
  '00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002322',
  'legacy-pending.eml',repeat('c',64),'pending@example.com','Pending','inbound',
  now(),'Pending'
);

select pg_temp.p23_assert(
  (select count(*)
   from public.commercial_message_identity_recoveries
   where organization_id='00000000-0000-0000-0000-0000000023f1')=5,
  'recovery must be idempotent by source content hash'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000023b1',true);

select pg_temp.p23_assert(
  (public.p2_rfq_attribution_recovery_status(
    '00000000-0000-0000-0000-0000000023f1',100
  )#>>'{summary,unattributed_rfqs}')::int=0,
  'cross-tenant read must return no RFQ recovery rows'
);

reset role;
rollback;
