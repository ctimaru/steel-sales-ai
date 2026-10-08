-- NC2.1 — Segregated notification inbox acceptance.
-- CI-only synthetic fixture; all records are rolled back.
begin;

create or replace function pg_temp.nc21_assert(ok boolean, explanation text)
returns void language plpgsql as $fn$
begin
  if not coalesce(ok,false) then raise exception 'NC21: %',explanation; end if;
end;
$fn$;
create or replace function pg_temp.nc21_denied(sql_statement text, expected_fragment text)
returns void language plpgsql as $fn$
begin
  begin
    execute sql_statement;
  exception when others then
    if position(lower(expected_fragment) in lower(sqlerrm))=0 then
      raise exception 'NC21 unexpected error "%", expected "%"',sqlerrm,expected_fragment;
    end if;
    return;
  end;
  raise exception 'NC21 expected denial "%": %',expected_fragment,sql_statement;
end;
$fn$;

-- Non-destructive DDL / permission assertions.
select pg_temp.nc21_assert(
  (select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public'
     and c.relname in ('workspace_notification_events','workspace_notification_recipients',
                       'platform_notification_events','platform_notification_recipients')
     and c.relrowsecurity), 'RLS enabled on four physical inbox tables');
select pg_temp.nc21_assert(
  not has_table_privilege('anon','public.workspace_notification_events','SELECT')
  and not has_table_privilege('anon','public.platform_notification_events','SELECT')
  and not has_table_privilege('anon','public.workspace_notification_recipients','SELECT')
  and not has_table_privilege('anon','public.platform_notification_recipients','SELECT'),
  'anon denied all inbox tables');
select pg_temp.nc21_assert(
  not has_table_privilege('authenticated','public.workspace_notification_events','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.workspace_notification_recipients','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.platform_notification_events','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.platform_notification_recipients','INSERT,UPDATE,DELETE'),
  'client roles have no inbox write privileges');

insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000002101','nc21-a-admin@example.test'),
('00000000-0000-0000-0000-000000002102','nc21-a-member@example.test'),
('00000000-0000-0000-0000-000000002103','nc21-b-admin@example.test'),
('00000000-0000-0000-0000-000000002104','nc21-platform-staff@example.test');

insert into public.organizations(id,name,slug,created_by) values
('00000000-0000-0000-0000-000000002111','NC21 Tenant A','nc21-org-a',
 '00000000-0000-0000-0000-000000002101'),
('00000000-0000-0000-0000-000000002112','NC21 Tenant B','nc21-org-b',
 '00000000-0000-0000-0000-000000002103');

insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
('00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-000000002101','admin','active',true),
('00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-000000002102','member','active',true),
('00000000-0000-0000-0000-000000002112','00000000-0000-0000-0000-000000002103','admin','active',true);

