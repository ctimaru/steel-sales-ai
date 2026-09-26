-- P2.5 identity confirmation → outcome activation hook acceptance.
begin;

create or replace function pg_temp.p25h_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P2.5 hook assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000026a1','p25-hook@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000026f1',
  'P25 Hook Org',
  'p25-hook-org',
  '00000000-0000-0000-0000-0000000026a1',
  'completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-0000000026a1',
  'admin','sales_director','active',true
);

insert into public.companies(
  id,owner_id,organization_id,name,company_type,country,vat_number
) values(
  '00000000-0000-0000-0000-000000002601',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  'Verified Outcome Co','customer','IT','IT26000000001'
);

insert into public.commercial_company_identity_verifications(
  organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values(
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002601',
  'vat_number','IT26000000001','vat_document',
  '00000000-0000-0000-0000-0000000026a1'
);

insert into public.contacts(
  id,owner_id,organization_id,full_name,email
) values(
  '00000000-0000-0000-0000-000000002611',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  'Outcome Buyer','outcome.buyer@example.com'
);

insert into public.conversations(
  id,owner_id,organization_id,subject,external_thread_id,status
) values(
  '00000000-0000-0000-0000-000000002621',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  'Outcome order','p25-hook-thread','open'
);

insert into public.messages(
  id,owner_id,organization_id,conversation_id,external_message_id,
  direction,sender_email,subject,sent_at
) values(
  '00000000-0000-0000-0000-000000002631',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002621',
  '<p25-hook>','inbound','outcome.buyer@example.com','Outcome order',now()
);

insert into public.orders(
  id,owner_id,organization_id,conversation_id,status,ordered_at
) values(
  '00000000-0000-0000-0000-000000002641',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002621',
  'received',now()
);

insert into public.order_lines(
  id,owner_id,organization_id,order_id,canonical_product_key,raw_spec_text
) values(
  '00000000-0000-0000-0000-000000002651',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002641',
  'tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:273|t=8|process=_',
  'Order 273x8'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000026a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.confirm_contact_company_mapping(
  '00000000-0000-0000-0000-000000002611',
  '00000000-0000-0000-0000-000000002601',
  '{"source":"p2.5_hook_acceptance"}'::jsonb
) as result \gset

select pg_temp.p25h_assert(
  :'result'::jsonb->>'status'='confirmed'
  and (:'result'::jsonb->>'activated_conversations')::int=1
  and (:'result'::jsonb->>'outcome_orders_attributed')::int=1,
  'human confirmation must activate Conversation and reconcile Order in the same call'
);

select pg_temp.p25h_assert(
  (select company_id
   from public.conversations
   where id='00000000-0000-0000-0000-000000002621')
    ='00000000-0000-0000-0000-000000002601'::uuid
  and
  (select company_id
   from public.orders
   where id='00000000-0000-0000-0000-000000002641')
    ='00000000-0000-0000-0000-000000002601'::uuid,
  'Conversation and Order must share the verified Company after one human confirmation'
);

select pg_temp.p25h_assert(
  (public.p2_commercial_conversion_foundation(
    '00000000-0000-0000-0000-0000000026f1',100,0
  )#>>'{summary,attributed_order_count}')::int=1,
  'conversion foundation must immediately observe the newly attributed Order'
);

reset role;
rollback;
