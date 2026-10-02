-- L27.2D.2 — scoped Investor Room + KPI acceptance
begin;

create temp table l272d2_state(
  key text primary key,
  value jsonb not null
) on commit drop;

grant select, insert, update, delete on table l272d2_state
to anon, authenticated;

create or replace function pg_temp.l272d2_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'L27.2D.2 assertion failed: %', message;
  end if;
end;
$$;

grant execute on function pg_temp.l272d2_assert(boolean,text)
to anon, authenticated;

select pg_temp.l272d2_assert(
  not has_table_privilege('anon','public.investor_business_plan_invites','SELECT')
  and not has_table_privilege('authenticated','public.investor_business_plan_invites','SELECT'),
  'investor invite table must remain closed to browser roles'
);

do $owner$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values(
      '00000000-0000-0000-0000-000000002722',
      'l272d2-owner@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(
      user_id,role,status,granted_by,reason
    ) values (
      '00000000-0000-0000-0000-000000002722',
      'platform_superadmin',
      'active',
      null,
      'L27.2D.2 acceptance owner'
    );
  end if;
end
$owner$;

insert into l272d2_state(key,value)
select 'owner',jsonb_build_object('user_id',user_id)
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1;

insert into auth.users(id,email,email_confirmed_at)
values(
  '00000000-0000-0000-0000-000000002723',
  'l272d2-non-owner@example.test',
  now()
)
on conflict (id) do nothing;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select value->>'user_id' from l272d2_state where key='owner'),
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

insert into l272d2_state(key,value)
select 'invite',
  public.l272d2_create_investor_access_invite(
    'Scoped investor acceptance',
    'investor@example.test',
    'Scoped-Investor-Password-2027',
    now()+interval '7 days',
    array['business_plan']::text[]
  );

select pg_temp.l272d2_assert(
  (select value->'scopes' from l272d2_state where key='invite') @> '["business_plan"]'::jsonb,
  'created invite must persist business_plan scope'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);

insert into l272d2_state(key,value)
select 'login1',
  public.l272a_investor_business_plan_login(
    (select (value->>'share_token')::uuid from l272d2_state where key='invite'),
    'Scoped-Investor-Password-2027'
  );

insert into l272d2_state(key,value)
select 'bp_access',
  public.l272d2_investor_access_validate(
    (select (value->>'share_token')::uuid from l272d2_state where key='invite'),
    (select value->>'session_token' from l272d2_state where key='login1'),
    'business_plan'
  );

select pg_temp.l272d2_assert(
  (select (value->>'ok')::boolean from l272d2_state where key='bp_access'),
  'business_plan scoped invite must validate BP access'
);

insert into l272d2_state(key,value)
select 'kpi_denied',
  public.l272d2_investor_access_validate(
    (select (value->>'share_token')::uuid from l272d2_state where key='invite'),
    (select value->>'session_token' from l272d2_state where key='login1'),
    'kpi'
  );

select pg_temp.l272d2_assert(
  not (select (value->>'ok')::boolean from l272d2_state where key='kpi_denied')
  and (select value->>'code' from l272d2_state where key='kpi_denied')='scope_denied',
  'business_plan-only invite must not access KPI'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select value->>'user_id' from l272d2_state where key='owner'),
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

select public.l272d2_update_investor_access_scopes(
  (select (value->>'id')::uuid from l272d2_state where key='invite'),
  array['business_plan','kpi']::text[]
);

reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);

select pg_temp.l272d2_assert(
  not (
    public.l272d2_investor_access_validate(
      (select (value->>'share_token')::uuid from l272d2_state where key='invite'),
      (select value->>'session_token' from l272d2_state where key='login1'),
      null
    )->>'ok'
  )::boolean,
  'scope updates must invalidate prior sessions'
);

insert into l272d2_state(key,value)
select 'login2',
  public.l272a_investor_business_plan_login(
    (select (value->>'share_token')::uuid from l272d2_state where key='invite'),
    'Scoped-Investor-Password-2027'
  );

insert into l272d2_state(key,value)
select 'kpi_access',
  public.l272d2_investor_kpi_snapshot(
    (select (value->>'share_token')::uuid from l272d2_state where key='invite'),
    (select value->>'session_token' from l272d2_state where key='login2')
  );

select pg_temp.l272d2_assert(
  (select (value->>'ok')::boolean from l272d2_state where key='kpi_access')
  and (select value->'snapshot'->>'stage' from l272d2_state where key='kpi_access')='pre_launch',
  'KPI-scoped investor must receive governed KPI snapshot'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000002723',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.l272d2_assert(
  coalesce(
    (public.l272d2_investor_access_list()->>'allowed')::boolean,
    false
  ) = false,
  'non-owner must not list investor access'
);

do $blocked$
begin
  begin
    perform public.l272d2_owner_kpi_snapshot();
    raise exception 'non-owner unexpectedly read owner KPI snapshot';
  exception
    when insufficient_privilege then null;
  end;
end
$blocked$;

rollback;
