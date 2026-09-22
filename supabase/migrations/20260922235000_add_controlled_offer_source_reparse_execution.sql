-- PA2.28 — Controlled Source Reparse Execution.
-- Service-only execution: claim -> source verification -> candidate persistence -> complete/fail.
-- No commercial_observations mutation and no candidate acceptance/promotion.

create or replace function public.p1_claim_offer_source_reparse_run(
  p_run_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  r public.commercial_offer_reparse_runs%rowtype;
begin
  select * into r
  from public.commercial_offer_reparse_runs
  where id=p_run_id
  for update;

  if not found then
    return jsonb_build_object('status','not_found','run_id',p_run_id);
  end if;

  if r.status<>'queued' then
    return jsonb_build_object(
      'status','not_claimable',
      'run_id',r.id,
      'run_status',r.status
    );
  end if;

  update public.commercial_offer_reparse_runs
  set status='processing',
      started_at=coalesce(started_at,now()),
      error=null
  where id=r.id;

  return jsonb_build_object(
    'status','claimed',
    'run_id',r.id,
    'organization_id',r.organization_id,
    'thread_id',r.thread_id,
    'source_job_id',r.source_job_id,
    'source_storage_path',r.source_storage_path,
    'source_checksum',r.source_checksum,
    'requested_parser_version',r.requested_parser_version,
    'source_snapshot',r.source_snapshot,
    'candidate_only',true,
    'control_phase','PA2.28'
  );
end;
$$;

revoke all on function public.p1_claim_offer_source_reparse_run(bigint)
from public,anon,authenticated;
grant execute on function public.p1_claim_offer_source_reparse_run(bigint)
to service_role;

create or replace function public.p1_complete_offer_source_reparse_run(
  p_run_id bigint,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  r public.commercial_offer_reparse_runs%rowtype;
  candidate jsonb;
  idx integer := 0;
  inserted_count integer := 0;
  baseline jsonb;
begin
  if jsonb_typeof(coalesce(p_candidates,'[]'::jsonb))<>'array' then
    raise exception 'p_candidates must be a JSON array';
  end if;

  select * into r
  from public.commercial_offer_reparse_runs
  where id=p_run_id
  for update;

  if not found then
    return jsonb_build_object('status','not_found','run_id',p_run_id);
  end if;

  if r.status='completed' then
    return jsonb_build_object(
      'status','already_completed',
      'run_id',r.id,
      'candidate_count',(
        select count(*) from public.commercial_offer_reparse_candidates c
        where c.run_id=r.id
      )
    );
  end if;

  if r.status<>'processing' then
    return jsonb_build_object(
      'status','not_completable',
      'run_id',r.id,
      'run_status',r.status
    );
  end if;

  if exists (
    select 1 from public.commercial_offer_reparse_candidates c
    where c.run_id=r.id
  ) then
    raise exception 'candidate rows already exist for run %',r.id;
  end if;

  select jsonb_build_object(
    'baseline_observation_ids',
      coalesce(jsonb_agg(o.id order by o.id),'[]'::jsonb),
    'baseline_count',count(*),
    'baseline_missing',jsonb_build_object(
      'quantity',count(*) filter(where o.quantity is null or o.quantity_unit is null),
      'price',count(*) filter(where o.price_value is null or o.price_unit is null),
      'currency',count(*) filter(where o.currency is null)
    )
  )
  into baseline
  from public.commercial_observations o
  where o.organization_id=r.organization_id
    and o.thread_id=r.thread_id
    and o.item_role='offered';

  for candidate in
    select value from jsonb_array_elements(coalesce(p_candidates,'[]'::jsonb))
  loop
    insert into public.commercial_offer_reparse_candidates(
      organization_id,run_id,thread_id,candidate_index,source_text,item_role,
      candidate_evidence,comparison_snapshot,review_status
    ) values (
      r.organization_id,
      r.id,
      r.thread_id,
      idx,
      nullif(candidate->>'source_text',''),
      nullif(candidate->>'item_role',''),
      candidate,
      coalesce(baseline,'{}'::jsonb) || jsonb_build_object(
        'comparison_mode','descriptive_only',
        'automatic_candidate_match',false,
        'automatic_field_adoption',false,
        'candidate_present_fields',(
          select coalesce(jsonb_agg(k order by k),'[]'::jsonb)
          from jsonb_object_keys(candidate) k
          where candidate->k is not null
            and candidate->k <> 'null'::jsonb
        )
      ),
      'pending_review'
    );
    idx := idx + 1;
    inserted_count := inserted_count + 1;
  end loop;

  update public.commercial_offer_reparse_runs
  set status='completed',
      completed_at=now(),
      error=null
  where id=r.id;

  return jsonb_build_object(
    'status','completed',
    'run_id',r.id,
    'candidate_count',inserted_count,
    'candidate_only',true,
    'observation_mutation',false,
    'automatic_promotion',false,
    'automatic_remediation_resolution',false,
    'control_phase','PA2.28'
  );
end;
$$;

revoke all on function public.p1_complete_offer_source_reparse_run(bigint,jsonb)
from public,anon,authenticated;
grant execute on function public.p1_complete_offer_source_reparse_run(bigint,jsonb)
to service_role;

create or replace function public.p1_fail_offer_source_reparse_run(
  p_run_id bigint,
  p_error text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  r public.commercial_offer_reparse_runs%rowtype;
begin
  select * into r
  from public.commercial_offer_reparse_runs
  where id=p_run_id
  for update;

  if not found then
    return jsonb_build_object('status','not_found','run_id',p_run_id);
  end if;

  if r.status='completed' then
    return jsonb_build_object('status','already_completed','run_id',r.id);
  end if;

  update public.commercial_offer_reparse_runs
  set status='failed',
      completed_at=now(),
      error=left(coalesce(nullif(btrim(p_error),''),'unknown reparse failure'),2000)
  where id=r.id;

  return jsonb_build_object(
    'status','failed',
    'run_id',r.id,
    'control_phase','PA2.28'
  );
end;
$$;

revoke all on function public.p1_fail_offer_source_reparse_run(bigint,text)
from public,anon,authenticated;
grant execute on function public.p1_fail_offer_source_reparse_run(bigint,text)
to service_role;
