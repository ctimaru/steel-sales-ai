-- L27.2A — Investor Business Plan Room acceptance
-- Disposable owner + investor access proof. Everything rolls back.

begin;

create temp table l272a_state(
  key text primary key,
  value jsonb not null
) on commit drop;

grant select, insert, update, delete on table l272a_state
to anon, authenticated;

create or replace function pg_temp.l272a_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'L27.2A assertion failed: %', message;
  end if;
end;
$$;

grant execute on function pg_temp.l272a_assert(boolean,text)
to anon, authenticated;

-- Direct table access must remain closed.
select pg_temp.l272a_assert(
  not has_table_privilege('anon','public.investor_business_plan_invites','SELECT')
  and not has_table_privilege('authenticated','public.investor_business_plan_invites','SELECT')
  and not has_table_privilege('anon','public.investor_business_plan_sessions','SELECT')
  and not has_table_privilege('authenticated','public.investor_business_plan_sessions','SELECT'),
  'investor-room tables must not be directly readable through client roles'
);

-- Clean CI databases do not contain the account-specific production owner.
do $owner$
begin
  if not exists (
    select 1
    from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values(
      '00000000-0000-0000-0000-000000002720',
      'l272a-owner@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(
      user_id,role,status,granted_by,reason
    ) values (
      '00000000-0000-0000-0000-000000002720',
      'platform_superadmin',
      'active',
      null,
      'L27.2A acceptance owner'
    );
  end if;
end
$owner$;

insert into auth.users(id,email,email_confirmed_at)
values(
  '00000000-0000-0000-0000-000000002721',
  'l272a-non-owner@example.test',
  now()
)
on conflict (id) do nothing;

-- Platform Owner creates a governed investor invite.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (
    select user_id::text
    from public.platform_user_roles
    where role='platform_superadmin' and status='active'
    limit 1
  ),
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

insert into l272a_state(key,value)
select 'invite',
  public.l272a_create_investor_business_plan_invite(
    'Investor acceptance',
    'investor@example.test',
    'Investor-Acceptance-Password-2027',
    now()+interval '7 days'
  );

select pg_temp.l272a_assert(
  (select value->>'share_token' from l272a_state where key='invite') is not null,
  'owner invite must return a share token'
);

reset role;

select pg_temp.l272a_assert(
  (
    select password_hash <> 'Investor-Acceptance-Password-2027'
      and length(password_hash) > 20
    from public.investor_business_plan_invites
    where id=(
      select (value->>'id')::uuid
      from l272a_state
      where key='invite'
    )
  ),
  'investor password must never be stored in plaintext'
);

-- Non-owner authenticated users cannot manage the investor room.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000002721',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.l272a_assert(
  coalesce(
    (
      public.l272a_investor_business_plan_invite_list()
      ->>'allowed'
    )::boolean,
    false
  ) = false,
  'non-owner must not list investor invites'
);

do $blocked$
begin
  begin
    perform public.l272a_create_investor_business_plan_invite(
      'Blocked invite',
      null,
      'Blocked-Investor-Password-2027',
      now()+interval '7 days'
    );
    raise exception 'non-owner unexpectedly created investor invite';
  exception
    when insufficient_privilege then
      null;
  end;
end
$blocked$;

-- Anonymous investor can only authenticate through the narrow RPC.
reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);

insert into l272a_state(key,value)
select 'wrong_login',
  public.l272a_investor_business_plan_login(
    (
      select (value->>'share_token')::uuid
      from l272a_state
      where key='invite'
    ),
    'not-the-password'
  );

select pg_temp.l272a_assert(
  (select (value->>'ok')::boolean from l272a_state where key='wrong_login') = false,
  'wrong password must be rejected'
);

insert into l272a_state(key,value)
select 'login',
  public.l272a_investor_business_plan_login(
    (
      select (value->>'share_token')::uuid
      from l272a_state
      where key='invite'
    ),
    'Investor-Acceptance-Password-2027'
  );

select pg_temp.l272a_assert(
  (select (value->>'ok')::boolean from l272a_state where key='login')
  and length(
    (select value->>'session_token' from l272a_state where key='login')
  ) >= 32,
  'correct password must create a temporary investor session'
);

insert into l272a_state(key,value)
select 'validated',
  public.l272a_investor_business_plan_validate(
    (
      select (value->>'share_token')::uuid
      from l272a_state
      where key='invite'
    ),
    (
      select value->>'session_token'
      from l272a_state
      where key='login'
    )
  );

select pg_temp.l272a_assert(
  (select (value->>'ok')::boolean from l272a_state where key='validated'),
  'active investor session must validate'
);

select pg_temp.l272a_assert(
  public.l272a_investor_business_plan_logout(
    (
      select (value->>'share_token')::uuid
      from l272a_state
      where key='invite'
    ),
    (
      select value->>'session_token'
      from l272a_state
      where key='login'
    )
  ),
  'investor logout must revoke the session'
);

select pg_temp.l272a_assert(
  (
    public.l272a_investor_business_plan_validate(
      (
        select (value->>'share_token')::uuid
        from l272a_state
        where key='invite'
      ),
      (
        select value->>'session_token'
        from l272a_state
        where key='login'
      )
    )->>'ok'
  )::boolean = false,
  'revoked investor session must not validate'
);

rollback;
