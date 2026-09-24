-- PA2.30.15 — Residual Evidence Gap Reconciliation & Remediation Finalization Readiness acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.14 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000057a1','pa23014@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000057f1','PA23014 Org','pa23014-org',
  '00000000-0000-0000-0000-0000000057a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000057f1',
  '00000000-0000-0000-0000-0000000057a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005701',
  '00000000-0000-0000-0000-0000000057a1',
  '00000000-0000-0000-0000-000000005711',
  'pa23014-source.zip',
  '00000000-0000-0000-0000-0000000057f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000005721',
  '00000000-0000-0000-0000-0000000057a1',
  '00000000-0000-0000-0000-000000005701',
  '00000000-0000-0000-0000-000000005731',
  '220x220x8 residual offer','offer',now(),
  '00000000-0000-0000-0000-0000000057f1'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id,
  product_type,width_mm,height_mm,thickness_mm,availability_status
) values
(
  57001,
  '00000000-0000-0000-0000-0000000057a1',
  '00000000-0000-0000-0000-000000005701',
  '00000000-0000-0000-0000-000000005721',
  '00000000-0000-0000-0000-000000005731',
  'offered','outbound','Inbox/source.eml',
  'Oggetto: TUBOLARE 220x220x8 mt 12 S355J2H',
  .98,'subject observation',
  '00000000-0000-0000-0000-0000000057f1',
  'square_tube',220,220,8,null
),
(
  57002,
  '00000000-0000-0000-0000-0000000057a1',
  '00000000-0000-0000-0000-000000005701',
  '00000000-0000-0000-0000-000000005721',
  '00000000-0000-0000-0000-000000005731',
  'offered','outbound','Inbox/source.eml',
  'Ciao Walter, La laminazione è chiusa. Al momento ho 55 ton a 12mt a terra e tieni conto che la prossima laminazione è prevista per luglio. Ciao',
  .88,'body observation',
  '00000000-0000-0000-0000-0000000057f1',
  'square_tube',220,220,8,'stock'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000057f1',
  '00000000-0000-0000-0000-000000005721',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":2,"currency_gap_count":2,"quantity_gap_count":2}',
  '00000000-0000-0000-0000-0000000057a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000005741',
  'source.eml','.eml',256,'2026/09/24/source-pa23014.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000057a1',
  '00000000-0000-0000-0000-000000005701',
  '00000000-0000-0000-0000-000000005721',
  '00000000-0000-0000-0000-0000000057f1',repeat('a',64),'220x220x8'
);

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  5701,q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000005741',
  'legacy-invalid.eml',repeat('f',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000057a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000057f1';

insert into public.commercial_offer_reparse_run_invalidations(
  organization_id,run_id,remediation_queue_id,thread_id,source_job_id,
  reason,evidence_snapshot,invalidated_by,note
)
select
  r.organization_id,r.id,r.remediation_queue_id,r.thread_id,r.source_job_id,
  'manual_provenance_invalid','{"source":"PA2.30.14 predecessor"}',
  '00000000-0000-0000-0000-0000000057a1','preserve predecessor quarantine'
from public.commercial_offer_reparse_runs r
where r.organization_id='00000000-0000-0000-0000-0000000057f1';

insert into public.commercial_offer_reparse_runs(
  id,organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  5702,p.organization_id,p.remediation_queue_id,p.thread_id,p.source_job_id,
  '2026/09/24/source-pa23014.eml',repeat('a',64),'v4','completed','{}',
  p.requested_by,now(),now(),p.id
from public.commercial_offer_reparse_runs p
where p.organization_id='00000000-0000-0000-0000-0000000057f1'
  and p.id=5701;

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at,selected_source_filename,source_selection_mode,selected_by,selected_at
)
select
  s.organization_id,s.remediation_queue_id,s.thread_id,s.supersedes_run_id,
  '00000000-0000-0000-0000-0000000057a1','consumed',s.source_job_id,s.id,
  'source.eml',s.source_storage_path,s.source_checksum,256,now(),now(),
  'Inbox/source.eml','unique_offered_source',
  '00000000-0000-0000-0000-0000000057a1',now()
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000057f1'
  and s.id=5702;

insert into public.commercial_offer_reparse_candidates(
  id,organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
) values(
  5711,'00000000-0000-0000-0000-0000000057f1',5702,
  '00000000-0000-0000-0000-000000005721',0,
  'Al momento ho 55 ton a 12mt a terra e tieni conto che la prossima laminazione è prevista per luglio.',
  'offered',
  '{"length_mm":12000,"quantity":55,"quantity_unit":"T","availability_status":"stock","source_filename":"source.eml"}',
  '{}','pending_review'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000057a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_offer_recovery_residual_candidate_resolution_readiness(
  '00000000-0000-0000-0000-0000000057f1',100
) as readiness \gset

select pg_temp.assert_true(
  (:'readiness'::jsonb#>>'{summary,candidate_count}')::int=1
  and (:'readiness'::jsonb#>>'{summary,source_provenance_target_ready}')::int=1
  and (:'readiness'::jsonb#>>'{items,0,target_observation_id}')::bigint=57002
  and (:'readiness'::jsonb#>>'{items,0,source_text_containment_anchor}')::boolean=true
  and (:'readiness'::jsonb#>>'{items,0,source_filename_anchor}')::boolean=true,
  'candidate must have exactly one source-provenance target'
);

select public.p1_resolve_offer_recovery_residual_candidate(
  '00000000-0000-0000-0000-0000000057f1',
  5711,57001,
  array['length_mm','quantity','quantity_unit']::text[],
  'wrong target must be blocked'
) as wrong_target \gset

select pg_temp.assert_true(
  :'wrong_target'::jsonb->>'status'='blocked'
  and :'wrong_target'::jsonb->>'reason'='explicit_target_does_not_match_source_provenance_anchor'
  and (select review_status='pending_review'
       from public.commercial_offer_reparse_candidates where id=5711),
  'non-provenance target must be blocked without mutation'
);

select public.p1_resolve_offer_recovery_residual_candidate(
  '00000000-0000-0000-0000-0000000057f1',
  5711,57002,
  array['length_mm','quantity','quantity_unit']::text[],
  'explicit PA2.30.14 source-provenance confirmation'
) as resolution \gset

select pg_temp.assert_true(
  :'resolution'::jsonb->>'status'='adopted'
  and :'resolution'::jsonb->>'residual_resolution_control'='PA2.30.14'
  and (:'resolution'::jsonb->>'source_provenance_target_confirmed')::boolean=true,
  'provenance target must resolve through the guarded adoption path'
);

select pg_temp.assert_true(
  (select review_status='accepted'
   from public.commercial_offer_reparse_candidates where id=5711)
  and
  (select length_mm=12000 and quantity=55 and quantity_unit='T' and availability_status='stock'
   from public.commercial_observations where id=57002)
  and
  (select length_mm is null and quantity is null and quantity_unit is null
   from public.commercial_observations where id=57001),
  'only the provenance target may receive the explicitly selected missing fields'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_candidate_decisions d
    where d.candidate_id=5711
      and d.target_observation_id=57002
      and d.decision='adopted'
      and d.selected_fields @> array['length_mm','quantity','quantity_unit']::text[]
  ),
  'candidate decision ledger must record target and selected fields'
);

select pg_temp.assert_true(
  (
    private.offer_reparse_remediation_closure_state(
      '00000000-0000-0000-0000-0000000057f1',
      (select id from public.commercial_offer_remediation_queue
       where organization_id='00000000-0000-0000-0000-0000000057f1')
    )->>'closure_status'
  ) in ('residual_evidence_gap','ready_resolve')
  and
  (select status='pending'
   from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000057f1'),
  'candidate resolution must not auto-close the remediation before explicit finalization'
);


select public.p1_offer_recovery_residual_gap_reconciliation_readiness(
  '00000000-0000-0000-0000-0000000057f1',100
) as pa23015_readiness \gset

select pg_temp.assert_true(
  (:'pa23015_readiness'::jsonb#>>'{summary,ready_finalize_no_price_present}')::int=1
  and (:'pa23015_readiness'::jsonb#>>'{items,0,status}')='ready_finalize_no_price_present'
  and (:'pa23015_readiness'::jsonb#>>'{items,0,thread_evidence,quantity_status}')='satisfied'
  and (:'pa23015_readiness'::jsonb#>>'{items,0,thread_evidence,price_status}')='not_applicable_absent_from_source'
  and (:'pa23015_readiness'::jsonb#>>'{items,0,thread_evidence,currency_status}')='not_applicable_absent_from_source',
  'source-level reconciliation must distinguish absent price evidence from a recoverable missing value'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000057f1',
  (select id from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000057f1'),
  null
) as close_without_note \gset

select pg_temp.assert_true(
  :'close_without_note'::jsonb->>'status'='blocked'
  and :'close_without_note'::jsonb->>'reason'='reconciliation_note_required',
  'reconciled finalization must require an explicit note'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000057f1',
  (select id from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000057f1'),
  'PA2.30.15 explicit finalization: recovered source contains quantity evidence and no price evidence.'
) as final_close \gset

select pg_temp.assert_true(
  :'final_close'::jsonb->>'status'='resolved'
  and :'final_close'::jsonb->>'resolution_reason'='source_evidence_reconciled_no_price_present'
  and :'final_close'::jsonb->>'control_phase'='PA2.30.15',
  'explicit reconciliation finalization must resolve the remediation'
);

select pg_temp.assert_true(
  (select status='resolved'
   from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000057f1')
  and
  (select review_status='accepted'
   from public.commercial_offer_reparse_candidates where id=5711)
  and
  (select price_value is null and currency is null
   from public.commercial_observations where id=57002),
  'finalization must not fabricate absent price/currency evidence or alter the accepted candidate decision'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_remediation_closure_events e
    where e.organization_id='00000000-0000-0000-0000-0000000057f1'
      and e.outcome='resolved'
      and e.resolution_reason='source_evidence_reconciled_no_price_present'
      and e.closure_snapshot->>'reconciliation_control_phase'='PA2.30.15'
      and e.note is not null
  ),
  'closure ledger must preserve reconciliation evidence and explicit note'
);

rollback;
