-- PA2.30.7 — Candidate-to-Observation Recovery Matching Readiness acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.7 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000050a1','pa2307@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000050f1','PA2307 Org','pa2307-org',
  '00000000-0000-0000-0000-0000000050a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000050f1',
  '00000000-0000-0000-0000-0000000050a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005001',
  '00000000-0000-0000-0000-0000000050a1',
  '00000000-0000-0000-0000-000000005011',
  'pa2307-source.zip',
  '00000000-0000-0000-0000-0000000050f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
('00000000-0000-0000-0000-000000005021','00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005031','Single anchored','offer',now(),'00000000-0000-0000-0000-0000000050f1'),
('00000000-0000-0000-0000-000000005022','00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005032','Multiple anchored','offer',now(),'00000000-0000-0000-0000-0000000050f1'),
('00000000-0000-0000-0000-000000005023','00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005033','Conflict','offer',now(),'00000000-0000-0000-0000-0000000050f1'),
('00000000-0000-0000-0000-000000005024','00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005034','Single unanchored','offer',now(),'00000000-0000-0000-0000-0000000050f1');

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id,
  product_type,outer_diameter_mm,thickness_mm,price_value,price_unit,currency
) values
(50001,'00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005021','00000000-0000-0000-0000-000000005031','offered','outbound','a.eml','406x6,3',.98,'a','00000000-0000-0000-0000-0000000050f1','round_tube',406,6.3,null,null,null),
(50002,'00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005021','00000000-0000-0000-0000-000000005031','offered','outbound','a2.eml','508x10',.98,'a2','00000000-0000-0000-0000-0000000050f1','round_tube',508,10,null,null,null),
(50003,'00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005022','00000000-0000-0000-0000-000000005032','offered','outbound','b1.eml','406x6,3 first',.98,'b1','00000000-0000-0000-0000-0000000050f1','round_tube',406,6.3,null,null,null),
(50004,'00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005022','00000000-0000-0000-0000-000000005032','offered','outbound','b2.eml','406x6,3 second',.98,'b2','00000000-0000-0000-0000-0000000050f1','round_tube',406,6.3,null,null,null),
(50005,'00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005023','00000000-0000-0000-0000-000000005033','offered','outbound','c.eml','508x10 only',.98,'c','00000000-0000-0000-0000-0000000050f1','round_tube',508,10,null,null,null),
(50006,'00000000-0000-0000-0000-0000000050a1','00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005024','00000000-0000-0000-0000-000000005034','offered','outbound','d.eml','no candidate identity anchor',.98,'d','00000000-0000-0000-0000-0000000050f1','round_tube',406,6.3,null,null,null);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
)
select '00000000-0000-0000-0000-0000000050f1',id,
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000050a1'
from public.commercial_threads
where organization_id='00000000-0000-0000-0000-0000000050f1';

-- One direct-bound worker job per thread.
insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
)
select
  ('00000000-0000-0000-0000-0000000051' || right(id::text,2))::uuid,
  'src-'||right(id::text,2)||'.eml','.eml',256,
  '2026/09/23/src-'||right(id::text,2)||'.eml',
  'completed','v4','source_reingest',1,now(),now(),
  owner_id,dataset_id,id,organization_id,repeat('a',64),subject
from public.commercial_threads
where organization_id='00000000-0000-0000-0000-0000000050f1';

-- Predecessors.
insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,w.id,w.storage_path,w.content_checksum,
  'v4','completed','{}'::jsonb,'00000000-0000-0000-0000-0000000050a1',now(),now()
from public.commercial_offer_remediation_queue q
join public.worker_jobs w on w.organization_id=q.organization_id and w.thread_id=q.thread_id
where q.organization_id='00000000-0000-0000-0000-0000000050f1';

-- Successors.
insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  p.organization_id,p.remediation_queue_id,p.thread_id,p.source_job_id,p.source_storage_path,
  p.source_checksum,'v4','completed','{}'::jsonb,p.requested_by,now(),now(),p.id
from public.commercial_offer_reparse_runs p
where p.organization_id='00000000-0000-0000-0000-0000000050f1'
  and p.supersedes_run_id is null;

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at,selected_source_filename,source_selection_mode,selected_by,selected_at
)
select
  s.organization_id,s.remediation_queue_id,s.thread_id,s.supersedes_run_id,
  '00000000-0000-0000-0000-0000000050a1','consumed',s.source_job_id,s.id,
  regexp_replace(s.source_storage_path,'^.*/',''),s.source_storage_path,s.source_checksum,256,
  now(),now(),'Inbox/'||regexp_replace(s.source_storage_path,'^.*/',''),
  'unique_offered_source','00000000-0000-0000-0000-0000000050a1',now()
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000050f1'
  and s.supersedes_run_id is not null;

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
)
select
  s.organization_id,s.id,s.thread_id,0,'candidate','offered',
  case s.thread_id
    when '00000000-0000-0000-0000-000000005024'::uuid
      then '{"price_value":61.5,"price_unit":"M","currency":"EUR"}'::jsonb
    else '{"product_type":"round_tube","outer_diameter_mm":406,"thickness_mm":6.3,"price_value":61.5,"price_unit":"M","currency":"EUR"}'::jsonb
  end,
  '{"comparison_mode":"descriptive_only"}'::jsonb,'pending_review'
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000050f1'
  and s.supersedes_run_id is not null;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000050a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_offer_recovery_matching_readiness(
  '00000000-0000-0000-0000-0000000050f1',100
) as readiness \gset

select pg_temp.assert_true(
  (:'readiness'::jsonb#>>'{summary,candidate_count}')::int=4
  and (:'readiness'::jsonb#>>'{summary,single_anchored_compatible_target}')::int=1
  and (:'readiness'::jsonb#>>'{summary,multiple_anchored_compatible_targets}')::int=1
  and (:'readiness'::jsonb#>>'{summary,no_compatible_target}')::int=1
  and (:'readiness'::jsonb#>>'{summary,single_unanchored_nonconflicting_target}')::int=1,
  'readiness summary must separate anchored, ambiguous, conflicting and unanchored cases'
);

select pg_temp.assert_true(
  exists(
    select 1 from jsonb_array_elements(:'readiness'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000005021'
      and item->>'matching_status'='single_anchored_compatible_target'
      and (item->>'anchored_compatible_target_count')::int=1
      and exists(
        select 1 from jsonb_array_elements(item->'target_observations') t
        where (t->>'observation_id')::bigint=50001
          and (t->>'identity_anchored')::boolean=true
          and (t->>'identity_conflict_count')::int=0
          and (t->>'recoverable_gap_count')::int>=3
      )
  ),
  'single anchored target must expose identity agreement and recoverable commercial gaps'
);

select pg_temp.assert_true(
  exists(
    select 1 from jsonb_array_elements(:'readiness'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000005023'
      and item->>'matching_status'='no_compatible_target'
      and exists(
        select 1 from jsonb_array_elements(item->'target_observations') t
        where (t->>'identity_conflict_count')::int>0
          and (t->>'compatible')::boolean=false
      )
  ),
  'identity conflicts must block compatibility'
);

select pg_temp.assert_true(
  (:'readiness'::jsonb#>>'{policy,single_compatible_target_is_not_automatic_match}')::boolean=true
  and (:'readiness'::jsonb#>>'{policy,explicit_target_selection_required}')::boolean=true
  and (:'readiness'::jsonb#>>'{policy,automatic_candidate_match}')::boolean=false
  and (:'readiness'::jsonb#>>'{policy,automatic_candidate_adoption}')::boolean=false,
  'matching readiness must stay advisory and explicit'
);

rollback;
