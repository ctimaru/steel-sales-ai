-- PA2.29 — Reparse Candidate Review & Controlled Adoption acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.29 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000042a1','pa229@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000042f1','PA229 Org','pa229-org',
  '00000000-0000-0000-0000-0000000042a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000042f1',
  '00000000-0000-0000-0000-0000000042a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004201',
  '00000000-0000-0000-0000-0000000042a1',
  '00000000-0000-0000-0000-000000004211',
  'pa229.eml',
  '00000000-0000-0000-0000-0000000042f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000004221',
  '00000000-0000-0000-0000-0000000042a1',
  '00000000-0000-0000-0000-000000004201',
  '00000000-0000-0000-0000-000000004231',
  'Offer candidate adoption','offer',now(),
  '00000000-0000-0000-0000-0000000042f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,source_thread_id,email_subject
) values(
  '00000000-0000-0000-0000-000000004241',
  'pa229.eml','.eml',512,'2026/09/22/source-pa229.eml','completed','v3.1',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000042a1',
  '00000000-0000-0000-0000-000000004201',
  '00000000-0000-0000-0000-000000004221',
  '00000000-0000-0000-0000-0000000042f1',
  repeat('a',64),'00000000-0000-0000-0000-000000004231','Offer candidate adoption'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
  price_value,price_unit,currency,source_filename,source_text,confidence,search_text,
  organization_id
) values(
  42001,
  '00000000-0000-0000-0000-0000000042a1',
  '00000000-0000-0000-0000-000000004201',
  '00000000-0000-0000-0000-000000004221',
  '00000000-0000-0000-0000-000000004231',
  'offered','outbound','round_tube','P265GH',406.4,6.3,12000,
  null,null,null,null,null,'pa229.eml',
  'P265GH 406,4x6,3x12000',0.97,'pa229 offer',
  '00000000-0000-0000-0000-0000000042f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000042f1',
  '00000000-0000-0000-0000-000000004221',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000042a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000004241',
  '2026/09/22/source-pa229.eml',
  repeat('a',64),'v4','completed',
  jsonb_build_object('filename','pa229.eml','extension','.eml','size_bytes',512),
  '00000000-0000-0000-0000-0000000042a1',
  now(),now()
from public.commercial_offer_remediation_queue q
where q.thread_id='00000000-0000-0000-0000-000000004221';

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
)
select
  '00000000-0000-0000-0000-0000000042f1',
  r.id,
  '00000000-0000-0000-0000-000000004221',
  x.idx,
  x.source_text,
  'offered',
  x.evidence,
  jsonb_build_object('comparison_mode','descriptive_only'),
  'pending_review'
from public.commercial_offer_reparse_runs r
cross join lateral (
  values
    (
      0,
      'P265GH 406,4x6,3x12000 - 10 mt - EUR 68,38/mt',
      jsonb_build_object(
        'source_text','P265GH 406,4x6,3x12000 - 10 mt - EUR 68,38/mt',
        'item_role','offered',
        'grade','P265GH',
        'outer_diameter_mm',406.4,
        'thickness_mm',6.3,
        'length_mm',12000,
        'quantity',10,
        'quantity_unit','M',
        'price_value',68.38,
        'price_unit','M',
        'currency','EUR',
        'confidence',0.97
      )
    ),
    (
      1,
      'Alternative line to reject',
      jsonb_build_object(
        'source_text','Alternative line to reject',
        'item_role','offered',
        'grade','P265GH',
        'price_value',70.00,
        'price_unit','M',
        'currency','EUR'
      )
    ),
    (
      2,
      'Conflict candidate',
      jsonb_build_object(
        'source_text','Conflict candidate',
        'item_role','offered',
        'grade','S355J2H'
      )
    )
) as x(idx,source_text,evidence)
where r.thread_id='00000000-0000-0000-0000-000000004221';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000042a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_candidate_decisions',
    'INSERT'
  ),
  'browser role must not insert candidate decisions directly'
);

select public.p1_offer_reparse_candidate_review(
  '00000000-0000-0000-0000-0000000042f1',100
) as review_payload \gset

