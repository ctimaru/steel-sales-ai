-- PA2.28 controlled source reparse execution acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.28 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000041a1','pa228@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000041f1','PA228 Org','pa228-org',
  '00000000-0000-0000-0000-0000000041a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000041f1',
  '00000000-0000-0000-0000-0000000041a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004101',
  '00000000-0000-0000-0000-0000000041a1',
  '00000000-0000-0000-0000-000000004111',
  'pa228.eml',
  '00000000-0000-0000-0000-0000000041f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000004121',
  '00000000-0000-0000-0000-0000000041a1',
  '00000000-0000-0000-0000-000000004101',
  '00000000-0000-0000-0000-000000004131',
  'Offer controlled reparse','offer',now(),
  '00000000-0000-0000-0000-0000000041f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,source_thread_id,email_subject
) values(
  '00000000-0000-0000-0000-000000004141',
  'pa228.eml','.eml',512,'2026/09/22/source-pa228.eml','completed','v3.1',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000041a1',
  '00000000-0000-0000-0000-000000004101',
  '00000000-0000-0000-0000-000000004121',
  '00000000-0000-0000-0000-0000000041f1',
  repeat('a',64),'00000000-0000-0000-0000-000000004131','Offer controlled reparse'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
  price_value,price_unit,currency,source_filename,source_text,confidence,search_text,
  organization_id
) values(
  41001,
  '00000000-0000-0000-0000-0000000041a1',
  '00000000-0000-0000-0000-000000004101',
  '00000000-0000-0000-0000-000000004121',
  '00000000-0000-0000-0000-000000004131',
  'offered','outbound','round_tube','P265GH',406.4,6.3,12000,
  null,null,null,null,null,'pa228.eml',
  'P265GH 406,4x6,3x12000',0.97,'pa228 offer',
  '00000000-0000-0000-0000-0000000041f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000041f1',
  '00000000-0000-0000-0000-000000004121',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000041a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000004141',
  '2026/09/22/source-pa228.eml',
  repeat('a',64),'v4','queued',
  jsonb_build_object('filename','pa228.eml','extension','.eml','size_bytes',512),
  '00000000-0000-0000-0000-0000000041a1'
from public.commercial_offer_remediation_queue q
where q.thread_id='00000000-0000-0000-0000-000000004121';

select pg_temp.assert_true(
  not has_function_privilege('authenticated','public.p1_claim_offer_source_reparse_run(bigint)','EXECUTE')
  and not has_function_privilege('authenticated','public.p1_complete_offer_source_reparse_run(bigint,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.p1_fail_offer_source_reparse_run(bigint,text)','EXECUTE'),
  'authenticated users must not execute service-only PA2.28 RPCs'
);

set local role service_role;

select public.p1_claim_offer_source_reparse_run(
  (select id from public.commercial_offer_reparse_runs
   where thread_id='00000000-0000-0000-0000-000000004121')
) as claim_result \gset

select pg_temp.assert_true(
  :'claim_result'::jsonb->>'status'='claimed'
  and :'claim_result'::jsonb->>'requested_parser_version'='v4'
  and (select status='processing'
       from public.commercial_offer_reparse_runs
       where id=(:'claim_result'::jsonb->>'run_id')::bigint),
  'service role must atomically claim a queued run'
);

select public.p1_complete_offer_source_reparse_run(
  (:'claim_result'::jsonb->>'run_id')::bigint,
  jsonb_build_array(
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
    ),
    jsonb_build_object(
      'source_text','Richiesta 323,9x7,1x12000',
      'item_role','requested',
      'grade','L275',
      'outer_diameter_mm',323.9,
      'thickness_mm',7.1,
      'length_mm',12000,
      'confidence',0.90
    )
  )
) as complete_result \gset

select pg_temp.assert_true(
  :'complete_result'::jsonb->>'status'='completed'
  and (:'complete_result'::jsonb->>'candidate_count')::int=2
  and (select status='completed'
       from public.commercial_offer_reparse_runs
       where id=(:'claim_result'::jsonb->>'run_id')::bigint)
  and (select count(*) from public.commercial_offer_reparse_candidates
       where run_id=(:'claim_result'::jsonb->>'run_id')::bigint)=2,
  'completion must persist candidate evidence only'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_candidates
    where run_id=(:'claim_result'::jsonb->>'run_id')::bigint
      and comparison_snapshot->>'comparison_mode'='descriptive_only'
      and (comparison_snapshot->>'automatic_candidate_match')::boolean=false
      and (comparison_snapshot->>'automatic_field_adoption')::boolean=false
      and review_status='pending_review'
  ),
  'candidate comparison must remain descriptive and review-gated'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_observations
    where id=41001
      and quantity is null
      and price_value is null
      and currency is null
  ),
  'PA2.28 must not mutate baseline observations'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_offer_remediation_queue
    where thread_id='00000000-0000-0000-0000-000000004121'
      and status='pending'
  ),
  'PA2.28 must not resolve remediation automatically'
);

select public.p1_complete_offer_source_reparse_run(
  (:'claim_result'::jsonb->>'run_id')::bigint,
  '[]'::jsonb
) as repeat_result \gset

select pg_temp.assert_true(
  :'repeat_result'::jsonb->>'status'='already_completed'
  and (select count(*) from public.commercial_offer_reparse_candidates
       where run_id=(:'claim_result'::jsonb->>'run_id')::bigint)=2,
  'repeat completion must be idempotent'
);

rollback;
