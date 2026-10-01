-- HP7 — First Login & Guided Company Setup acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.hp7_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'HP7 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.hp7_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'HP7 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'HP7 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000007701'::uuid,'hp7-applicant@example.com',now()),
  ('00000000-0000-0000-0000-000000007702'::uuid,'hp7-outsider@example.com',now())
on conflict (id) do nothing;

do $owner$
begin
  if not exists (
    select 1
    from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-000000007700'::uuid,
      'hp7-owner@example.com',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-000000007700'::uuid,
      'platform_superadmin',
      'active',
      null,
      'HP7 acceptance fallback owner'
    );
  end if;
end
$owner$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 gset

select pg_temp.hp7_assert(
  not has_function_privilege(
    'anon',
    'public.hp7_company_setup_state(uuid)',
    'EXECUTE'
  ),
  'anonymous users must not execute guided setup state'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000007701',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,website_url,primary_company_type,contact_name
) values (
  'HP7 Guided Setup Company 7701',
  'IT',
  'https://hp7-guided-7701.example.test',
  'trader_distributor',
  'HP7 Applicant'
) returning id as hp7_app_id gset

select public.p0a_submit_registration_application(:'hp7_app_id'::uuid);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p0a_approve_registration_application(:'hp7_app_id'::uuid);
select public.p0a_activate_registration_application(:'hp7_app_id'::uuid)
  as hp7_activation gset

reset role;

select (:'hp7_activation'::jsonb->>'organization_id')::uuid as hp7_org_id gset

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000007701',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

select public.hp7_company_setup_state(:'hp7_org_id'::uuid)
  as initial_setup gset

select pg_temp.hp7_assert(
  (:'initial_setup'::jsonb->>'profile_ready')::boolean
  and not (:'initial_setup'::jsonb->>'data_ready')::boolean
  and not (:'initial_setup'::jsonb->>'setup_completed')::boolean
  and (:'initial_setup'::jsonb->>'first_workspace_seen_at') is not null,
  'activated company must enter a non-blocking measured setup state'
);

select public.update_organization_onboarding(
  :'hp7_org_id'::uuid,
  'HP7 Guided Setup Company 7701',
  'IT',
  'steel',
  array['email']::text[],
  true,
  true
);

select public.hp7_company_setup_state(:'hp7_org_id'::uuid)
  as configured_setup gset

select pg_temp.hp7_assert(
  (:'configured_setup'::jsonb->>'profile_ready')::boolean
  and (:'configured_setup'::jsonb->>'data_ready')::boolean
  and (:'configured_setup'::jsonb->>'setup_completed')::boolean
  and (:'configured_setup'::jsonb->>'guided_setup_completed_at') is not null
  and (:'configured_setup'::jsonb->>'essential_completion_percentage')::integer=100,
  'profile plus source authorization must complete essential guided setup'
);

reset role;

insert into public.documents(
  owner_id,organization_id,filename,document_type
) values (
  '00000000-0000-0000-0000-000000007701'::uuid,
  :'hp7_org_id'::uuid,
  'hp7-first-value.pdf',
  'test'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000007701',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

select public.hp7_company_setup_state(:'hp7_org_id'::uuid)
  as first_value_setup gset

select pg_temp.hp7_assert(
  (:'first_value_setup'::jsonb->>'first_value_ready')::boolean
  and (:'first_value_setup'::jsonb->>'first_value_at') is not null
  and (:'first_value_setup'::jsonb->>'time_to_first_value_seconds') is not null,
  'first private commercial artifact must close time-to-first-value'
);

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000007702',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.hp7_assert_raises(
  format(
    'select public.hp7_company_setup_state(%L::uuid)',
    :'hp7_org_id'
  ),
  'active organization membership required'
);

rollback;
