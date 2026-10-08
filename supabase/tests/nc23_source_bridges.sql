-- NC2.3: source bridge acceptance, transaction rolled back without test residue.
begin;
create or replace function pg_temp.nc23_assert(ok boolean,why text) returns void
language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'NC23: %',why; end if;
end;
$$;
create or replace function pg_temp.nc23_deny(query text,expected text) returns void
language plpgsql as $$
begin
 begin
   execute query;
 exception when others then
   if position(lower(expected) in lower(sqlerrm))>0 then return; end if;
   raise exception 'NC23 unexpected error %, expected %',sqlerrm,expected;
 end;
 raise exception 'NC23 expected rejection %',expected;
end;
$$;
-- Verify the capture/processor are inaccessible to regular client sessions.
select pg_temp.nc23_assert(
 not has_function_privilege('anon','public.nc23_process_source_bridge_batch(integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.nc23_process_source_bridge_batch(integer)','EXECUTE')
 and has_function_privilege('service_role','public.nc23_process_source_bridge_batch(integer)','EXECUTE'),
 'bridge worker is service-only');
select pg_temp.nc23_assert(
 not has_table_privilege('authenticated','public.notification_source_bridge_queue','SELECT')
 and not has_table_privilege('authenticated','public.notification_source_bridge_queue','INSERT')
 and (select relrowsecurity from pg_class where oid='public.notification_source_bridge_queue'::regclass),
 'capture queue private with RLS');
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000002201','nc22-admin-a@example.test'),
('00000000-0000-0000-0000-000000002202','nc22-member-a@example.test'),
('00000000-0000-0000-0000-000000002203','nc22-admin-b@example.test'),
('00000000-0000-0000-0000-000000002204','nc22-registration-staff@example.test'),
('00000000-0000-0000-0000-000000002205','nc22-audit-staff@example.test');

