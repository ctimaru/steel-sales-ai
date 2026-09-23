-- PA2.30.4 — Ambiguous Source Selection & Controlled Recovery acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.30.4 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email)
values('00000000-0000-0000-0000-0000000047a1','pa2304@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
  '00000000-0000-0000-0000-0000000047f1','PA2304 Org','pa2304-org',
  '00000000-0000-0000-0000-0000000047a1','completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values(
  '00000000-0000-0000-0000-0000000047f1',
  '00000000-0000-0000-0000-0000000047a1',
  'admin','sales_director','active',true
);

insert into public.commercial_datasets(
  id,owner_id,source_run_id,source_filename,organization_id
) values(
  '00000000-0000-0000-0000-000000004701',
  '00000000-0000-0000-0000-0000000047a1',
  '00000000-0000-0000-0000-000000004711',
  'pa2304-source.zip',
  '00000000-0000-0000-0000-0000000047f1'
);

insert into public.commercial_threads(
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
  '00000000-0000-0000-0000-000000004721',
  '00000000-0000-0000-0000-0000000047a1',
  '00000000-0000-0000-0000-000000004701',
  '00000000-0000-0000-0000-000000004731',
  'Ambiguous offered source','offer',now(),
  '00000000-0000-0000-0000-0000000047f1'
),
(
  '00000000-0000-0000-0000-000000004722',
  '00000000-0000-0000-0000-0000000047a1',
  '00000000-0000-0000-0000-000000004701',
  '00000000-0000-0000-0000-000000004732',
  'Wrong source holder','offer',now(),
  '00000000-0000-0000-0000-0000000047f1'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
  extraction_count,created_at,completed_at,owner_id,dataset_id,thread_id,
  organization_id,content_checksum,email_subject
) values(
  '00000000-0000-0000-0000-000000004741',
  'wrong.eml','.eml',128,'2026/09/23/wrong.eml','completed','v4','email_message',
  1,now(),now(),
  '00000000-0000-0000-0000-0000000047a1',
  '00000000-0000-0000-0000-000000004701',
  '00000000-0000-0000-0000-000000004722',
  '00000000-0000-0000-0000-0000000047f1',
  repeat('a',64),'Wrong source'
);

insert into public.commercial_observations(
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  source_filename,source_text,confidence,search_text,organization_id
) values
(
  47001,
  '00000000-0000-0000-0000-0000000047a1',
  '00000000-0000-0000-0000-000000004701',
  '00000000-0000-0000-0000-000000004721',
  '00000000-0000-0000-0000-000000004731',
  'offered','outbound',
  'Inbox/offer-a.eml','Offro EUR 20/mt',0.98,'offer a',
  '00000000-0000-0000-0000-0000000047f1'
),
(
  47002,
  '00000000-0000-0000-0000-0000000047a1',
  '00000000-0000-0000-0000-000000004701',
  '00000000-0000-0000-0000-000000004721',
  '00000000-0000-0000-0000-000000004731',
  'offered','outbound',
  'Inbox/offer-b.eml','Offro EUR 21/mt',0.98,'offer b',
  '00000000-0000-0000-0000-0000000047f1'
),
(
  47003,
  '00000000-0000-0000-0000-0000000047a1',
  '00000000-0000-0000-0000-000000004701',
  '00000000-0000-0000-0000-000000004721',
  '00000000-0000-0000-0000-000000004731',
  'requested','inbound',
  'Inbox/request.eml','Richiesta prezzo',0.98,'request',
  '00000000-0000-0000-0000-0000000047f1'
);

insert into public.commercial_offer_remediation_queue(
  organization_id,thread_id,category,recommended_action,status,evidence_snapshot,enrolled_by
) values(
  '00000000-0000-0000-0000-0000000047f1',
  '00000000-0000-0000-0000-000000004721',
  'source_reparse_required','source_email_reparse','pending','{}'::jsonb,
  '00000000-0000-0000-0000-0000000047a1'
);

insert into public.commercial_offer_reparse_runs(
  organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
  source_checksum,requested_parser_version,status,source_snapshot,requested_by,
  started_at,completed_at
)
select
  q.organization_id,q.id,q.thread_id,
  '00000000-0000-0000-0000-000000004741',
  '2026/09/23/wrong.eml',repeat('a',64),'v4','completed',
  '{"filename":"wrong.eml","extension":".eml","size_bytes":128}'::jsonb,
  '00000000-0000-0000-0000-0000000047a1',now(),now()
from public.commercial_offer_remediation_queue q
where q.thread_id='00000000-0000-0000-0000-000000004721';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000047a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_invalidate_offer_reparse_run(
  '00000000-0000-0000-0000-0000000047f1',
  (select id from public.commercial_offer_reparse_runs
   where thread_id='00000000-0000-0000-0000-000000004721'),
  'source_job_not_thread_bound',
  'ambiguous source test'
) as invalidation \gset

select public.p1_request_offer_source_reingest(
  '00000000-0000-0000-0000-0000000047f1',
  '00000000-0000-0000-0000-000000004721',
  'generic must fail'
) as generic_request \gset

select pg_temp.assert_true(
  :'generic_request'::jsonb->>'status'='blocked'
  and :'generic_request'::jsonb->>'reason'='ambiguous_source_selection_required'
  and jsonb_array_length(:'generic_request'::jsonb->'offered_source_filenames')=2,
  'generic recovery must fail closed when more than one offered source exists'
);

