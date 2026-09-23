-- PA2.30.8 — Recovery Adoption Guard & Provenance Enforcement acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.8 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000051a1','pa2308@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000051f1','PA2308 Org','pa2308-org',
  '00000000-0000-0000-0000-0000000051a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000051f1',
  '00000000-0000-0000-0000-0000000051a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000005101',
  '00000000-0000-0000-0000-0000000051a1',
  '00000000-0000-0000-0000-000000005111',
  'pa2308-source.zip',
  '00000000-0000-0000-0000-0000000051f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000005121',
  '00000000-0000-0000-0000-0000000051a1',
  '00000000-0000-0000-0000-000000005101',
  '00000000-0000-0000-0000-000000005131',
  'Recovery adoption guard','offer',now(),
  '00000000-0000-0000-0000-0000000051f1'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id,
  product_type,outer_diameter_mm,thickness_mm,price_value,price_unit,currency
) values
(
  51001,'00000000-0000-0000-0000-0000000051a1',
  '00000000-0000-0000-0000-000000005101',
  '00000000-0000-0000-0000-000000005121',
  '00000000-0000-0000-0000-000000005131',
  'offered','outbound','compatible.eml','406x6,3',.99,'compatible',
  '00000000-0000-0000-0000-0000000051f1',
  'round_tube',406,6.3,null,null,null
),
(
  51002,'00000000-0000-0000-0000-0000000051a1',
  '00000000-0000-0000-0000-000000005101',
  '00000000-0000-0000-0000-000000005121',
  '00000000-0000-0000-0000-000000005131',
  'offered','outbound','conflict.eml','508x10',.99,'conflict',
  '00000000-0000-0000-0000-0000000051f1',
  'round_tube',508,10,null,null,null
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000051f1',
  '00000000-0000-0000-0000-000000005121',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":2,"currency_gap_count":2,"quantity_gap_count":0}',
  '00000000-0000-0000-0000-0000000051a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000005141',
  'recovered.eml','.eml',256,'2026/09/23/recovered.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000051a1',
  '00000000-0000-0000-0000-000000005101',
  '00000000-0000-0000-0000-000000005121',
  '00000000-0000-0000-0000-0000000051f1',repeat('a',64),'Recovery adoption guard'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000005141',
  'legacy.eml',repeat('b',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000051a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000051f1';

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  p.organization_id,p.remediation_queue_id,p.thread_id,p.source_job_id,
  '2026/09/23/recovered.eml',repeat('a',64),'v4','completed','{}',
  p.requested_by,now(),now(),p.id
from public.commercial_offer_reparse_runs p
where p.organization_id='00000000-0000-0000-0000-0000000051f1'
  and p.supersedes_run_id is null;

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at,selected_source_filename,source_selection_mode,selected_by,selected_at
)
select
  s.organization_id,s.remediation_queue_id,s.thread_id,s.supersedes_run_id,
  '00000000-0000-0000-0000-0000000051a1','consumed',s.source_job_id,s.id,
  'recovered.eml',s.source_storage_path,s.source_checksum,256,now(),now(),
  'Inbox/recovered.eml','unique_offered_source',
  '00000000-0000-0000-0000-0000000051a1',now()
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000051f1'
  and s.supersedes_run_id is not null;

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
)
select
  s.organization_id,s.id,s.thread_id,0,'406x6,3 EUR 61,50/mt','offered',
  '{"product_type":"round_tube","outer_diameter_mm":406,"thickness_mm":6.3,"price_value":61.5,"price_unit":"MT","currency":"EUR"}',
  '{"comparison_mode":"descriptive_only"}','pending_review'
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000051f1'
  and s.supersedes_run_id is not null;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000051a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_adopt_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000051f1',
  (select c.id from public.commercial_offer_reparse_candidates c
    where c.organization_id='00000000-0000-0000-0000-0000000051f1'),
  51002,
  array['price_value','price_unit','currency'],
  'must fail identity conflict'
) as conflict_result \gset

select pg_temp.assert_true(
  :'conflict_result'::jsonb->>'status'='blocked'
  and :'conflict_result'::jsonb->>'reason'='recovery_target_identity_conflict'
  and jsonb_array_length(:'conflict_result'::jsonb->'identity_conflicting_fields')>=1,
  'recovery adoption must fail closed on target identity conflict'
);

select pg_temp.assert_true(
  not exists(
    select 1 from public.commercial_offer_reparse_candidate_decisions
    where organization_id='00000000-0000-0000-0000-0000000051f1'
  )
  and (select price_value is null from public.commercial_observations where id=51002),
  'blocked recovery adoption must not mutate observations or append decisions'
);

select public.p1_adopt_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000051f1',
  (select c.id from public.commercial_offer_reparse_candidates c
    where c.organization_id='00000000-0000-0000-0000-0000000051f1'),
  51001,
  array['price_value','price_unit','currency'],
  'explicit compatible target'
) as compatible_result \gset

select pg_temp.assert_true(
  :'compatible_result'::jsonb->>'status'='adopted'
  and :'compatible_result'::jsonb->>'recovery_adoption_guard'='PA2.30.8'
  and (:'compatible_result'::jsonb->>'recovery_identity_anchored')::boolean=true
  and :'compatible_result'::jsonb->>'automatic_candidate_match'='false',
  'compatible recovery target must adopt only after the provenance guard passes'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_offer_reparse_candidate_decisions d
    where d.organization_id='00000000-0000-0000-0000-0000000051f1'
      and d.target_observation_id=51001
      and d.decision='adopted'
  )
  and exists(
    select 1 from public.commercial_observations o
    where o.id=51001 and o.price_value=61.5 and o.price_unit='MT' and o.currency='EUR'
  ),
  'compatible explicit adoption must still use the PA2.29 correction and decision ledger'
);

rollback;
