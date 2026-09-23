-- PA2.30.5 — Recovery Candidate Re-entry Audit acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.5 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000048a1','pa2305@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000048f1','PA2305 Org','pa2305-org',
  '00000000-0000-0000-0000-0000000048a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000048f1',
  '00000000-0000-0000-0000-0000000048a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004811',
  'pa2305-source.zip',
  '00000000-0000-0000-0000-0000000048f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000004821',
  '00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-000000004831',
  'Unique recovered source','offer',now(),
  '00000000-0000-0000-0000-0000000048f1'
),
(
  '00000000-0000-0000-0000-000000004822',
  '00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-000000004832',
  'Ambiguous pending source','offer',now(),
  '00000000-0000-0000-0000-0000000048f1'
),
(
  '00000000-0000-0000-0000-000000004823',
  '00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-000000004833',
  'Wrong source holder','offer',now(),
  '00000000-0000-0000-0000-0000000048f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000004841',
  'wrong.eml','.eml',128,'2026/09/23/wrong.eml','completed','v4','email_message',
  1,now(),now(),
  '00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-000000004823',
  '00000000-0000-0000-0000-0000000048f1',
  repeat('a',64),'Wrong source'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id
) values
(
  48001,'00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-000000004821',
  '00000000-0000-0000-0000-000000004831',
  'offered','outbound','Inbox/unique.eml','EUR 10/mt',0.99,'unique',
  '00000000-0000-0000-0000-0000000048f1'
),
(
  48002,'00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-000000004822',
  '00000000-0000-0000-0000-000000004832',
  'offered','outbound','Inbox/amb-a.eml','EUR 20/mt',0.99,'amb-a',
  '00000000-0000-0000-0000-0000000048f1'
),
(
  48003,'00000000-0000-0000-0000-0000000048a1',
  '00000000-0000-0000-0000-000000004801',
  '00000000-0000-0000-0000-000000004822',
  '00000000-0000-0000-0000-000000004832',
  'offered','outbound','Inbox/amb-b.eml','EUR 21/mt',0.99,'amb-b',
  '00000000-0000-0000-0000-0000000048f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values
(
  '00000000-0000-0000-0000-0000000048f1',
  '00000000-0000-0000-0000-000000004821',
  'source_reparse_required','source_email_reparse','pending','{}',
  '00000000-0000-0000-0000-0000000048a1'
),
(
  '00000000-0000-0000-0000-0000000048f1',
  '00000000-0000-0000-0000-000000004822',
  'source_reparse_required','source_email_reparse','pending','{}',
  '00000000-0000-0000-0000-0000000048a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000004841',
  '2026/09/23/wrong.eml',repeat('a',64),'v4','completed',
  '{"filename":"wrong.eml","extension":".eml","size_bytes":128}'::jsonb,
  '00000000-0000-0000-0000-0000000048a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000048f1';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000048a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_invalidate_offer_reparse_run(
  '00000000-0000-0000-0000-0000000048f1',
  (select id from public.commercial_offer_reparse_runs
   where thread_id='00000000-0000-0000-0000-000000004821'),
  'source_job_not_thread_bound','unique predecessor'
) as inv_unique \gset

select public.p1_invalidate_offer_reparse_run(
  '00000000-0000-0000-0000-0000000048f1',
  (select id from public.commercial_offer_reparse_runs
   where thread_id='00000000-0000-0000-0000-000000004822'),
  'source_job_not_thread_bound','amb predecessor'
) as inv_amb \gset

select public.p1_request_offer_source_reingest(
  '00000000-0000-0000-0000-0000000048f1',
  '00000000-0000-0000-0000-000000004821',
  'PA2.30.5 recovered source'
) as request_unique \gset

set local role service_role;

select public.p1_claim_offer_source_reingest(
  (:'request_unique'::jsonb->>'reingest_id')::bigint,
  '00000000-0000-0000-0000-0000000048a1'
) as claim_unique \gset

select public.p1_complete_offer_source_reingest(
  (:'request_unique'::jsonb->>'reingest_id')::bigint,
  '00000000-0000-0000-0000-000000004842',
  'unique.eml',
  '2026/09/23/unique.eml',
  repeat('b',64),
  256
) as complete_unique \gset

update public.commercial_offer_reparse_runs
set status='completed',started_at=now(),completed_at=now()
where id=(:'complete_unique'::jsonb->>'successor_run_id')::bigint;

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
) values(
  '00000000-0000-0000-0000-0000000048f1',
  (:'complete_unique'::jsonb->>'successor_run_id')::bigint,
  '00000000-0000-0000-0000-000000004821',
  0,'EUR 10/mt','offered',
  '{"price_value":10,"price_unit":"mt","currency":"EUR"}',
  '{"comparison_mode":"descriptive_only"}','pending_review'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000048a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_offer_recovery_candidate_reentry_audit(
  '00000000-0000-0000-0000-0000000048f1',100
) as audit \gset

select pg_temp.assert_true(
  (:'audit'::jsonb#>>'{summary,target_threads}')::int=2
  and (:'audit'::jsonb#>>'{summary,candidate_review_ready}')::int=1
  and (:'audit'::jsonb#>>'{summary,ambiguous_selection_required}')::int=1
  and (:'audit'::jsonb#>>'{summary,total_successor_candidates}')::int=1,
  'audit summary must separate recovered candidate re-entry from ambiguous pending recovery'
);

select pg_temp.assert_true(
  exists(
    select 1
    from jsonb_array_elements(:'audit'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004821'
      and item->>'reentry_status'='candidate_review_ready'
      and item->>'successor_binding_status'='valid_direct_thread'
      and (item->>'candidate_count')::int=1
      and (item->>'pending_review_count')::int=1
  ),
  'consumed completed direct-thread successor must re-enter candidate review'
);

select pg_temp.assert_true(
  exists(
    select 1
    from jsonb_array_elements(:'audit'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004822'
      and item->>'reentry_status'='ambiguous_selection_required'
      and jsonb_array_length(item->'offered_source_filenames')=2
  ),
  'ambiguous thread without re-ingest must remain explicitly blocked'
);

select pg_temp.assert_true(
  (:'audit'::jsonb#>>'{policy,automatic_candidate_adoption}')::boolean=false
  and (:'audit'::jsonb#>>'{policy,automatic_remediation_closure}')::boolean=false
  and (:'audit'::jsonb#>>'{policy,invalidated_predecessor_candidates_remain_quarantined}')::boolean=true,
  'candidate re-entry audit must remain read-only and fail closed'
);

rollback;