-- Staff has ONLY registrations.review; it does not inherit Platform audit or tenant access.
insert into public.platform_staff(user_id,status)
values ('00000000-0000-0000-0000-000000002104','active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason) values
('00000000-0000-0000-0000-000000002104','registration_admin','active',
 '00000000-0000-0000-0000-000000002101','NC21 synthetic test');

insert into public.workspace_notification_events(
 id,organization_id,event_type,source_table,source_event_id,source_revision,priority,occurred_at
) values
('00000000-0000-0000-0000-000000002121','00000000-0000-0000-0000-000000002111',
 'workspace.import.failed','worker_jobs','nc21-job-a',1,'action_required',now()),
('00000000-0000-0000-0000-000000002122','00000000-0000-0000-0000-000000002112',
 'workspace.import.failed','worker_jobs','nc21-job-b',1,'action_required',now());

insert into public.platform_notification_events(
 id,event_type,source_table,source_event_id,source_revision,priority,required_permission_key,occurred_at
) values
('00000000-0000-0000-0000-000000002131','platform.registration.submitted',
 'platform_registration_events','nc21-app-a',1,'action_required','registrations.review',now()),
('00000000-0000-0000-0000-000000002132','platform.infrastructure.critical_incident',
 'observability_events','nc21-incident',1,'critical','platform.audit.read',now());

insert into public.workspace_notification_recipients(
 event_id,organization_id,recipient_user_id
) values
('00000000-0000-0000-0000-000000002121','00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-000000002101'),
('00000000-0000-0000-0000-000000002121','00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-000000002102'),
('00000000-0000-0000-0000-000000002122','00000000-0000-0000-0000-000000002112','00000000-0000-0000-0000-000000002103');

insert into public.platform_notification_recipients(
 event_id,required_permission_key,recipient_user_id
) values
('00000000-0000-0000-0000-000000002131','registrations.review','00000000-0000-0000-0000-000000002104'),
('00000000-0000-0000-0000-000000002132','platform.audit.read','00000000-0000-0000-0000-000000002104');

-- Composite FK protects tenant scope and platform permission association.
select pg_temp.nc21_denied(
 $$insert into public.workspace_notification_recipients(
     event_id,organization_id,recipient_user_id
   ) values (
     '00000000-0000-0000-0000-000000002121',
     '00000000-0000-0000-0000-000000002112',
     '00000000-0000-0000-0000-000000002103')$$,
 'foreign key');
select pg_temp.nc21_denied(
 $$insert into public.platform_notification_recipients(
     event_id,required_permission_key,recipient_user_id
   ) values (
     '00000000-0000-0000-0000-000000002131',
     'platform.audit.read','00000000-0000-0000-0000-000000002101')$$,
 'foreign key');
select pg_temp.nc21_denied(
 $$insert into public.workspace_notification_events(
     organization_id,event_type,source_table,source_event_id,source_revision,priority,occurred_at
   ) values (
     '00000000-0000-0000-0000-000000002111',
     'workspace.import.failed','worker_jobs','nc21-job-a',1,'action_required',now())$$,
 'unique');
select pg_temp.nc21_denied(
 $$insert into public.workspace_notification_recipients(
     event_id,organization_id,recipient_user_id
   ) values (
     '00000000-0000-0000-0000-000000002121',
     '00000000-0000-0000-0000-000000002111',
     '00000000-0000-0000-0000-000000002101')$$,
 'unique');

-- A valid successor revision is distinct; a personal archive requires read_at.
insert into public.workspace_notification_events(
 organization_id,event_type,source_table,source_event_id,source_revision,priority,occurred_at
) values (
 '00000000-0000-0000-0000-000000002111',
 'workspace.import.failed','worker_jobs','nc21-job-a',2,'action_required',now());
select pg_temp.nc21_assert(
 (select count(*)=2 from public.workspace_notification_events
  where organization_id='00000000-0000-0000-0000-000000002111'),
 'new source revision accepted');
select pg_temp.nc21_denied(
 $$update public.workspace_notification_recipients set archived_at=now()
   where recipient_user_id='00000000-0000-0000-0000-000000002101'$$,
 'check constraint');

-- Authenticated browsing: own assigned references only, strictly by active tenant.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002101',true);
select pg_temp.nc21_assert(
 (select count(*)=1 from public.workspace_notification_recipients),'A admin sees only own recipient');
select pg_temp.nc21_assert(
 (select count(*)=1 from public.workspace_notification_events),'A admin sees only assigned event');
select pg_temp.nc21_assert(
 (select count(*)=0 from public.platform_notification_recipients),'Org admin cannot read Platform mailbox');
select pg_temp.nc21_denied(
 $$update public.workspace_notification_recipients set read_at=now()$$,'permission denied');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002102',true);
select pg_temp.nc21_assert(
 (select count(*)=1 from public.workspace_notification_recipients),'A member sees one personal row');
select pg_temp.nc21_assert(
 (select count(*)=1 from public.workspace_notification_events),'A member sees own assigned event');

-- Membership revoked: even an existing recipient can no longer see the row.
reset role;
update public.organization_memberships set status='suspended'
where organization_id='00000000-0000-0000-0000-000000002111'
  and user_id='00000000-0000-0000-0000-000000002102';
set local role authenticated;
select pg_temp.nc21_assert(
 (select count(*)=0 from public.workspace_notification_events),'suspended member cannot see event');
select pg_temp.nc21_assert(
 (select count(*)=0 from public.workspace_notification_recipients),'suspended member cannot see recipient');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002103',true);
select pg_temp.nc21_assert(
 (select count(*)=1 from public.workspace_notification_events),'B admin sees B only');
select pg_temp.nc21_assert(
 (select count(*)=1 from public.workspace_notification_recipients),'B admin sees B recipient only');

-- Staff registration permission opens registration event but not incident or tenant.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002104',true);
select pg_temp.nc21_assert(public.has_platform_permission('registrations.review'),
 'staff registration reviewer permission active');
select pg_temp.nc21_assert(not public.has_platform_permission('platform.audit.read'),
 'registration reviewer is not incident auditor');
select pg_temp.nc21_assert(
 (select count(*)=1 from public.platform_notification_events),'staff sees only registration event');
select pg_temp.nc21_assert(
 (select count(*)=1 from public.platform_notification_recipients),'staff sees only authorized recipient');
select pg_temp.nc21_assert(
 (select count(*)=0 from public.workspace_notification_events),'Platform role cannot read tenant data');
select pg_temp.nc21_denied(
 $$delete from public.platform_notification_recipients$$,'permission denied');

reset role;
update public.platform_staff set status='suspended',suspended_at=now()
where user_id='00000000-0000-0000-0000-000000002104';
set local role authenticated;
select pg_temp.nc21_assert(
 (select count(*)=0 from public.platform_notification_events),'suspended Platform staff cannot read event');
select pg_temp.nc21_assert(
 (select count(*)=0 from public.platform_notification_recipients),'suspended Platform staff cannot read recipient');

reset role;
rollback;
