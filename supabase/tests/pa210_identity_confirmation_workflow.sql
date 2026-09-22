-- PA2.10 identity confirmation workflow acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.10 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000035a1','pa210@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000035f1','PA210 Org','pa210-org',
'00000000-0000-0000-0000-0000000035a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-0000000035a1',
'admin','sales_director','active',true);

insert into public.companies(
id,owner_id,organization_id,name,company_type,vat_number
) values(
'00000000-0000-0000-0000-000000003501',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'Verified Co','customer','IT99999999999');

insert into public.commercial_company_identity_verifications(
organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values(
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003501',
'vat_number','IT99999999999','vat_document',
'00000000-0000-0000-0000-0000000035a1');

insert into public.contacts(
id,owner_id,organization_id,full_name,email
) values(
'00000000-0000-0000-0000-000000003502',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'Buyer Person','buyer@example.com');

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status,started_at,last_activity_at
) values(
'00000000-0000-0000-0000-000000003503',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'RFQ','thread-35','open',now(),now());

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,sender_email,subject
) values(
'00000000-0000-0000-0000-000000003504',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003503',
'<pa210@example.com>','buyer@example.com','RFQ');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000035a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_identity_confirmation_queue(
    '00000000-0000-0000-0000-0000000035f1',100
  )#>>'{summary,unresolved_contacts}')::int=1,
  'queue must expose unresolved Contact'
);

select pg_temp.assert_true(
  (public.p1_identity_confirmation_queue(
    '00000000-0000-0000-0000-0000000035f1',100
  )#>>'{summary,verified_companies}')::int=1,
  'queue must expose verified Company'
);

select public.confirm_contact_company_mapping(
  '00000000-0000-0000-0000-000000003502',
  '00000000-0000-0000-0000-000000003501',
  '{"source":"acceptance"}'::jsonb
) as result \gset

select pg_temp.assert_true(
  :'result'::jsonb->>'status'='confirmed'
  and (select company_id from public.contacts where id='00000000-0000-0000-0000-000000003502')
      ='00000000-0000-0000-0000-000000003501'::uuid
  and (select sender_company_id from public.messages where id='00000000-0000-0000-0000-000000003504')
      ='00000000-0000-0000-0000-000000003501'::uuid
  and (select count(*) from public.commercial_contact_company_mappings)=1,
  'confirmation must map Contact and propagate Company to Message with one audit event'
);

select pg_temp.assert_true(
  (public.p1_identity_confirmation_queue(
    '00000000-0000-0000-0000-0000000035f1',100
  )#>>'{summary,unresolved_contacts}')::int=0,
  'confirmed Contact must leave unresolved queue'
);

reset role;
rollback;
