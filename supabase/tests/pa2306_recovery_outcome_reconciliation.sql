-- PA2.30.6 — Recovery Outcome Reconciliation acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.6 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000049a1','pa2306@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000049f1','PA2306 Org','pa2306-org',
  '00000000-0000-0000-0000-0000000049a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000049f1',
  '00000000-0000-0000-0000-0000000049a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004911',
  'pa2306-source.zip',
  '00000000-0000-0000-0000-0000000049f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000004921',
  '00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-000000004931',
  'Recovery not started','offer',now(),
  '00000000-0000-0000-0000-0000000049f1'
),
(
  '00000000-0000-0000-0000-000000004922',
  '00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-000000004932',
  'Partial recovery','offer',now(),
  '00000000-0000-0000-0000-0000000049f1'
),
(
  '00000000-0000-0000-0000-000000004923',
  '00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-000000004933',
  'All evidence types present','offer',now(),
  '00000000-0000-0000-0000-0000000049f1'
),
(
  '00000000-0000-0000-0000-000000004924',
  '00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-000000004934',
  'Requested-only candidate','offer',now(),
  '00000000-0000-0000-0000-0000000049f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values
(
  '00000000-0000-0000-0000-0000000049f1',
  '00000000-0000-0000-0000-000000004921',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":1,"currency_gap_count":1,"quantity_gap_count":1}',
  '00000000-0000-0000-0000-0000000049a1'
),
(
  '00000000-0000-0000-0000-0000000049f1',
  '00000000-0000-0000-0000-000000004922',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":1,"currency_gap_count":1,"quantity_gap_count":1}',
  '00000000-0000-0000-0000-0000000049a1'
),
(
  '00000000-0000-0000-0000-0000000049f1',
  '00000000-0000-0000-0000-000000004923',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":2,"currency_gap_count":2,"quantity_gap_count":1}',
  '00000000-0000-0000-0000-0000000049a1'
),
(
  '00000000-0000-0000-0000-0000000049f1',
  '00000000-0000-0000-0000-000000004924',
  'source_reparse_required','source_email_reparse','pending',
  '{"price_gap_count":1,"currency_gap_count":1,"quantity_gap_count":0}',
  '00000000-0000-0000-0000-0000000049a1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values
(
  '00000000-0000-0000-0000-000000004941',
  'partial.eml','.eml',256,'2026/09/23/partial.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-000000004922',
  '00000000-0000-0000-0000-0000000049f1',repeat('a',64),'Partial recovery'
),
(
  '00000000-0000-0000-0000-000000004942',
  'all.eml','.eml',256,'2026/09/23/all.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-000000004923',
  '00000000-0000-0000-0000-0000000049f1',repeat('b',64),'All evidence types'
),
(
  '00000000-0000-0000-0000-000000004943',
  'requested.eml','.eml',256,'2026/09/23/requested.eml','completed','v4','source_reingest',
  1,now(),now(),'00000000-0000-0000-0000-0000000049a1',
  '00000000-0000-0000-0000-000000004901',
  '00000000-0000-0000-0000-000000004924',
  '00000000-0000-0000-0000-0000000049f1',repeat('c',64),'Requested only'
);

-- predecessor runs
insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select q.organization_id,q.id,q.thread_id,
  case q.thread_id
    when '00000000-0000-0000-0000-000000004922'::uuid then '00000000-0000-0000-0000-000000004941'::uuid
    when '00000000-0000-0000-0000-000000004923'::uuid then '00000000-0000-0000-0000-000000004942'::uuid
    else '00000000-0000-0000-0000-000000004943'::uuid
  end,
  'legacy.eml',repeat('d',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000049a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000049f1'
  and q.thread_id<>'00000000-0000-0000-0000-000000004921';

-- successor runs
insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at,supersedes_run_id
)
select
  q.organization_id,q.id,q.thread_id,
  case q.thread_id
    when '00000000-0000-0000-0000-000000004922'::uuid then '00000000-0000-0000-0000-000000004941'::uuid
    when '00000000-0000-0000-0000-000000004923'::uuid then '00000000-0000-0000-0000-000000004942'::uuid
    else '00000000-0000-0000-0000-000000004943'::uuid
  end,
  case q.thread_id
    when '00000000-0000-0000-0000-000000004922'::uuid then '2026/09/23/partial.eml'
    when '00000000-0000-0000-0000-000000004923'::uuid then '2026/09/23/all.eml'
    else '2026/09/23/requested.eml'
  end,
  repeat('e',64),'v4','completed','{}',
  '00000000-0000-0000-0000-0000000049a1',now(),now(),
  (
    select p.id from public.commercial_offer_reparse_runs p
    where p.organization_id=q.organization_id
      and p.remediation_queue_id=q.id
      and p.supersedes_run_id is null
    order by p.id desc limit 1
  )
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000049f1'
  and q.thread_id<>'00000000-0000-0000-0000-000000004921';

insert into public.commercial_offer_source_reingests(
  organization_id,remediation_queue_id,thread_id,requested_from_run_id,requested_by,
  status,source_job_id,successor_run_id,filename,storage_path,content_checksum,size_bytes,
  started_at,completed_at,selected_source_filename,source_selection_mode,selected_by,selected_at
)
select
  q.organization_id,q.id,q.thread_id,p.id,
  '00000000-0000-0000-0000-0000000049a1','consumed',
  s.source_job_id,s.id,
  regexp_replace(s.source_storage_path,'^.*/',''),
  s.source_storage_path,s.source_checksum,256,now(),now(),
  'Inbox/'||regexp_replace(s.source_storage_path,'^.*/',''),
  'unique_offered_source',
  '00000000-0000-0000-0000-0000000049a1',now()
from public.commercial_offer_remediation_queue q
join public.commercial_offer_reparse_runs p
  on p.organization_id=q.organization_id
 and p.remediation_queue_id=q.id
 and p.supersedes_run_id is null
join public.commercial_offer_reparse_runs s
  on s.organization_id=q.organization_id
 and s.remediation_queue_id=q.id
 and s.supersedes_run_id=p.id
where q.organization_id='00000000-0000-0000-0000-0000000049f1'
  and q.thread_id<>'00000000-0000-0000-0000-000000004921';

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
)
select
  '00000000-0000-0000-0000-0000000049f1',
  s.id,
  s.thread_id,
  0,
  case s.thread_id
    when '00000000-0000-0000-0000-000000004922'::uuid then '10 ton'
    when '00000000-0000-0000-0000-000000004923'::uuid then 'EUR 61,50 - 10 ton'
    else 'requested item'
  end,
  case when s.thread_id='00000000-0000-0000-0000-000000004924'::uuid
    then 'requested' else 'offered' end,
  case s.thread_id
    when '00000000-0000-0000-0000-000000004922'::uuid
      then '{"quantity":10,"quantity_unit":"T"}'::jsonb
    when '00000000-0000-0000-0000-000000004923'::uuid
      then '{"price_value":61.5,"price_unit":"M","currency":"EUR","quantity":10,"quantity_unit":"T"}'::jsonb
    else '{"price_value":42,"currency":"EUR"}'::jsonb
  end,
  '{"comparison_mode":"descriptive_only"}',
  'pending_review'
from public.commercial_offer_reparse_runs s
where s.organization_id='00000000-0000-0000-0000-0000000049f1'
  and s.supersedes_run_id is not null;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000049a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_offer_recovery_outcome_reconciliation(
  '00000000-0000-0000-0000-0000000049f1',100
) as reconciliation \gset

select pg_temp.assert_true(
  (:'reconciliation'::jsonb#>>'{summary,target_threads}')::int=4
  and (:'reconciliation'::jsonb#>>'{summary,recovery_not_started}')::int=1
  and (:'reconciliation'::jsonb#>>'{summary,partial_required_evidence_recovered}')::int=1
  and (:'reconciliation'::jsonb#>>'{summary,all_required_evidence_types_present}')::int=1
  and (:'reconciliation'::jsonb#>>'{summary,completed_no_offered_candidates}')::int=1,
  'reconciliation summary must distinguish no-start, partial, all-types and non-offered outcomes'
);

select pg_temp.assert_true(
  exists(
    select 1 from jsonb_array_elements(:'reconciliation'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004922'
      and item->>'reconciliation_status'='partial_required_evidence_recovered'
      and (item#>>'{recovered_evidence_types,quantity}')::boolean=true
      and (item#>>'{recovered_evidence_types,price}')::boolean=false
      and (item#>>'{recovered_evidence_types,currency}')::boolean=false
  ),
  'quantity-only offered candidate must reconcile as partial evidence recovery'
);

select pg_temp.assert_true(
  exists(
    select 1 from jsonb_array_elements(:'reconciliation'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004923'
      and item->>'reconciliation_status'='all_required_evidence_types_present'
      and (item->>'required_evidence_type_count')::int=3
      and (item->>'recovered_evidence_type_count')::int=3
  ),
  'all required evidence types may be present without claiming gap resolution'
);

select pg_temp.assert_true(
  (:'reconciliation'::jsonb#>>'{policy,evidence_type_presence_is_not_gap_resolution}')::boolean=true
  and (:'reconciliation'::jsonb#>>'{policy,candidate_observation_matching_required_before_resolution}')::boolean=true
  and (:'reconciliation'::jsonb#>>'{policy,automatic_candidate_adoption}')::boolean=false
  and (:'reconciliation'::jsonb#>>'{policy,automatic_remediation_closure}')::boolean=false,
  'PA2.30.6 must remain descriptive-only and fail closed'
);

rollback;
