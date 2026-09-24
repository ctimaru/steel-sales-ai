-- PA2.30.12 — Recovery Remediation Disposition Cutover acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.12 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000055a1','pa23012@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000055f1','PA23012 Org','pa23012-org',
  '00000000-0000-0000-0000-0000000055a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000055f1',
  '00000000-0000-0000-0000-0000000055a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005501',
  '00000000-0000-0000-0000-0000000055a1',
  '00000000-0000-0000-0000-000000005511',
  'pa23012-source.zip',
  '00000000-0000-0000-0000-0000000055f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000005521',
  '00000000-0000-0000-0000-0000000055a1',
  '00000000-0000-0000-0000-000000005501',
  '00000000-0000-0000-0000-000000005531',
  'Recovery disposition no offered candidate','offer',now(),
  '00000000-0000-0000-0000-0000000055f1'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id,
  product_type,outer_diameter_mm,thickness_mm
) values (
  55001,
  '00000000-0000-0000-0000-0000000055a1',
  '00000000-0000-0000-0000-000000005501',
  '00000000-0000-0000-0000-000000005521',
  '00000000-0000-0000-0000-000000005531',
  'offered','outbound','recovered.eml','508x10',.99,'recovery disposition',
  '00000000-0000-0000-0000-0000000055f1',
  'round_tube',508,10
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000055f1',
  '00000000-0000-0000-0000-000000005521',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":1,"currency_gap_count":1,"quantity_gap_count":1}',
  '00000000-0000-0000-0000-0000000055a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000005541',
  'recovered.eml','.eml',256,'2026/09/24/recovered-pa23012.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000055a1',
  '00000000-0000-0000-0000-000000005501',
  '00000000-0000-0000-0000-000000005521',
  '00000000-0000-0000-0000-0000000055f1',repeat('e',64),'Recovery disposition'
);

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  5501,q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000005541',
  'legacy-invalid.eml',repeat('f',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000055a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000055f1';

insert into public.commercial_offer_reparse_run_invalidations(
  organization_id,run_id,remediation_queue_id,thread_id,source_job_id,
  reason,evidence_snapshot,invalidated_by,note
)
select
  r.organization_id,r.id,r.remediation_queue_id,r.thread_id,r.source_job_id,
  'manual_provenance_invalid','{"source":"PA2.30.12 predecessor"}',
  '00000000-0000-0000-0000-0000000055a1','preserve predecessor quarantine'
from public.commercial_offer_reparse_runs r
where r.organization_id='00000000-0000-0000-0000-0000000055f1'
  and r.id=5501;

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  5502,p.organization_id,p.remediation_queue_id,p.thread_id,p.source_job_id,
  '2026/09/24/recovered-pa23012.eml',repeat('e',64),'v4','completed','{}',
  p.requested_by,now(),now(),p.id
from public.commercial_offer_reparse_runs p
where p.organization_id='00000000-0000-0000-0000-0000000055f1'
  and p.id=5501;

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at,selected_source_filename,source_selection_mode,selected_by,selected_at
)
select
  s.organization_id,s.remediation_queue_id,s.thread_id,s.supersedes_run_id,
  '00000000-0000-0000-0000-0000000055a1','consumed',s.source_job_id,s.id,
  'recovered.eml',s.source_storage_path,s.source_checksum,256,now(),now(),
  'Inbox/recovered.eml','unique_offered_source',
  '00000000-0000-0000-0000-0000000055a1',now()
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000055f1'
  and s.id=5502;

insert into public.commercial_offer_reparse_candidates(
  id,organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
) values(
  5511,'00000000-0000-0000-0000-0000000055f1',5502,
  '00000000-0000-0000-0000-000000005521',0,'Richiesta tubo 508x10','requested',
  '{"product_type":"round_tube","outer_diameter_mm":508,"thickness_mm":10,"quantity":10,"quantity_unit":"T"}',
  '{}','pending_review'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000055a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_offer_recovery_remediation_disposition_readiness(
  '00000000-0000-0000-0000-0000000055f1',200
) as disposition \gset

select pg_temp.assert_true(
  (:'disposition'::jsonb#>>'{summary,ready_dismiss_no_offered_evidence}')::int=1
  and (:'disposition'::jsonb#>>'{summary,total_offered_candidates}')::int=0
  and (:'disposition'::jsonb#>>'{summary,total_preserved_out_of_scope_candidates}')::int=1,
  'requested-only recovery must become explicit dismiss-ready without becoming an offer decision'
);

select private.offer_reparse_remediation_closure_state(
  '00000000-0000-0000-0000-0000000055f1',
  (select id from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000055f1')
) as closure_state \gset

select pg_temp.assert_true(
  :'closure_state'::jsonb->>'closure_status'='ready_dismiss_no_candidates'
  and :'closure_state'::jsonb->>'disposition_status'='ready_dismiss_no_offered_evidence'
  and :'closure_state'::jsonb->>'resolution_reason'='recovery_completed_no_offered_candidates'
  and (:'closure_state'::jsonb->>'candidate_count')::int=0
  and (:'closure_state'::jsonb->>'out_of_scope_candidate_count')::int=1
  and :'closure_state'::jsonb->>'recovery_disposition_cutover'='PA2.30.12',
  'closure state must count offered candidates only and preserve out-of-scope evidence'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000055f1',
  (select id from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000055f1'),
  'PA2.30.12 explicit dismissal: valid recovery produced no offered evidence'
) as close_result \gset

select pg_temp.assert_true(
  :'close_result'::jsonb->>'status'='dismissed'
  and :'close_result'::jsonb->>'resolution_reason'='recovery_completed_no_offered_candidates',
  'explicit close must dismiss the remediation through the recovery-scoped state'
);

select pg_temp.assert_true(
  (select review_status='pending_review'
   from public.commercial_offer_reparse_candidates where id=5511)
  and not exists(
    select 1 from public.commercial_offer_reparse_candidate_decisions where candidate_id=5511
  ),
  'out-of-scope requested candidate must remain untouched after offer remediation dismissal'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_remediation_closure_events e
    where e.organization_id='00000000-0000-0000-0000-0000000055f1'
      and e.outcome='dismissed'
      and e.resolution_reason='recovery_completed_no_offered_candidates'
      and e.candidate_count=0
      and e.closure_snapshot->>'out_of_scope_candidate_count'='1'
  ),
  'closure ledger must record offered-scoped counts and preserved out-of-scope evidence'
);

rollback;
