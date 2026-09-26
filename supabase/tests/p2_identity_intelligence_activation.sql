-- P2.4 Identity Confirmation & Intelligence Activation acceptance.
begin;

create or replace function pg_temp.p24_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P2.4 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p24_expect_confirmation_conflict(
  p_contact_id uuid,
  p_company_id uuid
)
returns boolean
language plpgsql
as $$
begin
  perform public.confirm_contact_company_mapping(
    p_contact_id,p_company_id,'{"source":"p2.4_conflict_test"}'::jsonb
  );
  return false;
exception
  when others then
    return position('conflicts with an existing' in sqlerrm)>0;
end;
$$;

select pg_temp.p24_assert(
  not has_function_privilege(
    'anon','public.p2_identity_activation_readiness(uuid,integer)','EXECUTE'
  ),
  'anon must not read identity activation readiness'
);

select pg_temp.p24_assert(
  not has_function_privilege(
    'anon','public.p2_reconcile_verified_identity_activation(uuid)','EXECUTE'
  ),
  'anon must not execute identity activation reconciliation'
);

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000024a1','p24@example.com'),
('00000000-0000-0000-0000-0000000024b1','p24-other@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-0000000024f1','P24 Org','p24-org','00000000-0000-0000-0000-0000000024a1','completed'),
('00000000-0000-0000-0000-0000000024f2','P24 Other','p24-other','00000000-0000-0000-0000-0000000024b1','completed');

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
('00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-0000000024a1','admin','sales_director','active',true),
('00000000-0000-0000-0000-0000000024f2','00000000-0000-0000-0000-0000000024b1','admin','sales_director','active',true);

insert into public.companies(
  id,owner_id,organization_id,name,company_type,country,vat_number
) values
('00000000-0000-0000-0000-000000002401','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','Verified A','customer','IT','IT24000000001'),
('00000000-0000-0000-0000-000000002402','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','Verified B','customer','DE','DE24000000002');

