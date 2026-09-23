-- PA2.30.3 — Source Re-ingest & Provenance Recovery acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.3 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000045a1','pa2303@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000045f1','PA2303 Org','pa2303-org',
  '00000000-0000-0000-0000-0000000045a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000045f1',
  '00000000-0000-0000-0000-0000000045a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004501',
  '00000000-0000-0000-0000-0000000045a1',
  '00000000-0000-0000-0000-000000004511',
  'pa2303-source.zip',
  '00000000-0000-0000-0000-0000000045f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000004521',
  '00000000-0000-0000-0000-0000000045a1',
  '00000000-0000-0000-0000-000000004501',
  '00000000-0000-0000-0000-000000004531',
  '406x6,3 original source','offer',now(),
  '00000000-0000-0000-0000-0000000045f1'
),(
  '00000000-0000-0000-0000-000000004523',
  '00000000-0000-0000-0000-0000000045a1',
  '00000000-0000-0000-0000-000000004501',
  '00000000-0000-0000-0000-000000004533',
  'Unrelated source','offer',now(),
  '00000000-0000-0000-0000-0000000045f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000004541',
  'wrong.eml','.eml',128,'2026/09/23/wrong.eml','completed','v4','email_message',
  1,now(),now(),
  '00000000-0000-0000-0000-0000000045a1',
  '00000000-0000-0000-0000-000000004501',
  '00000000-0000-0000-0000-000000004523',
  '00000000-0000-0000-0000-0000000045f1',
  repeat('a',64),'Wrong source'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000045f1',
  '00000000-0000-0000-0000-000000004521',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000045a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000004541',
  '2026/09/23/wrong.eml',repeat('a',64),'v4','completed',
  '{"filename":"wrong.eml","extension":".eml","size_bytes":128}'::jsonb,
  '00000000-0000-0000-0000-0000000045a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.thread_id='00000000-0000-0000-0000-000000004521';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000045a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_invalidate_offer_reparse_run(
  '00000000-0000-0000-0000-0000000045f1',
  (select id from public.commercial_offer_reparse_runs
   where thread_id='00000000-0000-0000-0000-000000004521'),
  'source_job_not_thread_bound',
  'PA2.30.3 test quarantine'
) as invalidation gset

select pg_temp.assert_true(
  :'invalidation'::jsonb->>'status'='quarantined',
  'predecessor run must be quarantined'
);

select public.p1_offer_source_reingest_readiness(
  '00000000-0000-0000-0000-0000000045f1',100
) as ready_before gset

select pg_temp.assert_true(
  (:'ready_before'::jsonb#>>'{summary,needs_reingest}')::int=1
  and (:'ready_before'::jsonb#>>'{summary,recovered}')::int=0,
  'quarantined thread must enter source re-ingest readiness'
);

select public.p1_request_offer_source_reingest(
  '00000000-0000-0000-0000-0000000045f1',
  '00000000-0000-0000-0000-000000004521',
  'recover original EML'
) as request_result gset

select pg_temp.assert_true(
  :'request_result'::jsonb->>'status'='requested'
  and (:'request_result'::jsonb->>'source_only')::boolean=true
  and (:'request_result'::jsonb->>'automatic_observation_promotion')::boolean=false,
  'source recovery request must be explicit and source-only'
);

select pg_temp.assert_true(
  not has_table_privilege('authenticated','public.commercial_offer_source_reingests','INSERT')
  and not has_table_privilege('authenticated','public.commercial_offer_source_reingests','UPDATE'),
  'browser role must not mutate source re-ingest ledger directly'
);

set local role service_role;

select public.p1_claim_offer_source_reingest(
  (:'request_result'::jsonb->>'reingest_id')::bigint,
  '00000000-0000-0000-0000-0000000045a1'
) as claim_result gset

select pg_temp.assert_true(
  :'claim_result'::jsonb->>'status'='claimed'
  and :'claim_result'::jsonb->>'thread_id'='00000000-0000-0000-0000-000000004521'
  and :'claim_result'::jsonb->>'source_conversation_id'='00000000-0000-0000-0000-000000004531',
  'worker claim must resolve exact target thread identity'
);

select public.p1_complete_offer_source_reingest(
  (:'request_result'::jsonb->>'reingest_id')::bigint,
  '00000000-0000-0000-0000-000000004542',
  'original-406x63.eml',
  '2026/09/23/original-406x63.eml',
  repeat('b',64),
  512
) as complete_result gset

select pg_temp.assert_true(
  :'complete_result'::jsonb->>'status'='consumed'
  and :'complete_result'::jsonb->>'source_binding'='direct_thread'
  and (:'complete_result'::jsonb->>'candidate_only')::boolean=true
  and (:'complete_result'::jsonb->>'observation_mutation')::boolean=false,
  'completion must create a direct source binding and candidate-only successor'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.worker_jobs w
    where w.id='00000000-0000-0000-0000-000000004542'
      and w.thread_id='00000000-0000-0000-0000-000000004521'
      and w.source_thread_id='00000000-0000-0000-0000-000000004531'
      and w.input_kind='source_reingest'
      and w.status='completed'
      and w.extraction_count=0
      and w.promoted_observation_count=0
      and w.content_checksum=repeat('b',64)
  ),
  'source job must be completed, thread-bound and promotion-free'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_runs successor
    join public.commercial_offer_reparse_runs predecessor
      on predecessor.id=successor.supersedes_run_id
    where successor.id=(:'complete_result'::jsonb->>'successor_run_id')::bigint
      and successor.thread_id='00000000-0000-0000-0000-000000004521'
      and successor.source_job_id='00000000-0000-0000-0000-000000004542'
      and successor.status='queued'
      and predecessor.id=(:'invalidation'::jsonb->>'run_id')::bigint
  ),
  'successor run must preserve immutable predecessor lineage'
);

select pg_temp.assert_true(
  (select count(*) from public.commercial_observations
   where thread_id='00000000-0000-0000-0000-000000004521')=0
  and (select count(*) from public.worker_staging_observations
       where job_id='00000000-0000-0000-0000-000000004542')=0,
  'source-only recovery must not create observations or staging evidence'
);

set local role authenticated;

select public.p1_offer_source_reingest_readiness(
  '00000000-0000-0000-0000-0000000045f1',100
) as ready_after gset

select pg_temp.assert_true(
  (:'ready_after'::jsonb#>>'{summary,recovered}')::int=1
  and exists(
    select 1 from jsonb_array_elements(:'ready_after'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004521'
      and item->>'action_status'='recovered'
      and (item->>'successor_run_id')::bigint=(:'complete_result'::jsonb->>'successor_run_id')::bigint
  ),
  'readiness must move the thread to recovered'
);

select public.p1_offer_reparse_remediation_closure_readiness(
  '00000000-0000-0000-0000-0000000045f1',100
) as closure_after gset

select pg_temp.assert_true(
  (:'closure_after'::jsonb#>>'{summary,waiting_on_run}')::int=1
  and (:'closure_after'::jsonb#>>'{summary,run_provenance_invalid}')::int=0,
  'latest successor must replace predecessor invalidation in closure semantics'
);

rollback;