select public.p1_request_offer_source_reingest_selection(
  '00000000-0000-0000-0000-0000000047f1',
  '00000000-0000-0000-0000-000000004721',
  'Inbox/request.eml',
  'requested evidence is not an offer'
) as invalid_selection \gset

select pg_temp.assert_true(
  :'invalid_selection'::jsonb->>'status'='blocked'
  and :'invalid_selection'::jsonb->>'reason'='selected_source_not_offered_evidence',
  'manual selection must be restricted to offered evidence'
);

select public.p1_request_offer_source_reingest_selection(
  '00000000-0000-0000-0000-0000000047f1',
  '00000000-0000-0000-0000-000000004721',
  'Inbox/offer-b.eml',
  'explicit reviewed selection'
) as selected_request \gset

select pg_temp.assert_true(
  :'selected_request'::jsonb->>'status'='requested'
  and :'selected_request'::jsonb->>'selected_source_filename'='Inbox/offer-b.eml'
  and :'selected_request'::jsonb->>'source_selection_mode'='manual_offered_source',
  'valid explicit offered source selection must be recorded'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.commercial_offer_source_reingests s
    where s.id=(:'selected_request'::jsonb->>'reingest_id')::bigint
      and s.selected_source_filename='Inbox/offer-b.eml'
      and s.source_selection_mode='manual_offered_source'
      and s.selected_by='00000000-0000-0000-0000-0000000047a1'
      and s.selected_at is not null
  ),
  'selection provenance must persist in the re-ingest ledger'
);

select public.p1_request_offer_source_reingest_selection(
  '00000000-0000-0000-0000-0000000047f1',
  '00000000-0000-0000-0000-000000004721',
  'Inbox/offer-b.eml',
  'idempotent same selection'
) as repeat_same \gset

select pg_temp.assert_true(
  :'repeat_same'::jsonb->>'status'='already_requested'
  and :'repeat_same'::jsonb->>'selected_source_filename'='Inbox/offer-b.eml',
  'same explicit selection must be idempotent'
);

select public.p1_request_offer_source_reingest_selection(
  '00000000-0000-0000-0000-0000000047f1',
  '00000000-0000-0000-0000-000000004721',
  'Inbox/offer-a.eml',
  'conflicting second selection'
) as repeat_other \gset

select pg_temp.assert_true(
  :'repeat_other'::jsonb->>'status'='blocked'
  and :'repeat_other'::jsonb->>'reason'='active_reingest_selection_conflict',
  'an active re-ingest selection cannot be silently changed'
);

set local role service_role;

select public.p1_claim_offer_source_reingest(
  (:'selected_request'::jsonb->>'reingest_id')::bigint,
  '00000000-0000-0000-0000-0000000047a1'
) as claim \gset

select pg_temp.assert_true(
  :'claim'::jsonb->>'status'='claimed'
  and :'claim'::jsonb->>'source_selection_status'='manually_selected_offered_source'
  and :'claim'::jsonb->>'selected_source_filename'='Inbox/offer-b.eml'
  and :'claim'::jsonb->>'preferred_source_filename'='Inbox/offer-b.eml',
  'worker claim must carry the explicit source selection'
);

create or replace function pg_temp.assert_selected_source_rejects_wrong_file(p_reingest_id bigint)
returns void language plpgsql as $
begin
  begin
    perform public.p1_complete_offer_source_reingest(
      p_reingest_id,
      '00000000-0000-0000-0000-000000004742',
      'offer-a.eml',
      '2026/09/23/offer-a.eml',
      repeat('b',64),
      256
    );
    raise exception 'expected explicit source mismatch';
  exception
    when sqlstate '22023' then
      if position('explicitly selected source' in sqlerrm)=0 then
        raise;
      end if;
  end;
end;
$;

select pg_temp.assert_selected_source_rejects_wrong_file(
  (:'selected_request'::jsonb->>'reingest_id')::bigint
);

select pg_temp.assert_true(
  not exists(
    select 1 from public.commercial_offer_reparse_runs r
    where r.supersedes_run_id is not null
      and r.thread_id='00000000-0000-0000-0000-000000004721'
  ),
  'wrong EML must not create a successor run'
);

select public.p1_complete_offer_source_reingest(
  (:'selected_request'::jsonb->>'reingest_id')::bigint,
  '00000000-0000-0000-0000-000000004743',
  'offer-b.eml',
  '2026/09/23/offer-b.eml',
  repeat('c',64),
  256
) as completed \gset

select pg_temp.assert_true(
  :'completed'::jsonb->>'status'='consumed'
  and :'completed'::jsonb->>'selected_source_filename'='Inbox/offer-b.eml'
  and :'completed'::jsonb->>'source_selection_mode'='manual_offered_source',
  'successful completion must preserve explicit source provenance'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.commercial_offer_reparse_runs r
    where r.id=(:'completed'::jsonb->>'successor_run_id')::bigint
      and r.supersedes_run_id is not null
      and r.source_snapshot->>'selected_source_filename'='Inbox/offer-b.eml'
      and r.source_snapshot->>'source_selection_mode'='manual_offered_source'
  ),
  'successor source snapshot must carry explicit source provenance'
);

rollback;
