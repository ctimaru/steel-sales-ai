create or replace function public.resolve_worker_job_entities_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
    and new.thread_id is not null
    and new.knowledge_document_id is not null
    and (
      old.status is distinct from new.status
      or old.thread_id is distinct from new.thread_id
      or old.knowledge_document_id is distinct from new.knowledge_document_id
    )
  then
    begin
      perform public.resolve_commercial_entities(
        new.thread_id,
        new.knowledge_document_id,
        5000
      );
    exception
      when others then
        raise warning 'M5.4 entity resolution failed for worker job %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists worker_jobs_resolve_entities_after_update
  on public.worker_jobs;

create trigger worker_jobs_resolve_entities_after_update
after update of status, thread_id, knowledge_document_id
on public.worker_jobs
for each row
execute function public.resolve_worker_job_entities_after_update();

revoke execute on function public.resolve_worker_job_entities_after_update() from public, anon, authenticated;
grant execute on function public.resolve_worker_job_entities_after_update() to service_role;

comment on function public.resolve_worker_job_entities_after_update() is
  'Best-effort M5.4 hook: enriches a completed worker job with canonical entity mentions without blocking ingestion on resolver errors.';
