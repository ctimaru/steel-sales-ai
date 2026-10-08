-- NC3.2: synthetic Platform-only inbox acceptance; all DML rolled back.
begin;
create or replace function pg_temp.nc32_assert(ok boolean, why text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NC32: %',why; end if; end;
$$;
create or replace function pg_temp.nc32_deny(query text)
returns void language plpgsql as $$
begin
 begin execute query;
 exception when others then
  if sqlstate='42501' then return; end if;
  raise exception 'NC32 unexpected SQLSTATE %, %',sqlstate,sqlerrm;
 end;
 raise exception 'NC32 missing rejection %',query;
end;
$$;
select pg_temp.nc32_assert(
 has_function_privilege('authenticated','public.nc32_platform_notifications_read(text,integer,integer)','EXECUTE')
 and has_function_privilege('authenticated','public.nc32_platform_notification_set_state(uuid,text)','EXECUTE')
 and has_function_privilege('authenticated','public.nc32_platform_notification_destination(uuid)','EXECUTE')
 and not has_function_privilege('anon','public.nc32_platform_notifications_read(text,integer,integer)','EXECUTE')
 and not has_function_privilege('anon','public.nc32_platform_notification_set_state(uuid,text)','EXECUTE')
 and not has_function_privilege('anon','public.nc32_platform_notification_destination(uuid)','EXECUTE'),
 'all three Platform RPCs are authenticated-only');
select pg_temp.nc32_assert(
 not has_table_privilege('authenticated','public.platform_notification_recipients','UPDATE')
 and not has_table_privilege('authenticated','public.platform_notification_events','UPDATE'),
 'no direct browser DML rights');

insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000003201','nc32-registration@example.test'),
('00000000-0000-0000-0000-000000003202','nc32-audit@example.test'),
('00000000-0000-0000-0000-000000003203','nc32-foreign@example.test'),
('00000000-0000-0000-0000-000000003204','nc32-registration-colleague@example.test');

insert into public.platform_staff(user_id,status) values
('00000000-0000-0000-0000-000000003201','active'),
('00000000-0000-0000-0000-000000003202','active'),
('00000000-0000-0000-0000-000000003204','active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by) values
('00000000-0000-0000-0000-000000003201','registration_admin','active','00000000-0000-0000-0000-000000003201'),
('00000000-0000-0000-0000-000000003202','platform_auditor','active','00000000-0000-0000-0000-000000003201'),
('00000000-0000-0000-0000-000000003204','registration_admin','active','00000000-0000-0000-0000-000000003201');

insert into public.organizations(id,name,slug,created_by) values
('00000000-0000-0000-0000-000000003211','NC32 Customer','nc32-company','00000000-0000-0000-0000-000000003203');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
('00000000-0000-0000-0000-000000003211','00000000-0000-0000-0000-000000003203','admin','active',true);

insert into public.platform_notification_events(id,event_type,source_table,source_event_id,priority,source_revision,required_permission_key,occurred_at)
values
('00000000-0000-0000-0000-000000003221','platform.registration.submitted','platform_registration_events','00000000-0000-0000-0000-000000003241','action_required',1,'registrations.review',now()),
('00000000-0000-0000-0000-000000003222','platform.claim.requested','network_company_claims','00000000-0000-0000-0000-000000003242','action_required',1,'claims.read',now()),
('00000000-0000-0000-0000-000000003223','platform.infrastructure.critical_incident','observability_events','00000000-0000-0000-0000-000000003243','critical',1,'platform.audit.read',now());
insert into public.platform_notification_recipients(id,event_id,required_permission_key,recipient_user_id) values
('00000000-0000-0000-0000-000000003231','00000000-0000-0000-0000-000000003221','registrations.review','00000000-0000-0000-0000-000000003201'),
('00000000-0000-0000-0000-000000003232','00000000-0000-0000-0000-000000003222','claims.read','00000000-0000-0000-0000-000000003202'),
('00000000-0000-0000-0000-000000003233','00000000-0000-0000-0000-000000003223','platform.audit.read','00000000-0000-0000-0000-000000003202');

-- The foreign company cannot read anything, even with an active org admin role.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003203',true);
select pg_temp.nc32_deny($$select public.nc32_platform_notifications_read('all',15,0)$$);
select pg_temp.nc32_deny($$select public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003231','read')$$);
select pg_temp.nc32_deny($$select public.nc32_platform_notification_destination('00000000-0000-0000-0000-000000003231')$$);

-- The registration reviewer sees only own assigned registration, no incident.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003201',true);
select pg_temp.nc32_assert(
 (public.nc32_platform_notifications_read('all',15,0)->>'unread_count')::int=1,
 'registration reviewer sees one assigned notification');
select pg_temp.nc32_assert(
 (public.nc32_platform_notifications_read('registrations',15,0)->>'filtered_count')::int=1
 and (public.nc32_platform_notifications_read('incidents',15,0)->>'filtered_count')::int=0,
 'event-category and current permission filters');
select pg_temp.nc32_assert(
 (public.nc32_platform_notifications_read('all',1,0)->>'limit')::int=1,
 'pagination limit enforced');
select pg_temp.nc32_assert(
 (public.nc32_platform_notification_destination('00000000-0000-0000-0000-000000003231')->>'type')='unavailable',
 'broken source reference reveals no registration ID');
select pg_temp.nc32_assert(
 (public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003231','read')->>'ok')='true',
 'mark own row read');
select pg_temp.nc32_assert(
 (public.nc32_platform_notifications_read('unread',15,0)->>'filtered_count')::int=0,
 'personal unread reduces');
select pg_temp.nc32_assert(
 (public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003231','archive')->>'ok')='true',
 'archive own row');
select pg_temp.nc32_assert(
 (public.nc32_platform_notifications_read('archived',15,0)->>'filtered_count')::int=1,
 'archived filter works');
select pg_temp.nc32_assert(
 (public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003231','restore')->>'ok')='true'
 and (public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003231','unread')->>'ok')='true',
 'restore and mark unread');
select pg_temp.nc32_deny($$select public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003233','read')$$);
select pg_temp.nc32_deny($$select public.nc32_platform_notification_destination('00000000-0000-0000-0000-000000003233')$$);
select pg_temp.nc32_assert(
 (select count(*)=0 from public.workspace_notification_recipients),
 'no Workspace receipt created');

-- Another registration admin does not inherit a colleague's notifications.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003204',true);
select pg_temp.nc32_assert(
 (public.nc32_platform_notifications_read('all',15,0)->>'total_count')::int=0,
 'same Platform permission is not equivalent to recipient ownership');
select pg_temp.nc32_deny($$select public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003231','read')$$);

-- Auditors see their assigned claim + incident only, not a registration.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003202',true);
select pg_temp.nc32_assert(
 (public.nc32_platform_notifications_read('all',15,0)->>'total_count')::int=2
 and (public.nc32_platform_notifications_read('incidents',15,0)->>'filtered_count')::int=1
 and (public.nc32_platform_notifications_read('claims',15,0)->>'filtered_count')::int=1,
 'auditor sees assigned claims and incidents');

-- Revocation immediately removes grants, even when personal receipt persists.
reset role;
update public.platform_staff_roles set status='revoked' where user_id='00000000-0000-0000-0000-000000003202';
set local role authenticated;
select pg_temp.nc32_deny($$select public.nc32_platform_notifications_read('all',15,0)$$);
select pg_temp.nc32_deny($$select public.nc32_platform_notification_set_state('00000000-0000-0000-0000-000000003233','read')$$);
select pg_temp.nc32_deny($$select public.nc32_platform_notification_destination('00000000-0000-0000-0000-000000003233')$$);
reset role;
rollback;
