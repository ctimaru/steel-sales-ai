-- PA2.30 — Reparse Remediation Resolution & Decision Closure acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000043a1','pa230@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000043f1','PA230 Org','pa230-org',
  '00000000-0000-0000-0000-0000000043a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000043f1',
  '00000000-0000-0000-0000-0000000043a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004311',
  'pa230.eml',
  '00000000-0000-0000-0000-0000000043f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000004321',
  '00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004331',
  'PA230 resolve','offer',now(),
  '00000000-0000-0000-0000-0000000043f1'
),
(
  '00000000-0000-0000-0000-000000004322',
  '00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004332',
  'PA230 dismiss','offer',now(),
  '00000000-0000-0000-0000-0000000043f1'
),
(
  '00000000-0000-0000-0000-000000004323',
  '00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004333',
  'PA230 conflict','offer',now(),
  '00000000-0000-0000-0000-0000000043f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,source_thread_id,email_subject
) values
(
  '00000000-0000-0000-0000-000000004341',
  'pa230-resolve.eml','.eml',512,'2026/09/23/pa230-resolve.eml','completed','v3.1',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004321',
  '00000000-0000-0000-0000-0000000043f1',
  repeat('a',64),'00000000-0000-0000-0000-000000004331','PA230 resolve'
),
(
  '00000000-0000-0000-0000-000000004342',
  'pa230-dismiss.eml','.eml',512,'2026/09/23/pa230-dismiss.eml','completed','v3.1',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004322',
  '00000000-0000-0000-0000-0000000043f1',
  repeat('b',64),'00000000-0000-0000-0000-000000004332','PA230 dismiss'
),
(
  '00000000-0000-0000-0000-000000004343',
  'pa230-conflict.eml','.eml',512,'2026/09/23/pa230-conflict.eml','completed','v3.1',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004323',
  '00000000-0000-0000-0000-0000000043f1',
  repeat('c',64),'00000000-0000-0000-0000-000000004333','PA230 conflict'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,outer_diameter_mm,thickness_mm,length_mm,
  quantity,quantity_unit,price_value,price_unit,currency,
  source_filename,source_text,confidence,search_text,organization_id
) values
(
  43001,'00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004321',
  '00000000-0000-0000-0000-000000004331',
  'offered','outbound','round_tube','P265GH',406.4,6.3,12000,
  null,null,null,null,null,'pa230-resolve.eml',
  'P265GH 406,4x6,3x12000',0.97,'pa230 resolve',
  '00000000-0000-0000-0000-0000000043f1'
),
(
  43002,'00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004322',
  '00000000-0000-0000-0000-000000004332',
  'offered','outbound','round_tube','P265GH',323.9,7.1,12000,
  null,null,null,null,null,'pa230-dismiss.eml',
  'P265GH 323,9x7,1x12000',0.97,'pa230 dismiss',
  '00000000-0000-0000-0000-0000000043f1'
),
(
  43003,'00000000-0000-0000-0000-0000000043a1',
  '00000000-0000-0000-0000-000000004301',
  '00000000-0000-0000-0000-000000004323',
  '00000000-0000-0000-0000-000000004333',
  'offered','outbound','round_tube','P265GH',406.4,6.3,12000,
  null,null,null,null,null,'pa230-conflict.eml',
  'P265GH 406,4x6,3x12000',0.97,'pa230 conflict',
  '00000000-0000-0000-0000-0000000043f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values
(
  '00000000-0000-0000-0000-0000000043f1',
  '00000000-0000-0000-0000-000000004321',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000043a1'
),
(
  '00000000-0000-0000-0000-0000000043f1',
  '00000000-0000-0000-0000-000000004322',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000043a1'
),
(
  '00000000-0000-0000-0000-0000000043f1',
  '00000000-0000-0000-0000-000000004323',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000043a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  case q.thread_id
    when '00000000-0000-0000-0000-000000004321'::uuid then '00000000-0000-0000-0000-000000004341'::uuid
    when '00000000-0000-0000-0000-000000004322'::uuid then '00000000-0000-0000-0000-000000004342'::uuid
    else '00000000-0000-0000-0000-000000004343'::uuid
  end,
  case q.thread_id
    when '00000000-0000-0000-0000-000000004321'::uuid then '2026/09/23/pa230-resolve.eml'
    when '00000000-0000-0000-0000-000000004322'::uuid then '2026/09/23/pa230-dismiss.eml'
    else '2026/09/23/pa230-conflict.eml'
  end,
  case q.thread_id
    when '00000000-0000-0000-0000-000000004321'::uuid then repeat('a',64)
    when '00000000-0000-0000-0000-000000004322'::uuid then repeat('b',64)
    else repeat('c',64)
  end,
  'v4','completed','{}'::jsonb,
  '00000000-0000-0000-0000-0000000043a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.organization_id='00000000-0000-0000-0000-0000000043f1';

insert into public.commercial_offer_reparse_candidates(
  organization_id,run_id,thread_id,candidate_index,source_text,item_role,
  candidate_evidence,comparison_snapshot,review_status
)
select
  r.organization_id,r.id,r.thread_id,0,
  case r.thread_id
    when '00000000-0000-0000-0000-000000004321'::uuid then 'Resolve candidate'
    when '00000000-0000-0000-0000-000000004322'::uuid then 'Dismiss candidate'
    else 'Conflict candidate'
  end,
  'offered',
  case r.thread_id
    when '00000000-0000-0000-0000-000000004321'::uuid then jsonb_build_object(
      'source_text','Resolve candidate','item_role','offered','grade','P265GH',
      'quantity',10,'quantity_unit','M','price_value',68.38,'price_unit','M','currency','EUR'
    )
    when '00000000-0000-0000-0000-000000004322'::uuid then jsonb_build_object(
      'source_text','Dismiss candidate','item_role','offered','grade','P265GH',
      'price_value',70.00,'price_unit','M','currency','EUR'
    )
    else jsonb_build_object(
      'source_text','Conflict candidate','item_role','offered','grade','S355J2H',
      'quantity',12,'quantity_unit','M','price_value',72.00,'price_unit','M','currency','EUR'
    )
  end,
  '{}'::jsonb,
  'pending_review'
from public.commercial_offer_reparse_runs r
where r.organization_id='00000000-0000-0000-0000-0000000043f1';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000043a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_remediation_closure_events',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_remediation_closure_events',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.commercial_offer_reparse_remediation_closure_events',
    'DELETE'
  ),
  'browser role must not mutate closure ledger directly'
);

