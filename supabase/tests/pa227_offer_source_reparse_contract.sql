-- PA2.27 — Offer source reparse execution contract acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.27 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000040a1','pa227@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000040f1','PA227 Org','pa227-org',
  '00000000-0000-0000-0000-0000000040a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000040f1',
  '00000000-0000-0000-0000-0000000040a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-0000000040a1',
  '00000000-0000-0000-0000-000000004011',
  'pa227.eml',
  '00000000-0000-0000-0000-0000000040f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
  '00000000-0000-0000-0000-000000004021',
  '00000000-0000-0000-0000-0000000040a1',
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-000000004031',
  'Offer source reparse','offer',now(),
  '00000000-0000-0000-0000-0000000040f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,source_thread_id,email_subject
) values(
  '00000000-0000-0000-0000-000000004041',
  'pa227.eml','.eml',512,'2026/09/22/source-pa227.eml','completed','v3.1',
  'email_message',1,now(),now(),
  '00000000-0000-0000-0000-0000000040a1',
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-000000004021',
  '00000000-0000-0000-0000-0000000040f1',
  'sha256:pa227','00000000-0000-0000-0000-000000004031','Offer source reparse'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
  price_value,price_unit,currency,source_filename,source_text,confidence,search_text,
  organization_id
) values(
  40001,
  '00000000-0000-0000-0000-0000000040a1',
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-000000004021',
  '00000000-0000-0000-0000-000000004031',
  'offered','outbound','round_tube','P265GH',406.4,6.3,12000,
  null,null,null,null,null,'pa227.eml',
  'P265GH 406,4x6,3x12000',0.97,'pa227 offer',
  '00000000-0000-0000-0000-0000000040f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000040f1',
  '00000000-0000-0000-0000-000000004021',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000040a1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000040a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_offer_source_reparse_readiness(
    '00000000-0000-0000-0000-0000000040f1',100
  )#>>'{summary,ready}')::int=1,
  'source-backed remediation thread must be reparse-ready'
);

select public.p1_request_offer_source_reparse(
  '00000000-0000-0000-0000-0000000040f1',
  '00000000-0000-0000-0000-000000004021'
) as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='queued'
  and :'first_result'::jsonb->>'requested_parser_version'='v4'
  and :'first_result'::jsonb->>'candidate_only'='true'
  and (select count(*) from public.commercial_offer_reparse_runs)=1,
  'explicit request must create one candidate-only v4 reparse run'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_offer_reparse_runs
    where thread_id='00000000-0000-0000-0000-000000004021'
      and source_job_id='00000000-0000-0000-0000-000000004041'
      and source_storage_path='2026/09/22/source-pa227.eml'
      and source_checksum='sha256:pa227'
      and status='queued'
  ),
  'run must snapshot the immutable original source job'
);

select public.p1_request_offer_source_reparse(
  '00000000-0000-0000-0000-0000000040f1',
  '00000000-0000-0000-0000-000000004021'
) as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'status'='already_requested'
  and (select count(*) from public.commercial_offer_reparse_runs)=1,
  'repeat request must be idempotent'
);

select pg_temp.assert_true(
  (select count(*) from public.commercial_observations where id=40001)=1
  and (select quantity is null and price_value is null and currency is null
       from public.commercial_observations where id=40001),
  'PA2.27 must not mutate current commercial observations'
);

select pg_temp.assert_true(
  (public.p1_offer_source_reparse_results(
    '00000000-0000-0000-0000-0000000040f1',
    '00000000-0000-0000-0000-000000004021'
  )#>>'{policy,acceptance_requires_future_controlled_action}')::boolean,
  'candidate adoption must remain outside PA2.27'
);

rollback;
