-- PA2.30.2 — Reparse Provenance Integrity Guard & Invalid Result Quarantine acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.2 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000044a1','pa2302@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000044f1','PA2302 Org','pa2302-org',
  '00000000-0000-0000-0000-0000000044a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000044f1',
  '00000000-0000-0000-0000-0000000044a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004401',
  '00000000-0000-0000-0000-0000000044a1',
  '00000000-0000-0000-0000-000000004411',
  'pa2302-source.zip',
  '00000000-0000-0000-0000-0000000044f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000004421',
  '00000000-0000-0000-0000-0000000044a1',
  '00000000-0000-0000-0000-000000004401',
  '00000000-0000-0000-0000-000000004431',
  'Invalid provenance target','offer',now(),
  '00000000-0000-0000-0000-0000000044f1'
),
(
  '00000000-0000-0000-0000-000000004422',
  '00000000-0000-0000-0000-0000000044a1',
  '00000000-0000-0000-0000-000000004401',
  '00000000-0000-0000-0000-000000004432',
  'Valid direct source target','offer',now(),
  '00000000-0000-0000-0000-0000000044f1'
),
(
  '00000000-0000-0000-0000-000000004423',
  '00000000-0000-0000-0000-0000000044a1',
  '00000000-0000-0000-0000-000000004401',
  '00000000-0000-0000-0000-000000004433',
  'Unrelated source thread','offer',now(),
  '00000000-0000-0000-0000-0000000044f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,source_thread_id,email_subject
) values
(
  '00000000-0000-0000-0000-000000004441',
  'unrelated-source.eml','.eml',512,'2026/09/23/unrelated-source.eml','completed','v4',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000044a1',
  '00000000-0000-0000-0000-000000004401',
  '00000000-0000-0000-0000-000000004423',
  '00000000-0000-0000-0000-0000000044f1',
  repeat('a',64),null,'Unrelated source'
),
(
  '00000000-0000-0000-0000-000000004442',
  'valid-direct.eml','.eml',512,'2026/09/23/valid-direct.eml','completed','v4',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000044a1',
  '00000000-0000-0000-0000-000000004401',
  '00000000-0000-0000-0000-000000004422',
  '00000000-0000-0000-0000-0000000044f1',
  repeat('b',64),'00000000-0000-0000-0000-000000004432','Valid direct source'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,outer_diameter_mm,thickness_mm,length_mm,
  quantity,quantity_unit,price_value,price_unit,currency,
  source_filename,source_text,confidence,search_text,organization_id
) values(
  44001,
  '00000000-0000-0000-0000-0000000044a1',
  '00000000-0000-0000-0000-000000004401',
  '00000000-0000-0000-0000-000000004421',
  '00000000-0000-0000-0000-000000004431',
  'offered','outbound','round_tube','P265GH',406.4,6.3,12000,
  null,null,null,null,null,'real-target.eml',
  'P265GH 406,4x6,3x12000',0.97,'pa2302 invalid target',
  '00000000-0000-0000-0000-0000000044f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values
(
  '00000000-0000-0000-0000-0000000044f1',
  '00000000-0000-0000-0000-000000004421',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000044a1'
),
(
  '00000000-0000-0000-0000-0000000044f1',
  '00000000-0000-0000-0000-000000004422',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000044a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000004441',
  '2026/09/23/unrelated-source.eml',
  repeat('a',64),'v4','completed',
  jsonb_build_object(
    'source_job_id','00000000-0000-0000-0000-000000004441',
    'filename','unrelated-source.eml',
    'storage_path','2026/09/23/unrelated-source.eml'
  ),
  '00000000-0000-0000-0000-0000000044a1',
  now(),now()
from public.commercial_offer_remediation_queue q
where q.thread_id='00000000-0000-0000-0000-000000004421';

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
)
select
  r.organization_id,r.id,r.thread_id,0,
  'S355 273x8 x12000 2 pacchi','offered',
  jsonb_build_object(
    'source_text','S355 273x8 x12000 2 pacchi',
    'item_role','offered',
    'grade','S355',
    'outer_diameter_mm',273,
    'thickness_mm',8,
    'length_mm',12000,
    'quantity',2,
    'quantity_unit','PACCHI'
  ),
  jsonb_build_object('comparison_mode','descriptive_only'),
  'pending_review'
from public.commercial_offer_reparse_runs r
where r.thread_id='00000000-0000-0000-0000-000000004421';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000044a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_run_invalidations',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_run_invalidations',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_run_invalidations',
    'DELETE'
  ),
  'browser role must not mutate invalidation ledger directly'
);

select public.p1_offer_reparse_provenance_audit(
  '00000000-0000-0000-0000-0000000044f1',100
) as audit_before \gset