select public.p1_adopt_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000043f1',
  (
    select id from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004321'
  ),
  43001,
  array['quantity','quantity_unit','price_value','price_unit','currency'],
  'Recover missing commercial evidence'
) as resolve_adopt gset

select pg_temp.assert_true(
  :'resolve_adopt'::jsonb->>'status'='adopted',
  'resolve candidate must adopt through PA2.29'
);

select public.p1_reject_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000043f1',
  (
    select id from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004322'
  ),
  'Source line is not usable'
) as dismiss_reject gset

select pg_temp.assert_true(
  :'dismiss_reject'::jsonb->>'status'='rejected',
  'dismiss candidate must reach terminal rejected state'
);

select public.p1_adopt_offer_reparse_candidate(
  '00000000-0000-0000-0000-0000000043f1',
  (
    select id from public.commercial_offer_reparse_candidates
    where thread_id='00000000-0000-0000-0000-000000004323'
  ),
  43003,
  array['quantity','quantity_unit','price_value','price_unit','currency'],
  'Recover missing fields but preserve conflicting grade'
) as conflict_adopt gset

select pg_temp.assert_true(
  :'conflict_adopt'::jsonb->>'status'='adopted',
  'conflict scenario must adopt only missing fields'
);

select public.p1_offer_reparse_remediation_closure_readiness(
  '00000000-0000-0000-0000-0000000043f1',100
) as closure_payload gset

