-- RQG4.3: disposable LOCAL ONLY; never execute on hosted Supabase.
-- Add a legitimate zero-Review, imported-data state to the existing isolated processor tenant.
\set ON_ERROR_STOP on
begin;
insert into public.commercial_datasets(id,owner_id,source_run_id,source_filename,organization_id)
values (
 '00000000-0000-0000-0000-000000043301',
 :'processor_user_id'::uuid,
 '00000000-0000-0000-0000-000000043311',
 'rqg43-empty-processor-local.eml',
 '00000000-0000-0000-0000-000000023304'
);
do $$
begin
 if (select count(*) from public.commercial_review_queue where organization_id='00000000-0000-0000-0000-000000023304') <> 0
 then raise exception 'RQG4.3: clean processor must have no Reviews'; end if;
 if (select count(*) from public.commercial_datasets where organization_id='00000000-0000-0000-0000-000000023304') <> 1
 then raise exception 'RQG4.3: imported-data empty processor must have exactly one dataset'; end if;
 if (select count(*) from public.commercial_review_queue where id between 98031 and 98034) <> 4
 then raise exception 'RQG4.3: do not change Company A/B Review fixtures'; end if;
end $$;
commit;
