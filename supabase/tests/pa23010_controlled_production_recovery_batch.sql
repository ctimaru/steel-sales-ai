-- PA2.30.10 — Controlled Production Recovery Batch Cutover acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.10 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000053a1','pa23010@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000053f1','PA23010 Org','pa23010-org',
  '00000000-0000-0000-0000-0000000053a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000053f1',
  '00000000-0000-0000-0000-0000000053a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005311',
  'pa23010.zip',
  '00000000-0000-0000-0000-0000000053f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000005321',
  '00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-000000005331',
  'Unique offered source','offer',now(),
  '00000000-0000-0000-0000-0000000053f1'
),
(
  '00000000-0000-0000-0000-000000005322',
  '00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-000000005332',
  'Ambiguous offered source','offer',now(),
  '00000000-0000-0000-0000-0000000053f1'
);

insert into public.commercial_observations(
  owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id
) values
(
  '00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-000000005321',
  '00000000-0000-0000-0000-000000005331',
  'offered','outbound','Inbox/unique.eml','unique',.99,'unique',
  '00000000-0000-0000-0000-0000000053f1'
),
(
  '00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-000000005322',
  '00000000-0000-0000-0000-000000005332',
  'offered','outbound','Inbox/a.eml','a',.99,'a',
  '00000000-0000-0000-0000-0000000053f1'
),
(
  '00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-000000005322',
  '00000000-0000-0000-0000-000000005332',
  'offered','outbound','Inbox/b.eml','b',.99,'b',
  '00000000-0000-0000-0000-0000000053f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values
(
  '00000000-0000-0000-0000-0000000053f1',
  '00000000-0000-0000-0000-000000005321',
  'source_reparse_required','source_email_reparse','pending','{}',
  '00000000-0000-0000-0000-0000000053a1'
),
(
  '00000000-0000-0000-0000-0000000053f1',
  '00000000-0000-0000-0000-000000005322',
  'source_reparse_required','source_email_reparse','pending','{}',
  '00000000-0000-0000-0000-0000000053a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values
(
  '00000000-0000-0000-0000-000000005341',
  'legacy-unique.eml','.eml',1,'legacy/unique.eml','completed','v4','source_reingest',
  0,now(),now(),'00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-000000005321',
  '00000000-0000-0000-0000-0000000053f1',repeat('a',64),'unique'
),
(
  '00000000-0000-0000-0000-000000005342',
  'legacy-ambiguous.eml','.eml',1,'legacy/ambiguous.eml','completed','v4','source_reingest',
  0,now(),now(),'00000000-0000-0000-0000-0000000053a1',
  '00000000-0000-0000-0000-000000005301',
  '00000000-0000-0000-0000-000000005322',
  '00000000-0000-0000-0000-0000000053f1',repeat('b',64),'ambiguous'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  case when q.thread_id='00000000-0000-0000-0000-000000005321'
    then '00000000-0000-0000-0000-000000005341'::uuid
    else '00000000-0000-0000-0000-000000005342'::uuid end,
  'legacy.eml',repeat('c',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000053a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000053f1';

insert into public.commercial_offer_reparse_run_invalidations(
  organization_id,run_id,remediation_queue_id,thread_id,source_job_id,
  reason,evidence_snapshot,invalidated_by
)
select
  r.organization_id,r.id,r.remediation_queue_id,r.thread_id,r.source_job_id,
  'manual_provenance_invalid','{}',
  '00000000-0000-0000-0000-0000000053a1'
from public.commercial_offer_reparse_runs r
where r.organization_id='00000000-0000-0000-0000-0000000053f1';

insert into private.commercial_offer_recovery_transfer_chunks(
  transfer_id,part_no,payload_base64
) values
('pa23010-test',0,'YWJj'),
('pa23010-test',1,'ZGVm');

set local role service_role;

select public.p1_prepare_offer_source_recovery_bootstrap(
  '00000000-0000-0000-0000-0000000053f1',
  '00000000-0000-0000-0000-0000000053a1',
  'pa23010-test',1,1
) as prepared \gset

select pg_temp.assert_true(
  :'prepared'::jsonb->>'status'='ready'
  and (:'prepared'::jsonb->>'unique_count')::int=1
  and (:'prepared'::jsonb->>'ambiguous_count')::int=1
  and jsonb_array_length(:'prepared'::jsonb->'items')=1,
  'bootstrap must prepare exactly the unique source population'
);

select pg_temp.assert_true(
  (select count(*)=1
   from public.commercial_offer_source_reingests
   where organization_id='00000000-0000-0000-0000-0000000053f1')
  and not exists(
    select 1
    from public.commercial_offer_source_reingests
    where organization_id='00000000-0000-0000-0000-0000000053f1'
      and thread_id='00000000-0000-0000-0000-000000005322'
  ),
  'ambiguous thread must remain untouched'
);

select public.p1_offer_source_recovery_transfer_payload('pa23010-test') as payload \gset
select pg_temp.assert_true(
  :'payload'::jsonb->>'status'='ready'
  and :'payload'::jsonb->>'payload_base64'='YWJjZGVm',
  'transfer chunks must reassemble in part order'
);

select public.p1_prepare_offer_source_recovery_bootstrap(
  '00000000-0000-0000-0000-0000000053f1',
  '00000000-0000-0000-0000-0000000053a1',
  'pa23010-test',2,0
) as drift \gset
select pg_temp.assert_true(
  :'drift'::jsonb->>'status'='blocked'
  and :'drift'::jsonb->>'reason'='recovery_population_drift',
  'population drift must fail closed'
);

select public.p1_cleanup_offer_source_recovery_transfer('pa23010-test') as cleaned \gset
select pg_temp.assert_true(
  :'cleaned'::jsonb->>'status'='cleaned'
  and not exists(
    select 1 from private.commercial_offer_recovery_transfer_chunks
    where transfer_id='pa23010-test'
  ),
  'cleanup must remove transfer payload'
);

select public.p1_store_offer_source_recovery_transfer_chunk(
  'pa23010-writer-test',0,'YWJjZA=='
) as stored \\gset

select pg_temp.assert_true(
  :'stored'::jsonb->>'status'='stored'
  and exists(
    select 1
    from private.commercial_offer_recovery_transfer_chunks
    where transfer_id='pa23010-writer-test'
      and part_no=0
      and payload_base64='YWJjZA=='
  ),
  'service-role upload bridge must store an explicit base64 transfer chunk'
);

rollback;