select pg_temp.assert_true(
  (:'closure_payload'::jsonb#>>'{summary,ready_resolve}')::int=1
  and (:'closure_payload'::jsonb#>>'{summary,ready_dismiss}')::int=1
  and (:'closure_payload'::jsonb#>>'{summary,conflict_review_required}')::int=1
  and (:'closure_payload'::jsonb#>>'{policy,automatic_closure}')::boolean=false,
  'readiness must distinguish resolve, dismiss and conflict-blocked states'
);

select pg_temp.assert_true(
  exists(
    select 1
    from jsonb_array_elements(:'closure_payload'::jsonb->'items') item
    where item->>'thread_id'='00000000-0000-0000-0000-000000004323'
      and item->>'closure_status'='conflict_review_required'
      and (item->>'unresolved_conflict_count')::int=1
      and item->'unresolved_conflicts'->0->>'field'='grade'
  ),
  'non-null candidate conflict must remain explicitly unresolved'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000043f1',
  (
    select id from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004321'
  ),
  null
) as resolve_close gset

select pg_temp.assert_true(
  :'resolve_close'::jsonb->>'status'='resolved'
  and :'resolve_close'::jsonb->>'resolution_reason'='recovered_required_evidence'
  and exists(
    select 1
    from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004321'
      and status='resolved'
  ),
  'fully recovered remediation must close as resolved'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000043f1',
  (
    select id from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004322'
  ),
  null
) as dismiss_without_note gset

select pg_temp.assert_true(
  :'dismiss_without_note'::jsonb->>'status'='blocked'
  and :'dismiss_without_note'::jsonb->>'reason'='dismissal_note_required',
  'dismissal must require an explicit note'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000043f1',
  (
    select id from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004322'
  ),
  'Original source did not yield recoverable Offer evidence'
) as dismiss_close gset

select pg_temp.assert_true(
  :'dismiss_close'::jsonb->>'status'='dismissed'
  and :'dismiss_close'::jsonb->>'resolution_reason'='all_candidates_rejected'
  and exists(
    select 1
    from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004322'
      and status='dismissed'
      and resolution_notes='Original source did not yield recoverable Offer evidence'
  ),
  'fully rejected remediation may only close explicitly as dismissed'
);

select public.p1_close_offer_reparse_remediation(
  '00000000-0000-0000-0000-0000000043f1',
  (
    select id from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004323'
  ),
  'Attempt to close conflict'
) as conflict_close gset

select pg_temp.assert_true(
  :'conflict_close'::jsonb->>'status'='blocked'
  and :'conflict_close'::jsonb->>'reason'='conflict_review_required'
  and exists(
    select 1
    from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004323'
      and status='pending'
  ),
  'unresolved non-null conflicts must block remediation closure'
);

select pg_temp.assert_true(
  (select count(*)=2
   from public.commercial_offer_reparse_remediation_closure_events
   where organization_id='00000000-0000-0000-0000-0000000043f1')
  and exists(
    select 1
    from public.commercial_offer_reparse_remediation_closure_events
    where organization_id='00000000-0000-0000-0000-0000000043f1'
      and outcome='resolved'
      and resolution_reason='recovered_required_evidence'
  )
  and exists(
    select 1
    from public.commercial_offer_reparse_remediation_closure_events
    where organization_id='00000000-0000-0000-0000-0000000043f1'
      and outcome='dismissed'
      and resolution_reason='all_candidates_rejected'
  ),
  'closure decisions must be appended to the immutable closure ledger'
);

select pg_temp.assert_true(
  (select count(*)=3
   from public.commercial_offer_reparse_candidate_decisions
   where organization_id='00000000-0000-0000-0000-0000000043f1')
  and (select count(*)=3
       from public.commercial_offer_reparse_candidates
       where organization_id='00000000-0000-0000-0000-0000000043f1'),
  'PA2.30 must not rewrite candidate decisions or candidate rows'
);

rollback;
