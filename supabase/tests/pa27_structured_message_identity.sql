-- PA2.7 structured message identity capture / reconstruction acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.7 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000032a1','pa27@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000032f1',
'PA27 Org',
'pa27-org',
'00000000-0000-0000-0000-0000000032a1',
'completed'
);

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000032f1',
'00000000-0000-0000-0000-0000000032a1',
'admin','sales_director','active',true
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,status,organization_id
) values(
'00000000-0000-0000-0000-000000003201',
'00000000-0000-0000-0000-0000000032a1',
'00000000-0000-0000-0000-000000003211',
'pa27.eml',
'active',
'00000000-0000-0000-0000-0000000032f1'
);

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,
started_at,last_activity_at,email_count,organization_id
) values(
'00000000-0000-0000-0000-000000003221',
'00000000-0000-0000-0000-0000000032a1',
'00000000-0000-0000-0000-000000003201',
'00000000-0000-0000-0000-000000003231',
'RFQ PA27',
'rfq',
'2026-09-22T06:15:00Z',
'2026-09-22T06:15:00Z',
1,
'00000000-0000-0000-0000-0000000032f1'
);

insert into public.worker_jobs(
id,filename,extension,size_bytes,storage_path,status,created_at,
owner_id,dataset_id,thread_id,organization_id,
source_message_id,source_thread_id,sender_email,recipient_emails,sent_at,email_subject
) values(
'00000000-0000-0000-0000-000000003241',
'pa27.eml','.eml',100,'2026/09/22/pa27.eml','completed','2026-09-22T06:15:00Z',
'00000000-0000-0000-0000-0000000032a1',
'00000000-0000-0000-0000-000000003201',
'00000000-0000-0000-0000-000000003221',
'00000000-0000-0000-0000-0000000032f1',
'<pa27@example.com>',
'provider-thread-27',
'buyer@example.com',
array['sales@steel.example','purchasing@example.com'],
'2026-09-22T06:15:00Z',
'RFQ PA27'
);

set local role service_role;

select public.materialize_worker_message_identity(
  '00000000-0000-0000-0000-000000003241'
) as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='materialized'
  and (select count(*) from public.conversations)=1
  and (select count(*) from public.messages)=1,
  'structured Message-ID must materialize one conversation and one message'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.external_message_id='<pa27@example.com>'
      and m.source_thread_id='provider-thread-27'
      and m.sender_email='buyer@example.com'
      and m.recipient_emails=array['sales@steel.example','purchasing@example.com']
      and m.sent_at='2026-09-22T06:15:00Z'::timestamptz
      and m.subject='RFQ PA27'
      and c.external_thread_id='00000000-0000-0000-0000-000000003231'
      and c.organization_id='00000000-0000-0000-0000-0000000032f1'
  ),
  'normalized message must preserve captured RFC822 identity'
);

select public.materialize_worker_message_identity(
  '00000000-0000-0000-0000-000000003241'
) as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'message_id'=:'first_result'::jsonb->>'message_id'
  and :'second_result'::jsonb->>'conversation_id'=:'first_result'::jsonb->>'conversation_id'
  and (select count(*) from public.conversations)=1
  and (select count(*) from public.messages)=1,
  'repeat materialization must be idempotent'
);

insert into public.worker_jobs(
id,filename,extension,size_bytes,storage_path,status,created_at,
owner_id,dataset_id,thread_id,organization_id,
source_message_id,sender_email,recipient_emails,email_subject
) values(
'00000000-0000-0000-0000-000000003242',
'no-message-id.eml','.eml',100,'2026/09/22/no-message-id.eml','completed','2026-09-22T06:30:00Z',
'00000000-0000-0000-0000-0000000032a1',
'00000000-0000-0000-0000-000000003201',
'00000000-0000-0000-0000-000000003221',
'00000000-0000-0000-0000-0000000032f1',
null,
'buyer2@example.com',
array['sales@steel.example'],
'RFQ without Message-ID'
);

select public.materialize_worker_message_identity(
  '00000000-0000-0000-0000-000000003242'
) as missing_id_result \gset

select pg_temp.assert_true(
  :'missing_id_result'::jsonb->>'status'='captured_only'
  and :'missing_id_result'::jsonb->>'reason'='missing_message_id'
  and (select count(*) from public.messages)=1,
  'missing Message-ID must retain captured evidence without inventing normalized message identity'
);

reset role;
rollback;
