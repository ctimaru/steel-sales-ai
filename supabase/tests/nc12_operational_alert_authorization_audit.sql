-- NC1.2 — Authorized alert transitions + immutable audit acceptance.
-- Disposable synthetic records; the complete transaction is rolled back.
begin;
create or replace function pg_temp.nc12_assert(ok boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'NC12: %',msg; end if;
end;
$$;
create or replace function pg_temp.nc12_expect_error(statement text, expected text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected in sqlerrm)=0 then
      raise exception 'NC12 unexpected error %, wanted %',sqlerrm,expected;
    end if;
    return;
  end;
  raise exception 'NC12 expected denial % but succeeded',expected;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000c1201','nc12-admin@test.example'),
('00000000-0000-0000-0000-0000000c1202','nc12-member@test.example'),
('00000000-0000-0000-0000-0000000c1203','nc12-viewer@test.example'),
('00000000-0000-0000-0000-0000000c1204','nc12-foreign-admin@test.example');
insert into public.organizations(id,name,slug) values
('00000000-0000-0000-0000-0000000c1211','NC12 Org A','nc12-fixture-org-a'),
('00000000-0000-0000-0000-0000000c1212','NC12 Org B','nc12-fixture-org-b');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
('00000000-0000-0000-0000-0000000c1211','00000000-0000-0000-0000-0000000c1201','admin','active',true),
('00000000-0000-0000-0000-0000000c1211','00000000-0000-0000-0000-0000000c1202','member','active',true),
('00000000-0000-0000-0000-0000000c1211','00000000-0000-0000-0000-0000000c1203','viewer','active',true),
('00000000-0000-0000-0000-0000000c1212','00000000-0000-0000-0000-0000000c1204','admin','active',true);
insert into public.observability_events(id,trace_id,event_type,operation,status,organization_id)
values (
  '00000000-0000-0000-0000-0000000c1221',
  '00000000-0000-0000-0000-0000000c1222',
  'system','nc12_rbac','ok',
  '00000000-0000-0000-0000-0000000c1211'
);
insert into public.operational_alerts(
 id,organization_id,source_event_id,alert_key,alert_type,severity,status,
 title,summary,first_seen_at,last_seen_at
) values (
  912012,'00000000-0000-0000-0000-0000000c1211',
  '00000000-0000-0000-0000-0000000c1221',
  'nc12-ci-fixture','nc12_test','warning','open',
  'NC12 fixture','No real tenant data',now(),now()
);

-- Member and viewer can read their own organization, but cannot mutate alerts.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000c1202',true);
set local role authenticated;
select pg_temp.nc12_assert(
  (select count(*)=1 from public.p1_operational_alerts_read('00000000-0000-0000-0000-0000000c1211',null,20,0)),
  'member may read tenant alerts'
);
select pg_temp.nc12_expect_error(
  $$select public.p1_acknowledge_operational_alert(912012,null)$$,
  'insufficient privileges'
);
select pg_temp.nc12_expect_error(
  $$select public.p1_resolve_operational_alert(912012,'note')$$,
  'insufficient privileges'
);
select pg_temp.nc12_expect_error(
  $$select * from public.p1_operational_alert_audit_read('00000000-0000-0000-0000-0000000c1211',null,100,0)$$,
  'admin required'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000c1203',true);
select pg_temp.nc12_assert(
  (select count(*)=1 from public.p1_operational_alerts_read('00000000-0000-0000-0000-0000000c1211',null,20,0)),
  'viewer may read tenant alerts'
);
select pg_temp.nc12_expect_error(
  $$select public.p1_acknowledge_operational_alert(912012,null)$$,
  'insufficient privileges'
);

-- Foreign tenant admin cannot see or change org A alerts, even with guessed ID.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000c1204',true);
select pg_temp.nc12_expect_error(
  $$select * from public.p1_operational_alerts_read('00000000-0000-0000-0000-0000000c1211',null,20,0)$$,
  'membership required'
);
select pg_temp.nc12_expect_error(
  $$select public.p1_resolve_operational_alert(912012,'wrong org')$$,
  'insufficient privileges'
);
select pg_temp.nc12_expect_error(
  $$select * from public.p1_operational_alert_audit_read('00000000-0000-0000-0000-0000000c1211',null,100,0)$$,
  'admin required'
);

-- Tenant A admin transitions once; repeated actions are idempotent and not double-audited.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000c1201',true);
select pg_temp.nc12_assert(
  (public.p1_acknowledge_operational_alert(912012,null)->>'status')='acknowledged',
  'admin acknowledge'
);
select pg_temp.nc12_assert(
  (public.p1_acknowledge_operational_alert(912012,null)->>'status')='acknowledged',
  'repeat acknowledge idempotent'
);
select pg_temp.nc12_assert(
  (select count(*)=1 from public.p1_operational_alert_audit_read('00000000-0000-0000-0000-0000000c1211',912012,100,0)),
  'one acknowledgment ledger entry'
);
select pg_temp.nc12_assert(
  (public.p1_resolve_operational_alert(912012,'resolved by tenant admin')->>'status')='resolved',
  'admin resolve'
);
select pg_temp.nc12_assert(
  (public.p1_resolve_operational_alert(912012,'resolved by tenant admin')->>'status')='resolved',
  'repeat resolve idempotent'
);
select pg_temp.nc12_assert(
  (select count(*)=2 from public.p1_operational_alert_audit_read('00000000-0000-0000-0000-0000000c1211',912012,100,0)),
  'exactly two append-only entries'
);
select pg_temp.nc12_assert(
  (select bool_and(actor_user_id='00000000-0000-0000-0000-0000000c1201'::uuid)
   from public.p1_operational_alert_audit_read('00000000-0000-0000-0000-0000000c1211',912012,100,0)),
  'audited actor is correct'
);
select pg_temp.nc12_expect_error(
  $$select public.p1_acknowledge_operational_alert(912012,null)$$,
  'cannot be acknowledged'
);

-- Direct public table access remains forbidden even for admin; only read RPC is exposed.
select pg_temp.nc12_expect_error(
  $$select count(*) from public.operational_alert_action_audit$$,
  'permission denied'
);

reset role;
select pg_temp.nc12_expect_error(
  $$delete from public.operational_alert_action_audit where alert_id=912012$$,
  'append-only'
);
select pg_temp.nc12_expect_error(
  $$update public.operational_alert_action_audit set action='reopened' where alert_id=912012$$,
  'append-only'
);
select pg_temp.nc12_assert(
  (select count(*)=2 from public.operational_alert_action_audit where alert_id=912012),
  'audit immutable and not deleted'
);
rollback;
