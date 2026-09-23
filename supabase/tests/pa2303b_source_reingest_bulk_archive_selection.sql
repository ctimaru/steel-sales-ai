-- PA2.30.3b — Bulk archive source selection acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.3b assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000046a1','pa2303b@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000046f1','PA2303B Org','pa2303b-org',
  '00000000-0000-0000-0000-0000000046a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000046f1',
  '00000000-0000-0000-0000-0000000046a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004611',
  'pa2303b-source.zip',
  '00000000-0000-0000-0000-0000000046f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000004621',
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-000000004631',
  'Unique offered source','offer',now(),
  '00000000-0000-0000-0000-0000000046f1'
),
(
  '00000000-0000-0000-0000-000000004622',
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-000000004632',
  'Ambiguous offered source','offer',now(),
  '00000000-0000-0000-0000-0000000046f1'
),
(
  '00000000-0000-0000-0000-000000004623',
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-000000004633',
  'Unrelated source','offer',now(),
  '00000000-0000-0000-0000-0000000046f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000004641',
  'wrong.eml','.eml',128,'2026/09/23/wrong.eml','completed','v4','email_message',
  1,now(),now(),
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-000000004623',
  '00000000-0000-0000-0000-0000000046f1',
  repeat('a',64),'Wrong source'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id
) values
(
  46001,
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-000000004621',
  '00000000-0000-0000-0000-000000004631',
  'offered','outbound',
  'Inbox/unique-offer.eml','Offro EUR 10/mt',0.98,'unique offered',
  '00000000-0000-0000-0000-0000000046f1'
),
(
  46002,
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-000000004622',
  '00000000-0000-0000-0000-000000004632',
  'offered','outbound',
  'Inbox/ambiguous-a.eml','Offro EUR 20/mt',0.98,'ambiguous a',
  '00000000-0000-0000-0000-0000000046f1'
),
(
  46003,
  '00000000-0000-0000-0000-0000000046a1',
  '00000000-0000-0000-0000-000000004601',
  '00000000-0000-0000-0000-000000004622',
  '00000000-0000-0000-0000-000000004632',
  'offered','outbound',
  'Inbox/ambiguous-b.eml','Offro EUR 21/mt',0.98,'ambiguous b',
  '00000000-0000-0000-0000-0000000046f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values
(
  '00000000-0000-0000-0000-0000000046f1',
  '00000000-0000-0000-0000-000000004621',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000046a1'
),
(
  '00000000-0000-0000-0000-0000000046f1',
  '00000000-0000-0000-0000-000000004622',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000046a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000004641',
  '2026/09/23/wrong.eml',repeat('a',64),'v4','completed',
  '{"filename":"wrong.eml","extension":".eml","size_bytes":128}'::jsonb,
  '00000000-0000-0000-0000-0000000046a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.thread_id in (
  '00000000-0000-0000-0000-000000004621',
  '00000000-0000-0000-0000-000000004622'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000046a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_invalidate_offer_reparse_run(
  '00000000-0000-0000-0000-0000000046f1',
  (select id from public.commercial_offer_reparse_runs
   where thread_id='00000000-0000-0000-0000-000000004621'),
  'source_job_not_thread_bound',
  'unique test'
) as unique_invalidation \gset

select public.p1_invalidate_offer_reparse_run(
  '00000000-0000-0000-0000-0000000046f1',
  (select id from public.commercial_offer_reparse_runs
   where thread_id='00000000-0000-0000-0000-000000004622'),
  'source_job_not_thread_bound',
  'ambiguous test'
) as ambiguous_invalidation \gset

select public.p1_offer_source_reingest_readiness(
  '00000000-0000-0000-0000-0000000046f1',100
) as readiness \gset

select pg_temp.assert_true(
  (:'readiness'::jsonb#>>'{summary,batch_auto_match_ready}')::int=1
  and (:'readiness'::jsonb#>>'{summary,batch_ambiguous}')::int=1,
  'bulk readiness must separate unique and ambiguous offered sources'
);

select pg_temp.assert_true(
  exists(
    select 1
    from jsonb_array_elements(:'readiness'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004621'
      and item->>'source_selection_status'='unique_offered_source'
      and item->>'preferred_source_filename'='Inbox/unique-offer.eml'
  )
  and exists(
    select 1
    from jsonb_array_elements(:'readiness'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004622'
      and item->>'source_selection_status'='ambiguous_offered_source'
      and (item->>'preferred_source_filename') is null
  ),
  'preferred source must exist only for a unique offered filename'
);

select public.p1_request_offer_source_reingest(
  '00000000-0000-0000-0000-0000000046f1',
  '00000000-0000-0000-0000-000000004621',
  'unique batch request'
) as unique_request \gset

select public.p1_request_offer_source_reingest(
  '00000000-0000-0000-0000-0000000046f1',
  '00000000-0000-0000-0000-000000004622',
  'ambiguous generic request'
) as ambiguous_request \gset

select pg_temp.assert_true(
  :'ambiguous_request'::jsonb->>'status'='blocked'
  and :'ambiguous_request'::jsonb->>'reason'='ambiguous_source_selection_required',
  'ambiguous offered sources must never enter generic or bulk recovery'
);

set local role service_role;

select public.p1_claim_offer_source_reingest(
  (:'unique_request'::jsonb->>'reingest_id')::bigint,
  '00000000-0000-0000-0000-0000000046a1'
) as unique_claim \gset

select pg_temp.assert_true(
  :'unique_claim'::jsonb->>'source_selection_status'='unique_offered_source'
  and :'unique_claim'::jsonb->>'preferred_source_filename'='Inbox/unique-offer.eml'
  and jsonb_array_length(:'unique_claim'::jsonb->'offered_source_filenames')=1,
  'worker claim must carry the database-selected unique offered source'
);

rollback;