insert into public.organizations(id,name,slug,created_by) values
('00000000-0000-0000-0000-000000002211','NC22 Org A','nc22-org-a','00000000-0000-0000-0000-000000002201'),
('00000000-0000-0000-0000-000000002212','NC22 Org B','nc22-org-b','00000000-0000-0000-0000-000000002203');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
('00000000-0000-0000-0000-000000002211','00000000-0000-0000-0000-000000002201','admin','active',true),
('00000000-0000-0000-0000-000000002211','00000000-0000-0000-0000-000000002202','member','active',true),
('00000000-0000-0000-0000-000000002212','00000000-0000-0000-0000-000000002203','admin','active',true);
insert into public.platform_staff(user_id,status) values
('00000000-0000-0000-0000-000000002204','active'),
('00000000-0000-0000-0000-000000002205','active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by) values
('00000000-0000-0000-0000-000000002204','registration_admin','active','00000000-0000-0000-0000-000000002201'),
('00000000-0000-0000-0000-000000002205','platform_auditor','active','00000000-0000-0000-0000-000000002201');

insert into public.observability_events(id,trace_id,event_type,operation,status,organization_id)
values
('00000000-0000-0000-0000-000000002221','00000000-0000-0000-0000-000000002231','system','nc22_tenant_health','ok','00000000-0000-0000-0000-000000002211');
insert into public.observability_events(id,trace_id,event_type,operation,status,organization_id,owner_id)
values
('00000000-0000-0000-0000-000000002222','00000000-0000-0000-0000-000000002232','system','infrastructure_critical','error',null,null);

insert into public.operational_alerts(
 id,organization_id,source_event_id,alert_key,alert_type,severity,status,
 title,summary,first_seen_at,last_seen_at,occurrence_count
) values
(9222,'00000000-0000-0000-0000-000000002211','00000000-0000-0000-0000-000000002221',
'nc22-alert-a','nc22_test','critical','open','NC22 fixture','synthetic',now(),now(),1);

insert into public.worker_jobs(
 id,filename,extension,size_bytes,status,completed_at,owner_id,organization_id,attempt_number
) values
('00000000-0000-0000-0000-000000002223','nc22-failed.eml','eml',12,'failed',now(),
'00000000-0000-0000-0000-000000002202','00000000-0000-0000-0000-000000002211',1);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002203',true);
insert into public.company_registration_applications(
 id,applicant_email_snapshot,legal_name,country_code,primary_company_type,
 contact_name,application_status,applicant_user_id,submitted_at,email_verified_at
) values (
 '00000000-0000-0000-0000-000000002224','nc22-applicant@example.test',
 'NC22 Test Steel Italia','IT','trader_distributor','NC22 Applicant','pending_review',
 '00000000-0000-0000-0000-000000002203',now(),now()
);
insert into public.platform_registration_events(
 id,application_id,event_type,actor_user_id,actor_type,from_status,to_status
) values (
 '00000000-0000-0000-0000-000000002225','00000000-0000-0000-0000-000000002224',
 'application_submitted','00000000-0000-0000-0000-000000002203','applicant','draft','pending_review'
);


-- RFQ source labels verified against actual source-writing database functions.
insert into public.buyer_rfq_campaigns(id,owner_user_id,organization_id,title)
 values('00000000-0000-0000-0000-000000002241',
   '00000000-0000-0000-0000-000000002201',
   '00000000-0000-0000-0000-000000002211','NC23 Synthetic Campaign');
insert into public.buyer_rfq_team_members(rfq_id,user_id,organization_id,role,status,added_by)
 values('00000000-0000-0000-0000-000000002241',
   '00000000-0000-0000-0000-000000002202',
   '00000000-0000-0000-0000-000000002211','collaborator','active',
   '00000000-0000-0000-0000-000000002201');
insert into public.buyer_rfq_events(id,rfq_id,owner_user_id,organization_id,event_type)
 values
 ('00000000-0000-0000-0000-000000002242','00000000-0000-0000-0000-000000002241',
 '00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002211',
 'quote_submitted'),
 ('00000000-0000-0000-0000-000000002243','00000000-0000-0000-0000-000000002241',
 '00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002211',
 'rfq_award_confirmed');

select pg_temp.nc23_assert(
 (select count(*)=6 from public.notification_source_bridge_queue where status='pending'),
 'six source events automatically captured; unrelated RFQ campaign-created suppressed');
select pg_temp.nc23_assert(
 (select count(*)=0 from public.workspace_notification_events)
 and (select count(*)=0 from public.platform_notification_events),
 'source capture does not synchronously modify inbox');

-- No browser can invoke the worker, despite being able to create a legitimate RFQ.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.nc23_deny(
 $$select public.nc23_process_source_bridge_batch(10)$$,
 'permission denied');
reset role;

-- A scheduled service-role worker projects all eligible source references.
set local role service_role;
select pg_temp.nc23_assert(
 (public.nc23_process_source_bridge_batch(50)->>'projected')::integer=6,
 'six verified sources projected');
select pg_temp.nc23_assert(
 (public.nc23_process_source_bridge_batch(50)->>'processed')::integer=0,
 'idempotent subsequent poll is empty');
select pg_temp.nc23_assert(
 (select count(*)=6 from public.notification_source_bridge_queue where status='projected')
 and (select count(*)=0 from public.notification_source_bridge_queue where status<>'projected'),
 'queue transitions complete without source errors');
select pg_temp.nc23_assert(
 (select count(*)=4 from public.workspace_notification_events)
 and (select count(*)=7 from public.workspace_notification_recipients)
 and (select count(*)=7 from public.workspace_notification_outbox),
 'RFQ quote and award, alert and import projected to authorized tenant recipients');
select pg_temp.nc23_assert(
 (select count(*)=2 from public.platform_notification_events)
 and (select count(*)=2 from public.platform_notification_recipients)
 and (select count(*)=2 from public.platform_notification_outbox),
 'separate Platform registration and incident inbox');
select pg_temp.nc23_assert(
 (select count(*)=0 from public.workspace_notification_outbox where channel='email')
 and (select count(*)=0 from public.platform_notification_outbox where channel='email'),
 'no SMTP, email or push enqueued');
reset role;

-- Personal recipients and Platform rights must still be checked by NC2.1 RLS.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002202',true);
select pg_temp.nc23_assert(
 (select count(*)=3 from public.workspace_notification_events)
 and (select count(*)=0 from public.platform_notification_events),
 'RFQ team member + import owner can read only assigned Workspace notifications');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002203',true);
select pg_temp.nc23_assert(
 (select count(*)=0 from public.workspace_notification_events)
 and (select count(*)=0 from public.platform_notification_events),
 'foreign company does not see Workspace or Platform');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002204',true);
select pg_temp.nc23_assert(
 (select count(*)=1 from public.platform_notification_events)
 and (select count(*)=0 from public.workspace_notification_events),
 'registration staff sees only registration notification');
reset role;
rollback;
