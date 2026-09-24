-- PA2.30.13 — Controlled Recovery Disposition Execution acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.13 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000056a1','pa23013@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000056f1','PA23013 Org','pa23013-org',
  '00000000-0000-0000-0000-0000000056a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000056f1',
  '00000000-0000-0000-0000-0000000056a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005601',
  '00000000-0000-0000-0000-0000000056a1',
  '00000000-0000-0000-0000-000000005611',
  'pa23013-source.zip',
  '00000000-0000-0000-0000-0000000056f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000005621',
  '00000000-0000-0000-0000-0000000056a1',
  '00000000-0000-0000-0000-000000005601',
  '00000000-0000-0000-0000-000000005631',
  'PA23013 dismiss ready','offer',now(),
  '00000000-0000-0000-0000-0000000056f1'
),
(
  '00000000-0000-0000-0000-000000005622',
  '00000000-0000-0000-0000-0000000056a1',
  '00000000-0000-0000-0000-000000005601',
  '00000000-0000-0000-0000-000000005632',
  'PA23013 offer decision required','offer',now(),
  '00000000-0000-0000-0000-0000000056f1'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id,
  product_type,outer_diameter_mm,thickness_mm
) values
(
  56001,
  '00000000-0000-0000-0000-0000000056a1',
  '00000000-0000-0000-0000-000000005601',
  '00000000-0000-0000-0000-000000005621',
  '00000000-0000-0000-0000-000000005631',
  'offered','outbound','ready.eml','508x10',.99,'ready',
  '00000000-0000-0000-0000-0000000056f1','round_tube',508,10
),
(
  56002,
  '00000000-0000-0000-0000-0000000056a1',
  '00000000-0000-0000-0000-000000005601',
  '00000000-0000-0000-0000-000000005622',
  '00000000-0000-0000-0000-000000005632',
  'offered','outbound','decision.eml','220x220x8',.99,'decision',
  '00000000-0000-0000-0000-0000000056f1','square_tube',null,8
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values
(
  '00000000-0000-0000-0000-0000000056f1',
  '00000000-0000-0000-0000-000000005621',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":1,"currency_gap_count":1,"quantity_gap_count":1}',
  '00000000-0000-0000-0000-0000000056a1'
),
(
  '00000000-0000-0000-0000-0000000056f1',
  '00000000-0000-0000-0000-000000005622',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":1,"currency_gap_count":1,"quantity_gap_count":1}',
  '00000000-0000-0000-0000-0000000056a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values
(
  '00000000-0000-0000-0000-000000005641',
  'ready.eml','.eml',128,'2026/09/24/ready-pa23013.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000056a1',
  '00000000-0000-0000-0000-000000005601',
  '00000000-0000-0000-0000-000000005621',
  '00000000-0000-0000-0000-0000000056f1',repeat('a',64),'ready'
),
(
  '00000000-0000-0000-0000-000000005642',
  'decision.eml','.eml',128,'2026/09/24/decision-pa23013.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000056a1',
  '00000000-0000-0000-0000-000000005601',
  '00000000-0000-0000-0000-000000005622',
  '00000000-0000-0000-0000-0000000056f1',repeat('b',64),'decision'
);

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  case when q.thread_id='00000000-0000-0000-0000-000000005621' then 5601 else 5611 end,
  q.organization_id,q.id,q.thread_id,
  case when q.thread_id='00000000-0000-0000-0000-000000005621'
    then '00000000-0000-0000-0000-000000005641'::uuid
    else '00000000-0000-0000-0000-000000005642'::uuid end,
  'legacy-invalid.eml',repeat('f',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000056a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000056f1';

insert into public.commercial_offer_reparse_run_invalidations(
  organization_id,run_id,remediation_queue_id,thread_id,source_job_id,
  reason,evidence_snapshot,invalidated_by,note
)
select
  r.organization_id,r.id,r.remediation_queue_id,r.thread_id,r.source_job_id,
  'manual_provenance_invalid','{"source":"PA2.30.13 predecessor"}',
  '00000000-0000-0000-0000-0000000056a1','preserve predecessor quarantine'
from public.commercial_offer_reparse_runs r
where r.organization_id='00000000-0000-0000-0000-0000000056f1';

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  case when p.id=5601 then 5602 else 5612 end,
  p.organization_id,p.remediation_queue_id,p.thread_id,p.source_job_id,
  case when p.id=5601 then '2026/09/24/ready-pa23013.eml'
       else '2026/09/24/decision-pa23013.eml' end,
  case when p.id=5601 then repeat('a',64) else repeat('b',64) end,
  'v4','completed','{}',p.requested_by,now(),now(),p.id
from public.commercial_offer_reparse_runs p
where p.organization_id='00000000-0000-0000-0000-0000000056f1'
  and p.supersedes_run_id is null;

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at,selected_source_filename,source_selection_mode,selected_by,selected_at
)
select
  s.organization_id,s.remediation_queue_id,s.thread_id,s.supersedes_run_id,
  '00000000-0000-0000-0000-0000000056a1','consumed',s.source_job_id,s.id,
  case when s.id=5602 then 'ready.eml' else 'decision.eml' end,
  s.source_storage_path,s.source_checksum,128,now(),now(),
  case when s.id=5602 then 'Inbox/ready.eml' else 'Inbox/decision.eml' end,
  'unique_offered_source','00000000-0000-0000-0000-0000000056a1',now()
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000056f1'
  and s.supersedes_run_id is not null;

insert into public.commercial_offer_reparse_candidates(
  id,organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
) values
(
  5621,'00000000-0000-0000-0000-0000000056f1',5602,
  '00000000-0000-0000-0000-000000005621',0,'Richiesta 508x10','requested',
  '{"product_type":"round_tube","outer_diameter_mm":508,"thickness_mm":10,"quantity":10,"quantity_unit":"T"}',
  '{}','pending_review'
),
(
  5622,'00000000-0000-0000-0000-0000000056f1',5612,
  '00000000-0000-0000-0000-000000005622',0,'Disponibili 55 ton a 12 m','offered',
  '{"length_mm":12000,"quantity":55,"quantity_unit":"T","availability_status":"stock"}',
  '{}','pending_review'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000056a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_execute_offer_recovery_disposition_batch(
  '00000000-0000-0000-0000-0000000056f1',
  array[
    (select id from public.commercial_offer_remediation_queue
      where organization_id='00000000-0000-0000-0000-0000000056f1'
        and thread_id='00000000-0000-0000-0000-000000005621'),
    (select id from public.commercial_offer_remediation_queue
      where organization_id='00000000-0000-0000-0000-0000000056f1'
        and thread_id='00000000-0000-0000-0000-000000005622')
  ]::bigint[],
  2,
  'PA2.30.13 explicit controlled batch'
) as batch_result \gset

select pg_temp.assert_true(
  :'batch_result'::jsonb->>'status'='completed_with_blocks'
  and (:'batch_result'::jsonb->>'requested_count')::int=2
  and (:'batch_result'::jsonb->>'dismissed_count')::int=1
  and (:'batch_result'::jsonb->>'blocked_count')::int=1
  and (:'batch_result'::jsonb->>'already_closed_count')::int=0,
  'batch must dismiss only the currently eligible remediation'
);

select pg_temp.assert_true(
  (select status='dismissed'
   from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000056f1'
     and thread_id='00000000-0000-0000-0000-000000005621')
  and
  (select status='pending'
   from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000056f1'
     and thread_id='00000000-0000-0000-0000-000000005622'),
  'eligible remediation must close while offer-decision remediation remains pending'
);

select pg_temp.assert_true(
  (select review_status='pending_review'
   from public.commercial_offer_reparse_candidates where id=5621)
  and
  (select review_status='pending_review'
   from public.commercial_offer_reparse_candidates where id=5622)
  and not exists(
    select 1
    from public.commercial_offer_reparse_candidate_decisions
    where candidate_id in (5621,5622)
  ),
  'batch execution must not reject or decide any candidate'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_remediation_closure_events e
    join public.commercial_offer_remediation_queue q
      on q.id=e.remediation_queue_id
    where e.organization_id='00000000-0000-0000-0000-0000000056f1'
      and q.thread_id='00000000-0000-0000-0000-000000005621'
      and e.outcome='dismissed'
      and e.resolution_reason='recovery_completed_no_offered_candidates'
      and e.note like 'PA2.30.13 batch %'
  )
  and not exists(
    select 1
    from public.commercial_offer_reparse_remediation_closure_events e
    join public.commercial_offer_remediation_queue q
      on q.id=e.remediation_queue_id
    where e.organization_id='00000000-0000-0000-0000-0000000056f1'
      and q.thread_id='00000000-0000-0000-0000-000000005622'
  ),
  'closure ledger must record only the eligible batch member'
);

select pg_temp.assert_true(
  exists(
    select 1
    from private.commercial_offer_recovery_disposition_batches b
    where b.organization_id='00000000-0000-0000-0000-0000000056f1'
      and b.id=(:'batch_result'::jsonb->>'batch_id')::uuid
      and b.requested_count=2
      and b.dismissed_count=1
      and b.blocked_count=1
      and b.result_snapshot->>'control_phase'='PA2.30.13'
  ),
  'batch ledger must durably capture requested ids and results'
);

select public.p1_offer_recovery_disposition_batch_history(
  '00000000-0000-0000-0000-0000000056f1',20
) as history \gset

select pg_temp.assert_true(
  jsonb_array_length(:'history'::jsonb->'items')=1
  and (:'history'::jsonb#>>'{policy,explicit_id_selection_required}')::boolean=true
  and (:'history'::jsonb#>>'{policy,state_revalidated_per_item}')::boolean=true,
  'authorized history must expose the append-only batch audit'
);

rollback;
