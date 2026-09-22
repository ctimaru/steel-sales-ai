-- PA2.27 hardening: keep worker_jobs private while exposing tenant-scoped readiness.

create or replace function private.offer_source_reparse_readiness_impl(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with target as (
      select
        q.id remediation_queue_id,
        q.thread_id,
        q.status queue_status,
        t.subject,
        t.dataset_id,
        t.source_conversation_id,
        r.id existing_run_id,
        r.status run_status,
        (
          select w.id
          from public.worker_jobs w
          where w.organization_id=q.organization_id
            and w.storage_path is not null
            and (
              w.thread_id=q.thread_id
              or w.dataset_id=t.dataset_id
              or w.source_thread_id=t.source_conversation_id::text
            )
          order by
            case
              when w.thread_id=q.thread_id then 1
              when w.source_thread_id=t.source_conversation_id::text then 2
              else 3
            end,
            w.completed_at desc nulls last,
            w.created_at desc
          limit 1
        ) source_job_id
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      left join public.commercial_offer_reparse_runs r
        on r.organization_id=q.organization_id and r.remediation_queue_id=q.id
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
        and q.status='pending'
    ),
    enriched as (
      select
        x.*,
        w.filename source_filename,
        w.storage_path,
        w.content_checksum,
        w.parser_version source_parser_version,
        w.status source_job_status,
        case
          when x.source_job_id is null then 'missing_source_job'
          when w.storage_path is null then 'missing_storage_path'
          when w.status is distinct from 'completed' then 'source_job_not_completed'
          when x.existing_run_id is not null then 'already_requested'
          else 'ready'
        end readiness_status
      from target x
      left join public.worker_jobs w on w.id=x.source_job_id
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from enriched),
        'ready',(select count(*) from enriched where readiness_status='ready'),
        'already_requested',(select count(*) from enriched where readiness_status='already_requested'),
        'missing_source_job',(select count(*) from enriched where readiness_status='missing_source_job'),
        'source_job_not_completed',(select count(*) from enriched where readiness_status='source_job_not_completed')
      ),
      'threads',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',e.remediation_queue_id,
          'thread_id',e.thread_id,
          'subject',e.subject,
          'source_job_id',e.source_job_id,
          'source_filename',e.source_filename,
          'source_parser_version',e.source_parser_version,
          'source_job_status',e.source_job_status,
          'readiness_status',e.readiness_status,
          'run_id',e.existing_run_id,
          'run_status',e.run_status
        ) order by e.thread_id)
        from (
          select * from enriched
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) e
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'source_is_original_storage_object',true,
        'requested_parser_version','v4',
        'candidate_only',true,
        'observation_mutation',false,
        'automatic_promotion',false,
        'automatic_remediation_resolution',false,
        'single_thread_explicit_execution',true
      )
    )
  );
end;
$$;

revoke all on function private.offer_source_reparse_readiness_impl(uuid,integer)
from public,anon;
grant execute on function private.offer_source_reparse_readiness_impl(uuid,integer)
to authenticated,service_role;

create or replace function public.p1_offer_source_reparse_readiness(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.offer_source_reparse_readiness_impl(p_organization_id,p_limit);
$$;

revoke all on function public.p1_offer_source_reparse_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_source_reparse_readiness(uuid,integer)
to authenticated,service_role;