select pg_temp.assert_true(
  (:'audit_before'::jsonb#>>'{summary,invalid_unbound_source_job}')::int=1
  and (:'audit_before'::jsonb#>>'{summary,quarantined}')::int=0,
  'unbound same-dataset source must be detected before quarantine'
);

select public.p1_offer_source_reparse_readiness(
  '00000000-0000-0000-0000-0000000044f1',100
) as readiness_before \gset

select pg_temp.assert_true(
  (:'readiness_before'::jsonb#>>'{summary,ready}')::int=1
  and (:'readiness_before'::jsonb#>>'{summary,already_requested}')::int=1,
  'strict resolver must keep direct thread source ready while existing invalid run remains requested'
);

select public.p1_invalidate_offer_reparse_run(
  '00000000-0000-0000-0000-0000000044f1',
  (
    select id from public.commercial_offer_reparse_runs
    where thread_id='00000000-0000-0000-0000-000000004421'
  ),
  'source_job_not_thread_bound',
  'Same-dataset fallback selected an unrelated source job'
) as quarantine_result \gset

select pg_temp.assert_true(
  :'quarantine_result'::jsonb->>'status'='quarantined'
  and :'quarantine_result'::jsonb->>'binding_status'='invalid_unbound_source_job',
  'invalid run must be explicitly quarantined'
);

select public.p1_offer_reparse_candidate_review(
  '00000000-0000-0000-0000-0000000044f1',100
) as review_after \gset

select pg_temp.assert_true(
  (:'review_after'::jsonb#>>'{summary,candidate_count}')::int=0
  and (:'review_after'::jsonb#>>'{summary,quarantined}')::int=1
  and jsonb_array_length(:'review_after'::jsonb->'items')=0,
  'quarantined candidate must disappear from actionable review without deletion'
);

select public.p1_adopt_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000044f1',
  (
    select id from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004421'
  ),
  44001,
  array['quantity','quantity_unit'],
  'must be blocked'
) as adopt_after \gset

select public.p1_reject_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000044f1',
  (
    select id from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004421'
  ),
  'must also be blocked'
) as reject_after \gset

select pg_temp.assert_true(
  :'adopt_after'::jsonb->>'status'='blocked'
  and :'adopt_after'::jsonb->>'reason'='run_provenance_invalid'
  and :'reject_after'::jsonb->>'status'='blocked'
  and :'reject_after'::jsonb->>'reason'='run_provenance_invalid',
  'quarantine must block both commercial adoption and rejection'
);

select public.p1_offer_reparse_remediation_closure_readiness(
  '00000000-0000-0000-0000-0000000044f1',100
) as closure_after \gset

select pg_temp.assert_true(
  (:'closure_after'::jsonb#>>'{summary,run_provenance_invalid}')::int=1
  and exists(
    select 1
    from jsonb_array_elements(:'closure_after'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004421'
      and item->>'closure_status'='run_provenance_invalid'
      and (item->>'reingest_required')::boolean=true
  ),
  'invalid run must block closure and require re-ingest'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000044f1',
  (
    select id from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004421'
  ),
  'must not close'
) as close_after \gset

select pg_temp.assert_true(
  :'close_after'::jsonb->>'status'='blocked'
  and :'close_after'::jsonb->>'reason'='run_provenance_invalid',
  'quarantined run must never resolve or dismiss remediation'
);

select public.p1_offer_source_reparse_readiness(
  '00000000-0000-0000-0000-0000000044f1',100
) as readiness_after \gset

select pg_temp.assert_true(
  (:'readiness_after'::jsonb#>>'{summary,source_provenance_invalid}')::int=1
  and (:'readiness_after'::jsonb#>>'{summary,ready}')::int=1,
  'readiness must distinguish quarantined thread from valid direct source'
);

select public.p1_request_offer_source_reparse(
  '00000000-0000-0000-0000-0000000044f1',
  '00000000-0000-0000-0000-000000004421'
) as invalid_request \gset

select pg_temp.assert_true(
  :'invalid_request'::jsonb->>'status'='blocked'
  and :'invalid_request'::jsonb->>'reason'='previous_run_provenance_invalid'
  and (:'invalid_request'::jsonb->>'reingest_required')::boolean=true,
  'invalid thread must not reuse another same-dataset source'
);

select public.p1_request_offer_source_reparse(
  '00000000-0000-0000-0000-0000000044f1',
  '00000000-0000-0000-0000-000000004422'
) as valid_request \gset

select pg_temp.assert_true(
  :'valid_request'::jsonb->>'status'='queued'
  and :'valid_request'::jsonb->>'source_job_id'='00000000-0000-0000-0000-000000004442',
  'direct thread-bound source must remain requestable'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004421'
      and review_status='pending_review'
  )
  and not exists(
    select 1
    from public.commercial_offer_reparse_candidate_decisions
    where thread_id='00000000-0000-0000-0000-000000004421'
  )
  and exists(
    select 1
    from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004421'
      and status='pending'
  )
  and exists(
    select 1
    from public.commercial_observations
    where id=44001 and quantity is null and price_value is null and currency is null
  ),
  'quarantine must preserve raw candidate evidence and leave commercial state untouched'
);

rollback;
