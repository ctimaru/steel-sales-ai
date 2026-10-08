-- NC3.1 Workspace inbox: isolated tenant and per-user lifecycle acceptance.
begin;
create or replace function pg_temp.nc31_assert(ok boolean,why text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NC31: %',why; end if; end;
$$;
create or replace function pg_temp.nc31_denied(statement text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate='42501' then return; end if;
    raise exception 'NC31 unexpected rejection code %: %',sqlstate,sqlerrm;
  end;
  raise exception 'NC31 expected access denial: %',statement;
end;
$$;
select pg_temp.nc31_assert(
 has_function_privilege('authenticated','public.nc31_workspace_notifications_read(uuid,text,integer,integer)','EXECUTE')
 and not has_function_privilege('anon','public.nc31_workspace_notifications_read(uuid,text,integer,integer)','EXECUTE')
 and has_function_privilege('authenticated','public.nc31_workspace_notification_set_state(uuid,uuid,text)','EXECUTE')
 and not has_function_privilege('anon','public.nc31_workspace_notification_set_state(uuid,uuid,text)','EXECUTE')
 and not has_function_privilege('anon','public.nc31_workspace_notification_destination(uuid,uuid)','EXECUTE'),
 'three RPCs executable only for authenticated callers');

insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000003101','nc31-a@example.test'),
('00000000-0000-0000-0000-000000003102','nc31-a-colleague@example.test'),
('00000000-0000-0000-0000-000000003103','nc31-b@example.test');
insert into public.organizations(id,name,slug,created_by) values
('00000000-0000-0000-0000-000000003111','NC31 A','nc31-org-a','00000000-0000-0000-0000-000000003101'),
('00000000-0000-0000-0000-000000003112','NC31 B','nc31-org-b','00000000-0000-0000-0000-000000003103');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
('00000000-0000-0000-0000-000000003111','00000000-0000-0000-0000-000000003101','admin','active',true),
('00000000-0000-0000-0000-000000003111','00000000-0000-0000-0000-000000003102','member','active',true),
('00000000-0000-0000-0000-000000003112','00000000-0000-0000-0000-000000003103','admin','active',true);

insert into public.workspace_notification_events(
 id,organization_id,event_type,source_table,source_event_id,source_revision,priority,occurred_at
) values
('00000000-0000-0000-0000-000000003121','00000000-0000-0000-0000-000000003111',
 'workspace.import.failed','worker_jobs','00000000-0000-0000-0000-000000003141',1,'action_required',now()),
('00000000-0000-0000-0000-000000003122','00000000-0000-0000-0000-000000003111',
 'workspace.rfq.award_confirmed','buyer_rfq_events','00000000-0000-0000-0000-000000003142',1,'action_required',now()),
('00000000-0000-0000-0000-000000003123','00000000-0000-0000-0000-000000003112',
 'workspace.import.failed','worker_jobs','00000000-0000-0000-0000-000000003143',1,'action_required',now());
insert into public.workspace_notification_recipients(
 id,event_id,organization_id,recipient_user_id
) values
('00000000-0000-0000-0000-000000003131','00000000-0000-0000-0000-000000003121',
 '00000000-0000-0000-0000-000000003111','00000000-0000-0000-0000-000000003101'),
('00000000-0000-0000-0000-000000003132','00000000-0000-0000-0000-000000003122',
 '00000000-0000-0000-0000-000000003111','00000000-0000-0000-0000-000000003101'),
('00000000-0000-0000-0000-000000003133','00000000-0000-0000-0000-000000003122',
 '00000000-0000-0000-0000-000000003111','00000000-0000-0000-0000-000000003102'),
('00000000-0000-0000-0000-000000003134','00000000-0000-0000-0000-000000003123',
 '00000000-0000-0000-0000-000000003112','00000000-0000-0000-0000-000000003103');

insert into public.worker_jobs(
 id,filename,extension,size_bytes,status,completed_at,owner_id,organization_id,attempt_number
) values
('00000000-0000-0000-0000-000000003141','nc31-failed.eml','eml',12,'failed',now(),
 '00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003111',1);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003101',true);
select pg_temp.nc31_assert(
 (public.nc31_workspace_notifications_read(
  '00000000-0000-0000-0000-000000003111','all',15,0)->>'unread_count')::int=2,
 'tenant A user sees two personal unread rows');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notifications_read(
  '00000000-0000-0000-0000-000000003111','commercial',15,0)->>'filtered_count')::int=1,
 'commercial filter isolates RFQ');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notifications_read(
  '00000000-0000-0000-0000-000000003111','system',15,0)->>'filtered_count')::int=1,
 'system filter isolates failed import');
