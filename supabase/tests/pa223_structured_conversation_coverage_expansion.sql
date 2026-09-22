-- PA2.23 structured Conversation / Message coverage expansion acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.23 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000037a1','pa223@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000037f1','PA223 Org','pa223-org',
'00000000-0000-0000-0000-0000000037a1','completed'
);

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-0000000037a1',
'admin','sales_director','active',true
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000003701',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003711',
'pa223.eml',
'00000000-0000-0000-0000-0000000037f1'
);

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,
started_at,last_activity_at,email_count,organization_id
) values
(
'00000000-0000-0000-0000-000000003721',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003701',
'00000000-0000-0000-0000-000000003731',
'Ready deterministic thread','rfq',
'2026-09-01T10:00:00Z','2026-09-01T11:00:00Z',3,
'00000000-0000-0000-0000-0000000037f1'
),
(
'00000000-0000-0000-0000-000000003722',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003701',
'00000000-0000-0000-0000-000000003732',
'Already normalized thread','rfq',
'2026-09-02T10:00:00Z','2026-09-02T11:00:00Z',2,
'00000000-0000-0000-0000-0000000037f1'
);

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status,started_at,last_activity_at
) values(
'00000000-0000-0000-0000-000000003741',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'Already normalized thread',
'00000000-0000-0000-0000-000000003732',
'open',
'2026-09-02T10:00:00Z','2026-09-02T11:00:00Z'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000037a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_structured_conversation_coverage_readiness(
    '00000000-0000-0000-0000-0000000037f1',100
  )#>>'{summary,conversation_ready}')::int=1
  and
  (public.p1_structured_conversation_coverage_readiness(
    '00000000-0000-0000-0000-0000000037f1',100
  )#>>'{summary,conversation_already_normalized}')::int=1,
  'one thread must be ready and one already normalized'
);

select pg_temp.assert_true(
  (public.p1_structured_conversation_coverage_readiness(
    '00000000-0000-0000-0000-0000000037f1',100
  )#>>'{summary,message_ready}')::int=0
  and
  (public.p1_structured_conversation_coverage_readiness(
    '00000000-0000-0000-0000-0000000037f1',100
  )#>>'{summary,source_email_count}')::int=5,
  'Message synthesis must remain disabled despite aggregate email_count'
);

select public.p1_expand_structured_conversation(
  '00000000-0000-0000-0000-0000000037f1',
  '00000000-0000-0000-0000-000000003721'
) as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='expanded',
  'ready thread must create one normalized Conversation'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.conversations
    where id=(:'first_result'::jsonb->>'conversation_id')::uuid
      and organization_id='00000000-0000-0000-0000-0000000037f1'
      and external_thread_id='00000000-0000-0000-0000-000000003731'
      and subject='Ready deterministic thread'
      and company_id is null
      and started_at='2026-09-01T10:00:00Z'
      and last_activity_at='2026-09-01T11:00:00Z'
  ),
  'Conversation must copy only structured thread identity and metadata'
);

select pg_temp.assert_true(
  (select count(*) from public.messages where organization_id='00000000-0000-0000-0000-0000000037f1')=0,
  'PA2.23 must not synthesize Message rows'
);

select pg_temp.assert_true(
  (select count(*) from public.commercial_conversation_expansions
   where organization_id='00000000-0000-0000-0000-0000000037f1')=1,
  'one immutable Conversation expansion audit row must be recorded'
);

select public.p1_expand_structured_conversation(
  '00000000-0000-0000-0000-0000000037f1',
  '00000000-0000-0000-0000-000000003721'
) as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'status'='already_normalized'
  and :'second_result'::jsonb->>'conversation_id'=:'first_result'::jsonb->>'conversation_id'
  and (select count(*) from public.conversations
       where organization_id='00000000-0000-0000-0000-0000000037f1')=2
  and (select count(*) from public.commercial_conversation_expansions
       where organization_id='00000000-0000-0000-0000-0000000037f1')=1,
  'repeat expansion must be idempotent'
);

rollback;
