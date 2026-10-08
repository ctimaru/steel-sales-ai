-- NC2.2 acceptance: all source fixtures and deliveries are rolled back.
begin;
create or replace function pg_temp.nc22_assert(ok boolean,reason text) returns void
language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'NC22: %',reason; end if;
end;
$$;
create or replace function pg_temp.nc22_expect_error(statement text,fragment text) returns void
language plpgsql as $$
begin
 begin
   execute statement;
 exception when others then
   if position(lower(fragment) in lower(sqlerrm))=0 then
     raise exception 'NC22 unexpected error "%", wanted "%"',sqlerrm,fragment;
   end if;
   return;
 end;
 raise exception 'NC22 expected failure "%", call succeeded',fragment;
end;
$$;

select pg_temp.nc22_assert(
 not has_function_privilege('anon','public.nc22_route_notification(text,text,integer,uuid)','execute')
 and not has_function_privilege('authenticated','public.nc22_route_notification(text,text,integer,uuid)','execute')
 and has_function_privilege('service_role','public.nc22_route_notification(text,text,integer,uuid)','execute'),
 'router execution service_role only');
select pg_temp.nc22_assert(
 (select count(*)=2 from pg_class c where c.oid in
 ('public.workspace_notification_outbox'::regclass,'public.platform_notification_outbox'::regclass)
 and c.relrowsecurity),'both outbox tables use RLS');
select pg_temp.nc22_assert(
 not has_table_privilege('authenticated','public.workspace_notification_outbox','SELECT')
 and not has_table_privilege('authenticated','public.platform_notification_outbox','SELECT')
 and not has_table_privilege('authenticated','public.workspace_notification_outbox','INSERT')
 and not has_table_privilege('authenticated','public.platform_notification_outbox','INSERT'),
 'outbox has no browser grants');

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

-- The public router is NOT an authenticated-user endpoint.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002201',true);
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('workspace.operations.regression_detected','9222',1,
 '00000000-0000-0000-0000-000000002211')$$,
 'permission denied');
reset role;

-- Service backend routes after verifying source and resolving its own recipients.
set local role service_role;
select pg_temp.nc22_assert(
 (public.nc22_route_notification('workspace.operations.regression_detected','9222',1,
 '00000000-0000-0000-0000-000000002211')->>'recipient_count')::integer=1,
 'critical tenant alert only to active company admins');
select pg_temp.nc22_assert(
 (public.nc22_route_notification('workspace.operations.regression_detected','9222',1,
 '00000000-0000-0000-0000-000000002211')->>'created')='false',
 'replay identical key does not project second inbox event');
select pg_temp.nc22_assert(
 (public.nc22_route_notification('workspace.import.failed','00000000-0000-0000-0000-000000002223',1,
 '00000000-0000-0000-0000-000000002211')->>'recipient_count')::integer=2,
 'failed import goes to owner and active company admin');
select pg_temp.nc22_assert(
 (public.nc22_route_notification('platform.registration.submitted','00000000-0000-0000-0000-000000002225',1,null)
 ->>'recipient_count')::integer=1,
 'submitted application goes only to registration reviewer');
select pg_temp.nc22_assert(
 (public.nc22_route_notification('platform.infrastructure.critical_incident','00000000-0000-0000-0000-000000002222',1,null)
 ->>'recipient_count')::integer=1,
 'critical infrastructure incident only to Platform auditor');

select pg_temp.nc22_assert(
 (select count(*)=2 from public.workspace_notification_events)
 and (select count(*)=3 from public.workspace_notification_recipients)
 and (select count(*)=3 from public.workspace_notification_outbox),
 'workspace atomic events recipients and in-app outbox');
select pg_temp.nc22_assert(
 (select count(*)=2 from public.platform_notification_events)
 and (select count(*)=2 from public.platform_notification_recipients)
 and (select count(*)=2 from public.platform_notification_outbox),
 'Platform atomic events recipients and in-app outbox');
select pg_temp.nc22_assert(
 (select count(*)=0 from public.workspace_notification_outbox where channel='email')
 and (select count(*)=0 from public.platform_notification_outbox where channel='email')
 and (select count(*)=5 from (
   select delivered_at from public.workspace_notification_outbox where channel='in_app' and status='delivered'
   union all
   select delivered_at from public.platform_notification_outbox where channel='in_app' and status='delivered'
 ) d),
 'no email was enqueued and all in-app deliveries are recorded');

select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('workspace.operations.regression_detected','9222',1,
 '00000000-0000-0000-0000-000000002212')$$,
 'source unavailable');
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('workspace.operations.regression_detected','9222',2,
 '00000000-0000-0000-0000-000000002211')$$,
 'source unavailable');
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('workspace.rfq.response_received','00000000-0000-0000-0000-000000002225',1,
 '00000000-0000-0000-0000-000000002211')$$,
 'RFQ source bridge not yet approved');
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('platform.registration.submitted','00000000-0000-0000-0000-000000002225',1,
 '00000000-0000-0000-0000-000000002211')$$,
 'notification scope boundary rejected');
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('workspace.import.failed','00000000-0000-0000-0000-000000002223',1,null)$$,
 'notification scope boundary rejected');
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('platform.claim.requested','00000000-0000-0000-0000-000000002224',1,null)$$,
 'source unavailable');
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('platform.infrastructure.critical_incident','00000000-0000-0000-0000-000000002221',1,null)$$,
 'source unavailable');
select pg_temp.nc22_expect_error(
 $$select public.nc22_route_notification('workspace.import.failed','00000000-0000-0000-0000-000000002223',2,
 '00000000-0000-0000-0000-000000002211')$$,
 'source unavailable');
select pg_temp.nc22_assert(
 (public.nc22_route_notification('workspace.import.failed','00000000-0000-0000-0000-000000002223',1,
 '00000000-0000-0000-0000-000000002211')->>'created')='false',
 'successful replay yields deduplicated, not a second event');

-- Browser reads remain strictly separate after service-side projection.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002202',true);
select pg_temp.nc22_assert(
 (select count(*)=1 from public.workspace_notification_events) and
 (select count(*)=1 from public.workspace_notification_recipients) and
 (select count(*)=0 from public.platform_notification_events),
 'import owner sees their notification but not Platform or unassigned alerts');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002203',true);
select pg_temp.nc22_assert(
 (select count(*)=0 from public.workspace_notification_events)
 and (select count(*)=0 from public.platform_notification_events),
 'tenant B cannot read tenant A or Platform content');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002204',true);
select pg_temp.nc22_assert(
 (select count(*)=1 from public.platform_notification_events)
 and (select count(*)=0 from public.workspace_notification_events),
 'registration staff gets only registration inbox');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002205',true);
select pg_temp.nc22_assert(
 (select count(*)=1 from public.platform_notification_events)
 and (select count(*)=0 from public.workspace_notification_events),
 'Platform auditor gets incident only');
reset role;
rollback;
