-- NC5.1 — integrated adversarial acceptance of Workspace vs Platform identities.
-- Synthetic principals and notifications exist only inside a ROLLBACK transaction.
-- Run AFTER all NC2.1..NC3.3 source and RLS tests in the Required Gate.
begin;
create or replace function pg_temp.nc51_assert(ok boolean,why text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NC51 failure: %',why; end if; end;
$$;
create or replace function pg_temp.nc51_denied(statement text)
returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
   if sqlstate='42501' then return; end if;
   raise exception 'NC51 unexpected SQLSTATE % on %',sqlstate,statement;
 end;
 raise exception 'NC51 unexpectedly allowed %',statement;
end;
$$;

-- Workspace member A, foreign customer B, and Platform-only reviewer P.
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000005101','nc51-org-a@example.test'),
('00000000-0000-0000-0000-000000005102','nc51-org-b@example.test'),
('00000000-0000-0000-0000-000000005103','nc51-platform@example.test');
insert into public.organizations(id,name,slug,created_by) values
('00000000-0000-0000-0000-000000005111','NC51 Org A','nc51-org-a','00000000-0000-0000-0000-000000005101'),
('00000000-0000-0000-0000-000000005112','NC51 Org B','nc51-org-b','00000000-0000-0000-0000-000000005102');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
('00000000-0000-0000-0000-000000005111','00000000-0000-0000-0000-000000005101','admin','active',true),
('00000000-0000-0000-0000-000000005112','00000000-0000-0000-0000-000000005102','admin','active',true);
insert into public.platform_staff(user_id,status) values
('00000000-0000-0000-0000-000000005103','active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by) values
('00000000-0000-0000-0000-000000005103','registration_admin','active','00000000-0000-0000-0000-000000005103');

insert into public.workspace_notification_events(id,organization_id,event_type,
 source_table,source_event_id,source_revision,priority,occurred_at) values
('00000000-0000-0000-0000-000000005121','00000000-0000-0000-0000-000000005111',
 'workspace.import.failed','worker_jobs','00000000-0000-0000-0000-000000005141',1,'action_required',now()),
('00000000-0000-0000-0000-000000005122','00000000-0000-0000-0000-000000005112',
 'workspace.import.failed','worker_jobs','00000000-0000-0000-0000-000000005142',1,'action_required',now());
insert into public.workspace_notification_recipients(id,event_id,organization_id,recipient_user_id) values
('00000000-0000-0000-0000-000000005131','00000000-0000-0000-0000-000000005121','00000000-0000-0000-0000-000000005111','00000000-0000-0000-0000-000000005101'),
('00000000-0000-0000-0000-000000005132','00000000-0000-0000-0000-000000005122','00000000-0000-0000-0000-000000005112','00000000-0000-0000-0000-000000005102');
insert into public.platform_notification_events(id,event_type,source_table,source_event_id,
 source_revision,priority,required_permission_key,occurred_at) values
('00000000-0000-0000-0000-000000005123','platform.registration.submitted',
 'platform_registration_events','00000000-0000-0000-0000-000000005143',1,'action_required','registrations.review',now());
insert into public.platform_notification_recipients(id,event_id,required_permission_key,recipient_user_id) values
('00000000-0000-0000-0000-000000005133','00000000-0000-0000-0000-000000005123',
 'registrations.review','00000000-0000-0000-0000-000000005103');

-- Browser grants, source/outbox privacy and protected replication publication.
select pg_temp.nc51_assert(
 not has_function_privilege('authenticated','public.nc22_route_notification(text,text,integer,uuid)','EXECUTE')
 and not has_function_privilege('authenticated','public.nc23_process_source_bridge_batch(integer)','EXECUTE'),
 'browser cannot use service notification producer');
select pg_temp.nc51_assert(
 not has_table_privilege('authenticated','public.notification_source_bridge_queue','SELECT')
 and not has_table_privilege('authenticated','public.workspace_notification_outbox','SELECT')
 and not has_table_privilege('authenticated','public.platform_notification_outbox','SELECT')
 and not has_table_privilege('authenticated','public.workspace_notification_recipients','UPDATE')
 and not has_table_privilege('authenticated','public.platform_notification_recipients','UPDATE'),
 'outbox and queue inaccessible; recipient DML through constrained RPC only');
select pg_temp.nc51_assert(
 (select count(*)=2 from pg_publication_tables where pubname='supabase_realtime'
    and tablename in ('workspace_notification_recipients','platform_notification_recipients'))
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and tablename in ('workspace_notification_events','platform_notification_events',
      'workspace_notification_outbox','platform_notification_outbox',
      'notification_source_bridge_queue')),
 'Realtime emits recipient invalidations, not source/outbox data');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005101',true);
select pg_temp.nc51_assert(
 (select count(*)=1 from public.workspace_notification_recipients)
 and (select count(*)=0 from public.platform_notification_recipients)
 and (public.nc31_workspace_notifications_read(
   '00000000-0000-0000-0000-000000005111','all',5,0)->>'unread_count')::int=1,
 'tenant A sees only own Workspace notification; never Platform');
select pg_temp.nc51_denied(
 $$select public.nc31_workspace_notifications_read('00000000-0000-0000-0000-000000005112','all',5,0)$$);
select pg_temp.nc51_denied(
 $$select public.nc32_platform_notifications_read('all',5,0)$$);
select pg_temp.nc51_denied(
 $$select public.nc31_workspace_notification_set_state(
 '00000000-0000-0000-0000-000000005132','00000000-0000-0000-0000-000000005112','read')$$);
select pg_temp.nc51_assert(
 (public.nc31_workspace_notification_set_state(
 '00000000-0000-0000-0000-000000005131','00000000-0000-0000-0000-000000005111','read')->>'ok')='true',
 'own personal mark-read is allowed');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005103',true);
select pg_temp.nc51_assert(
 (select count(*)=1 from public.platform_notification_recipients)
 and (select count(*)=0 from public.workspace_notification_recipients)
 and (public.nc32_platform_notifications_read('all',5,0)->>'total_count')::int=1,
 'Platform reviewer sees own governance event, not commercial Workspace');
select pg_temp.nc51_denied(
 $$select public.nc31_workspace_notifications_read('00000000-0000-0000-0000-000000005111','all',5,0)$$);
select pg_temp.nc51_denied(
 $$select public.nc31_workspace_notification_set_state(
 '00000000-0000-0000-0000-000000005131','00000000-0000-0000-0000-000000005111','archive')$$);

-- Role revocation must immediately deny both read and mutation, even when
-- a recipient row remains assigned to the former reviewer.
reset role;
update public.platform_staff_roles set status='revoked',
 revoked_by='00000000-0000-0000-0000-000000005103',revoked_at=now()
 where user_id='00000000-0000-0000-0000-000000005103';
set local role authenticated;
select pg_temp.nc51_denied($$select public.nc32_platform_notifications_read('all',5,0)$$);
select pg_temp.nc51_denied(
 $$select public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000005133','archive')$$);
select pg_temp.nc51_denied(
 $$select public.nc32_platform_notification_destination('00000000-0000-0000-0000-000000005133')$$);

-- Organizational revocation must equally deny the old Workspace receipt.
reset role;
update public.organization_memberships set status='suspended'
 where user_id='00000000-0000-0000-0000-000000005101'
   and organization_id='00000000-0000-0000-0000-000000005111';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005101',true);
select pg_temp.nc51_denied(
 $$select public.nc31_workspace_notifications_read('00000000-0000-0000-0000-000000005111','all',5,0)$$);
select pg_temp.nc51_denied(
 $$select public.nc31_workspace_notification_set_state(
 '00000000-0000-0000-0000-000000005131','00000000-0000-0000-0000-000000005111','read')$$);
reset role;
rollback;