select pg_temp.nc31_assert(
 jsonb_array_length(
  public.nc31_workspace_notifications_read(
   '00000000-0000-0000-0000-000000003111','all',1,0)->'items')=1,
 'pagination limited to requested batch');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notification_destination(
  '00000000-0000-0000-0000-000000003131','00000000-0000-0000-0000-000000003111')->>'type')='uploads',
 'source resolver validates real job and redirects owner to uploads');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notification_destination(
  '00000000-0000-0000-0000-000000003132','00000000-0000-0000-0000-000000003111')->>'type')='unavailable',
 'cannot create deep link to nonexistent RFQ');

select pg_temp.nc31_assert(
 (public.nc31_workspace_notification_set_state(
   '00000000-0000-0000-0000-000000003131','00000000-0000-0000-0000-000000003111','read')->>'ok')='true',
 'mark read own recipient');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notifications_read(
  '00000000-0000-0000-0000-000000003111','unread',15,0)->>'filtered_count')::int=1,
 'read state reduces own unread count');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notification_set_state(
   '00000000-0000-0000-0000-000000003131','00000000-0000-0000-0000-000000003111','archive')->>'ok')='true',
 'archive own read notification');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notifications_read(
  '00000000-0000-0000-0000-000000003111','archived',15,0)->>'filtered_count')::int=1,
 'archived is personalized');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notification_set_state(
   '00000000-0000-0000-0000-000000003131','00000000-0000-0000-0000-000000003111','restore')->>'ok')='true',
 'restore archived notification');
select pg_temp.nc31_assert(
 (public.nc31_workspace_notification_set_state(
   '00000000-0000-0000-0000-000000003131','00000000-0000-0000-0000-000000003111','unread')->>'ok')='true',
 'mark unread restores user status');
select pg_temp.nc31_denied(
 $$select public.nc31_workspace_notification_set_state(
 '00000000-0000-0000-0000-000000003133','00000000-0000-0000-0000-000000003111','read')$$);
select pg_temp.nc31_denied(
 $$select public.nc31_workspace_notification_set_state(
 '00000000-0000-0000-0000-000000003134','00000000-0000-0000-0000-000000003112','read')$$);
select pg_temp.nc31_denied(
 $$select public.nc31_workspace_notifications_read(
 '00000000-0000-0000-0000-000000003112','all',15,0)$$);
select pg_temp.nc31_denied(
 $$select public.nc31_workspace_notification_destination(
 '00000000-0000-0000-0000-000000003134','00000000-0000-0000-0000-000000003112')$$);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003102',true);
select pg_temp.nc31_assert(
 (public.nc31_workspace_notifications_read(
   '00000000-0000-0000-0000-000000003111','all',15,0)->>'total_count')::int=1,
 'same tenant colleague does not see first user private receipts');

reset role;
update public.organization_memberships set status='suspended'
 where organization_id='00000000-0000-0000-0000-000000003111'
   and user_id='00000000-0000-0000-0000-000000003102';
set local role authenticated;
select pg_temp.nc31_denied(
 $$select public.nc31_workspace_notifications_read(
 '00000000-0000-0000-0000-000000003111','all',15,0)$$);
select pg_temp.nc31_denied(
 $$select public.nc31_workspace_notification_set_state(
 '00000000-0000-0000-0000-000000003133','00000000-0000-0000-0000-000000003111','archive')$$);
reset role;
rollback;
