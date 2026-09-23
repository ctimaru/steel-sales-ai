-- PA2.30.11 — Recovery Candidate Review & Decision Cutover acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.11 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000054a1','pa23011@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000054f1','PA23011 Org','pa23011-org',
  '00000000-0000-0000-0000-0000000054a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000054f1',
  '00000000-0000-0000-0000-0000000054a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005401',
  '00000000-0000-0000-0000-0000000054a1',
  '00000000-0000-0000-0000-000000005411',
  'pa23011.zip',
  '00000000-0000-0000-0000-0000000054f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000005421',
  '00000000-0000-0000-0000-0000000054a1',
  '00000000-0000-0000-0000-000000005401',
  '00000000-0000-0000-0000-000000005431',
  'PA23011 recovery thread','offer',now(),
  '00000000-0000-0000-0000-0000000054f1'
);

insert into public.commercial_observations(
  owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,product_type,outer_diameter_mm,thickness_mm,
  confidence,search_text,organization_id
) values(
  '00000000-0000-0000-0000-0000000054a1',
  '00000000-0000-0000-0000-000000005401',
  '00000000-0000-0000-0000-000000005421',
  '00000000-0000-0000-0000-000000005431',
  'offered','outbound','Inbox/recovery.eml','tube 406.4x6.3',
  'CHS',406.4,6.3,.99,'tube 406.4x6.3',
  '00000000-0000-0000-0000-0000000054f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000054f1',
  '00000000-0000-0000-0000-000000005421',
  'source_reparse_required','source_email_reparse','pending','{}',
  '00000000-0000-0000-0000-0000000054a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000005441',
  'recovery.eml','.eml',10,'recovery/source.eml','completed','v4','source_reingest',
  2,now(),now(),'00000000-0000-0000-0000-0000000054a1',
  '00000000-0000-0000-0000-000000005401',
  '00000000-0000-0000-0000-000000005421',
  '00000000-0000-0000-0000-0000000054f1',repeat('a',64),'PA23011'
);

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  5401,q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000005441','legacy/source.eml',
  repeat('b',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000054a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000054f1';

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  5402,q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000005441','recovery/source.eml',
  repeat('a',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000054a1',now(),now(),5401
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000054f1';

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,5401,
  '00000000-0000-0000-0000-0000000054a1','consumed',
  '00000000-0000-0000-0000-000000005441',5402,'recovery.eml',
  'recovery/source.eml',repeat('a',64),10,now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000054f1';

insert into public.commercial_offer_reparse_candidates(
  id,organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
) values
(
  5411,'00000000-0000-0000-0000-0000000054f1',5402,
  '00000000-0000-0000-0000-000000005421',0,'offer qty 55','offered',
  '{"product_type":"CHS","outer_diameter_mm":406.4,"thickness_mm":6.3,"quantity":55,"quantity_unit":"T"}',
  '{}','pending_review'
),
(
  5412,'00000000-0000-0000-0000-0000000054f1',5402,
  '00000000-0000-0000-0000-000000005421',1,'request qty 80','requested',
  '{"product_type":"CHS","outer_diameter_mm":406.4,"thickness_mm":6.3,"quantity":80,"quantity_unit":"T"}',
  '{}','pending_review'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000054a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_offer_recovery_candidate_decision_readiness(
  '00000000-0000-0000-0000-0000000054f1',200
) as readiness \gset

select pg_temp.assert_true(
  (:'readiness'::jsonb#>>'{summary,candidate_count}')::int=2
  and (:'readiness'::jsonb#>>'{summary,offered_candidate_count}')::int=1
  and (:'readiness'::jsonb#>>'{summary,out_of_scope_role_count}')::int=1
  and exists(
    select 1
    from jsonb_array_elements(:'readiness'::jsonb->'items') item
    where (item->>'candidate_id')::bigint=5412
      and item->>'decision_readiness'='preserved_out_of_scope_role'
  ),
  'readiness must preserve requested recovery candidates outside offer-decision scope'
);

select public.p1_reject_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000054f1',5412,'must stay outside offer recovery'
) as requested_reject \gset

select pg_temp.assert_true(
  :'requested_reject'::jsonb->>'status'='blocked'
  and :'requested_reject'::jsonb->>'reason'='recovery_candidate_out_of_scope_for_offer_decision'
  and (select review_status='pending_review'
       from public.commercial_offer_reparse_candidates where id=5412)
  and not exists(
    select 1 from public.commercial_offer_reparse_candidate_decisions where candidate_id=5412
  ),
  'requested recovery candidate must not be rejected through offer decision workflow'
);

select public.p1_reject_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000054f1',5411,'explicit offered rejection'
) as offered_reject \gset

select pg_temp.assert_true(
  :'offered_reject'::jsonb->>'status'='rejected'
  and (select review_status='rejected'
       from public.commercial_offer_reparse_candidates where id=5411)
  and exists(
    select 1 from public.commercial_offer_reparse_candidate_decisions
    where candidate_id=5411 and decision='rejected'
  ),
  'offered recovery candidate must remain explicitly rejectable'
);

rollback;
