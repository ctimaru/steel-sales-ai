-- PA2.30.9 — Recovery Closure Handoff & Quarantine Isolation acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.9 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000052a1','pa2309@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000052f1','PA2309 Org','pa2309-org',
  '00000000-0000-0000-0000-0000000052a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000052f1',
  '00000000-0000-0000-0000-0000000052a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005201',
  '00000000-0000-0000-0000-0000000052a1',
  '00000000-0000-0000-0000-000000005211',
  'pa2309-source.zip',
  '00000000-0000-0000-0000-0000000052f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000005221',
  '00000000-0000-0000-0000-0000000052a1',
  '00000000-0000-0000-0000-000000005201',
  '00000000-0000-0000-0000-000000005231',
  'Recovery closure handoff','offer',now(),
  '00000000-0000-0000-0000-0000000052f1'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id,
  product_type,outer_diameter_mm,thickness_mm,quantity,quantity_unit,
  price_value,price_unit,currency
) values (
  52001,
  '00000000-0000-0000-0000-0000000052a1',
  '00000000-0000-0000-0000-000000005201',
  '00000000-0000-0000-0000-000000005221',
  '00000000-0000-0000-0000-000000005231',
  'offered','outbound','recovered.eml','406x6,3 - 100 mt',.99,'recovery closure',
  '00000000-0000-0000-0000-0000000052f1',
  'round_tube',406,6.3,100,'MT',null,null,null
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000052f1',
  '00000000-0000-0000-0000-000000005221',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":1,"currency_gap_count":1,"quantity_gap_count":0}',
  '00000000-0000-0000-0000-0000000052a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000005241',
  'recovered.eml','.eml',256,'2026/09/23/recovered-pa2309.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000052a1',
  '00000000-0000-0000-0000-000000005201',
  '00000000-0000-0000-0000-000000005221',
  '00000000-0000-0000-0000-0000000052f1',repeat('c',64),'Recovery closure handoff'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000005241',
  'legacy-invalid.eml',repeat('d',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000052a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000052f1';

insert into public.commercial_offer_reparse_run_invalidations(
  organization_id,run_id,remediation_queue_id,thread_id,source_job_id,
  reason,evidence_snapshot,invalidated_by,note
)
select
  r.organization_id,r.id,r.remediation_queue_id,r.thread_id,r.source_job_id,
  'manual_provenance_invalid','{"source":"PA2.30.9 predecessor"}',
  '00000000-0000-0000-0000-0000000052a1','preserve predecessor quarantine'
from public.commercial_offer_reparse_runs r
where r.organization_id='00000000-0000-0000-0000-0000000052f1'
  and r.supersedes_run_id is null;

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  p.organization_id,p.remediation_queue_id,p.thread_id,p.source_job_id,
  '2026/09/23/recovered-pa2309.eml',repeat('c',64),'v4','completed','{}',
  p.requested_by,now(),now(),p.id
from public.commercial_offer_reparse_runs p
where p.organization_id='00000000-0000-0000-0000-0000000052f1'
  and p.supersedes_run_id is null;

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at,selected_source_filename,source_selection_mode,selected_by,selected_at
)
select
  s.organization_id,s.remediation_queue_id,s.thread_id,s.supersedes_run_id,
  '00000000-0000-0000-0000-0000000052a1','consumed',s.source_job_id,s.id,
  'recovered.eml',s.source_storage_path,s.source_checksum,256,now(),now(),
  'Inbox/recovered.eml','unique_offered_source',
  '00000000-0000-0000-0000-0000000052a1',now()
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000052f1'
  and s.supersedes_run_id is not null;

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
)
select
  s.organization_id,s.id,s.thread_id,0,'406x6,3 - EUR 61,50/mt','offered',
  '{"product_type":"round_tube","outer_diameter_mm":406,"thickness_mm":6.3,"price_value":61.5,"price_unit":"MT","currency":"EUR"}',
  '{"comparison_mode":"descriptive_only"}','pending_review'
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000052f1'
  and s.supersedes_run_id is not null;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000052a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_adopt_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000052f1',
  (select c.id from public.commercial_offer_reparse_candidates c
    where c.organization_id='00000000-0000-0000-0000-0000000052f1'),
  52001,
  array['price_value','price_unit','currency'],
  'PA2.30.9 explicit recovery adoption'
) as adoption_result \gset

select pg_temp.assert_true(
  :'adoption_result'::jsonb->>'status'='adopted'
  and :'adoption_result'::jsonb->>'recovery_adoption_guard'='PA2.30.8',
  'recovery candidate must first pass PA2.30.8 and PA2.29 adoption'
);

select private.offer_reparse_remediation_closure_state(
  '00000000-0000-0000-0000-0000000052f1',
  (select id from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000052f1')
) as closure_state \gset

select pg_temp.assert_true(
  :'closure_state'::jsonb->>'closure_status'='ready_resolve'
  and :'closure_state'::jsonb->>'recovery_closure_handoff'='PA2.30.9'
  and (:'closure_state'::jsonb->>'predecessor_quarantine_preserved')::boolean=true,
  'valid recovery successor must become closure-ready while predecessor remains quarantined'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000052f1',
  (select id from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000052f1'),
  'explicit recovery closure'
) as close_result \gset

select pg_temp.assert_true(
  :'close_result'::jsonb->>'status'='resolved'
  and :'close_result'::jsonb->>'recovery_closure_handoff'='PA2.30.9'
  and (:'close_result'::jsonb->>'predecessor_quarantine_preserved')::boolean=true,
  'explicit recovery closure must resolve through the valid successor'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_remediation_closure_events e
    join public.commercial_offer_reparse_runs r on r.id=e.run_id
    where e.organization_id='00000000-0000-0000-0000-0000000052f1'
      and r.supersedes_run_id is not null
      and e.outcome='resolved'
  )
  and exists(
    select 1
    from public.commercial_offer_reparse_run_invalidations i
    where i.organization_id='00000000-0000-0000-0000-0000000052f1'
  ),
  'closure event must point to successor without deleting predecessor invalidation evidence'
);

rollback;