insert into public.commercial_company_identity_verifications(
  organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values
('00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002401','vat_number','IT24000000001','vat_document','00000000-0000-0000-0000-0000000024a1'),
('00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002402','vat_number','DE24000000002','vat_document','00000000-0000-0000-0000-0000000024a1');

insert into public.contacts(
  id,owner_id,organization_id,company_id,full_name,email
) values
('00000000-0000-0000-0000-000000002411','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1',null,'Pending Buyer','pending.p24@example.com'),
('00000000-0000-0000-0000-000000002412','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002401','Known Buyer','known.p24@example.com'),
('00000000-0000-0000-0000-000000002413','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1',null,'Conflict Buyer','conflict.p24@example.com');

insert into public.conversations(
  id,owner_id,organization_id,company_id,subject,external_thread_id,status,started_at,last_activity_at
) values
('00000000-0000-0000-0000-000000002421','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1',null,'Pending 1','p24-pending-1','open',now(),now()),
('00000000-0000-0000-0000-000000002422','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1',null,'Pending 2','p24-pending-2','open',now(),now()),
('00000000-0000-0000-0000-000000002423','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1',null,'Known','p24-known','open',now(),now()),
('00000000-0000-0000-0000-000000002424','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002402','Conflict','p24-conflict','open',now(),now());

insert into public.messages(
  id,owner_id,organization_id,conversation_id,external_message_id,direction,sender_email,subject,sent_at
) values
('00000000-0000-0000-0000-000000002431','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002421','<p24-p1>','inbound','pending.p24@example.com','Pending 1',now()-interval '3 days'),
('00000000-0000-0000-0000-000000002432','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002422','<p24-p2>','inbound','pending.p24@example.com','Pending 2',now()-interval '2 days'),
('00000000-0000-0000-0000-000000002433','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002423','<p24-known>','inbound','known.p24@example.com','Known',now()-interval '1 day'),
('00000000-0000-0000-0000-000000002434','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002424','<p24-conflict>','inbound','conflict.p24@example.com','Conflict',now());

insert into public.rfqs(
  id,owner_id,organization_id,conversation_id,contact_id,requested_at,status,priority
) values
('00000000-0000-0000-0000-000000002441','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002421','00000000-0000-0000-0000-000000002411',now(),'qualified','normal'),
('00000000-0000-0000-0000-000000002442','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-000000002422','00000000-0000-0000-0000-000000002411',now(),'qualified','normal');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000024a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p24_assert(
  (public.p2_identity_activation_readiness(
    '00000000-0000-0000-0000-0000000024f1',100
  )#>>'{summary,pending_contacts}')::int=2,
  'readiness must expose both unresolved Contacts with message evidence'
);

select pg_temp.p24_assert(
  (public.p2_identity_activation_readiness(
    '00000000-0000-0000-0000-0000000024f1',100
  )#>>'{summary,affected_messages}')::int=3
  and
  (public.p2_identity_activation_readiness(
    '00000000-0000-0000-0000-0000000024f1',100
  )#>>'{summary,affected_conversations}')::int=3
  and
  (public.p2_identity_activation_readiness(
    '00000000-0000-0000-0000-0000000024f1',100
  )#>>'{summary,affected_rfqs}')::int=2,
  'readiness must preview exact deterministic activation impact'
);

select public.p2_reconcile_verified_identity_activation(
  '00000000-0000-0000-0000-0000000024f1'
) as reconcile_result \gset

select pg_temp.p24_assert(
  (:'reconcile_result'::jsonb->>'activated_conversations')::int=1
  and
  (select company_id from public.conversations
   where id='00000000-0000-0000-0000-000000002423')
    ='00000000-0000-0000-0000-000000002401'::uuid,
  'reconciliation must activate existing verified identity without creating a new decision'
);

select public.confirm_contact_company_mapping(
  '00000000-0000-0000-0000-000000002411',
  '00000000-0000-0000-0000-000000002401',
  '{"source":"p2.4_acceptance"}'::jsonb
) as confirmation \gset

select pg_temp.p24_assert(
  :'confirmation'::jsonb->>'status'='confirmed'
  and (:'confirmation'::jsonb->>'affected_messages')::int=2
  and (:'confirmation'::jsonb->>'affected_conversations')::int=2
  and (:'confirmation'::jsonb->>'affected_rfqs')::int=2
  and (:'confirmation'::jsonb->>'activated_conversations')::int=2
  and (:'confirmation'::jsonb->>'linked_rfqs')::int=2,
  'human confirmation must synchronously report and activate deterministic impact'
);

select pg_temp.p24_assert(
  (select count(*) from public.conversations
   where id in (
     '00000000-0000-0000-0000-000000002421',
     '00000000-0000-0000-0000-000000002422'
   )
   and company_id='00000000-0000-0000-0000-000000002401')=2,
  'confirmed Contact must activate all consensus-safe Conversations'
);

select pg_temp.p24_assert(
  (select count(*) from public.rfqs
   where id in (
     '00000000-0000-0000-0000-000000002441',
     '00000000-0000-0000-0000-000000002442'
   )
   and company_id='00000000-0000-0000-0000-000000002401')=2,
  'confirmed Contact must activate all deterministic RFQs'
);

select pg_temp.p24_assert(
  pg_temp.p24_expect_confirmation_conflict(
    '00000000-0000-0000-0000-000000002413',
    '00000000-0000-0000-0000-000000002401'
  ),
  'existing Conversation Company conflict must block confirmation before mapping'
);

select pg_temp.p24_assert(
  (select company_id from public.contacts
   where id='00000000-0000-0000-0000-000000002413') is null,
  'blocked confirmation must not mutate Contact→Company mapping'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000024b1',true);

select pg_temp.p24_assert(
  (public.p2_identity_activation_readiness(
    '00000000-0000-0000-0000-0000000024f1',100
  )#>>'{summary,pending_contacts}')::int=0,
  'cross-tenant readiness must expose no Contacts'
);

reset role;
rollback;