select pg_temp.assert_true(
  (:'review_payload'::jsonb#>>'{summary,candidate_count}')::int=3
  and (:'review_payload'::jsonb#>>'{summary,pending_review}')::int=3
  and (:'review_payload'::jsonb#>>'{policy,automatic_candidate_match}')::boolean=false
  and (:'review_payload'::jsonb#>>'{policy,overwrite_non_null_fields}')::boolean=false,
  'review model must expose candidates without automatic match or overwrite'
);

select pg_temp.assert_true(
  exists(
    select 1
    from jsonb_array_elements(:'review_payload'::jsonb->'items') item,
         jsonb_array_elements(item->'target_observations') target
    where (item->>'candidate_index')::int=0
      and target->>'observation_id'='42001'
      and target->'adoptable_fields' ? 'quantity'
      and target->'adoptable_fields' ? 'quantity_unit'
      and target->'adoptable_fields' ? 'price_value'
      and target->'adoptable_fields' ? 'price_unit'
      and target->'adoptable_fields' ? 'currency'
      and target->'equal_fields' ? 'grade'
  ),
  'review model must separate adoptable missing fields from equal evidence'
);

select public.p1_adopt_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000042f1',
  (
    select id from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004221'
      and candidate_index=0
  ),
  42001,
  array['quantity','quantity_unit','price_value','price_unit','currency'],
  'Adopt fields recovered from original source reparse'
) as adopt_result \gset

select pg_temp.assert_true(
  :'adopt_result'::jsonb->>'status'='adopted'
  and :'adopt_result'::jsonb->>'target_observation_id'='42001'
  and (select quantity=10 and quantity_unit='M'
       and price_value=68.38 and price_unit='M' and currency='EUR'
       from public.commercial_observations where id=42001),
  'adoption must flow through controlled correction and fill selected missing fields'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_candidate_decisions d
    join public.commercial_correction_events e on e.id=d.correction_event_id
    where d.candidate_id=(
      select id from public.commercial_offer_reparse_candidates
      where thread_id='00000000-0000-0000-0000-000000004221'
        and candidate_index=0
    )
      and d.decision='adopted'
      and d.target_observation_id=42001
      and d.review_id=e.review_id
      and d.decided_by='00000000-0000-0000-0000-0000000042a1'
  ),
  'adoption must append decision and human-correction audit provenance'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004221'
      and candidate_index=0
      and review_status='accepted'
  ),
  'adopted candidate must become accepted'
);

select public.p1_reject_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000042f1',
  (
    select id from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004221'
      and candidate_index=1
  ),
  'Not the line to adopt'
) as reject_result \gset

select pg_temp.assert_true(
  :'reject_result'::jsonb->>'status'='rejected'
  and exists(
    select 1 from public.commercial_offer_reparse_candidate_decisions
    where candidate_id=(
      select id from public.commercial_offer_reparse_candidates
      where thread_id='00000000-0000-0000-0000-000000004221'
        and candidate_index=1
    )
      and decision='rejected'
      and target_observation_id is null
  ),
  'reject must be terminal and must not target an observation'
);

do $$
declare
  conflict_candidate bigint;
begin
  select id into conflict_candidate
  from public.commercial_offer_reparse_candidates
  where thread_id='00000000-0000-0000-0000-000000004221'
    and candidate_index=2;

  begin
    perform public.p1_adopt_offer_reparse_candidate(
      '00000000-0000-0000-0000-0000000042f1',
      conflict_candidate,
      42001,
      array['grade'],
      null
    );
    raise exception 'expected overwrite guard';
  exception
    when sqlstate '55000' then
      null;
  end;
end;
$$;

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_observations
    where id=42001 and grade='P265GH'
  ),
  'PA2.29 must never overwrite a pre-existing non-null observation value'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004221'
      and status='pending'
  ),
  'candidate decisions must not automatically resolve remediation'
);

select pg_temp.assert_true(
  not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_candidate_decisions',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_candidate_decisions',
    'DELETE'
  ),
  'candidate decision ledger must remain non-mutable to browser roles'
);

rollback;
