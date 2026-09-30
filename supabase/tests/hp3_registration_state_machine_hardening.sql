-- HP3 — Registration State Machine Hardening acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.hp3_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'HP3 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.hp3_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'HP3 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'HP3 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000003301'::uuid,'hp3-cycle@example.com',now()),
  ('00000000-0000-0000-0000-000000003302'::uuid,'hp3-reject@example.com',now()),
  ('00000000-0000-0000-0000-000000003303'::uuid,'hp3-activate@example.com',now())
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
      '00000000-0000-0000-0000-000000003300'::uuid,
      'hp3-owner@example.com',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-000000003300'::uuid,
      'platform_superadmin',
      'active',
      null,
      'HP3 acceptance fallback owner'
    );
  end if;
end
$owner$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

-- Cycle application: draft -> pending_review -> needs_information
-- -> pending_review -> approved.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003301',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,website_url,primary_company_type,contact_name
) values (
  'HP3 Cycle Company 7D11','IT',
  'https://hp3-cycle-7d11.example.test',
  'producer','HP3 Applicant'
) returning id as cycle_app_id \gset

select public.p0a_submit_registration_application(:'cycle_app_id'::uuid)
  as first_submit \gset
select public.p0a_submit_registration_application(:'cycle_app_id'::uuid)
  as replay_submit \gset

select pg_temp.hp3_assert(
  (:'first_submit'::jsonb->>'status')='pending_review'
  and not coalesce((:'first_submit'::jsonb->>'idempotent_replay')::boolean,false)
  and coalesce((:'replay_submit'::jsonb->>'idempotent_replay')::boolean,false),
  'submit must be retry-safe'
);

reset role;

select pg_temp.hp3_assert(
  (select count(*) from public.platform_registration_events
   where application_id=:'cycle_app_id'::uuid
     and event_type='application_submitted')=1
  and
  (select count(*) from public.platform_registration_events
   where application_id=:'cycle_app_id'::uuid
     and event_type='email_verified')=1,
  'submit replay must not duplicate audit events'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p0a_request_registration_information(
  :'cycle_app_id'::uuid,
  'Please clarify the operating scope.'
) as first_info \gset

select public.p0a_request_registration_information(
  :'cycle_app_id'::uuid,
  'Please clarify the operating scope.'
) as replay_info \gset

select pg_temp.hp3_assert(
  (:'first_info'::jsonb->>'status')='needs_information'
  and not coalesce((:'first_info'::jsonb->>'idempotent_replay')::boolean,false)
  and coalesce((:'replay_info'::jsonb->>'idempotent_replay')::boolean,false),
  'information request must be retry-safe'
);

reset role;

select pg_temp.hp3_assert(
  (select count(*) from public.platform_registration_events
   where application_id=:'cycle_app_id'::uuid
     and event_type='information_requested')=1,
  'information request replay must not duplicate audit events'
);

-- Applicant can edit same-state data, then resubmit.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003301',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.company_registration_applications
set short_description='Updated after Platform information request'
where id=:'cycle_app_id'::uuid;

select public.p0a_submit_registration_application(:'cycle_app_id'::uuid)
  as resubmit \gset
select public.p0a_submit_registration_application(:'cycle_app_id'::uuid)
  as replay_resubmit \gset

select pg_temp.hp3_assert(
  (:'resubmit'::jsonb->>'status')='pending_review'
  and not coalesce((:'resubmit'::jsonb->>'idempotent_replay')::boolean,false)
  and coalesce((:'replay_resubmit'::jsonb->>'idempotent_replay')::boolean,false),
  'resubmission must be retry-safe'
);

reset role;

select pg_temp.hp3_assert(
  (select count(*) from public.platform_registration_events
   where application_id=:'cycle_app_id'::uuid
     and event_type='application_submitted')=2
  and exists (
    select 1 from public.platform_registration_events
    where application_id=:'cycle_app_id'::uuid
      and event_type='application_submitted'
      and from_status='needs_information'
      and to_status='pending_review'
      and coalesce((metadata->>'resubmission')::boolean,false)
  ),
  'resubmission must preserve the real source state and one event per cycle'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p0a_approve_registration_application(:'cycle_app_id'::uuid)
  as first_approve \gset
select public.p0a_approve_registration_application(:'cycle_app_id'::uuid)
  as replay_approve \gset

select pg_temp.hp3_assert(
  (:'first_approve'::jsonb->>'status')='approved'
  and not coalesce((:'first_approve'::jsonb->>'idempotent_replay')::boolean,false)
  and coalesce((:'replay_approve'::jsonb->>'idempotent_replay')::boolean,false),
  'approval must be retry-safe'
);

select pg_temp.hp3_assert_raises(
  format(
    'select public.p0a_reject_registration_application(%L::uuid,%L,%L)',
    :'cycle_app_id',
    'other',
    'Decision changed after approval'
  ),
  'application can only be rejected from pending_review'
);

reset role;

select pg_temp.hp3_assert(
  (select count(*) from public.platform_registration_events
   where application_id=:'cycle_app_id'::uuid
     and event_type='application_approved')=1,
  'approval replay must not duplicate the approval event'
);

-- Central matrix blocks an illegal privileged transition too.
select pg_temp.hp3_assert_raises(
  format(
    'update public.company_registration_applications set application_status=%L where id=%L::uuid',
    'rejected',
    :'cycle_app_id'
  ),
  'invalid registration transition'
);

-- Rejection is retry-safe only for the identical immutable decision.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003302',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name
) values (
  'HP3 Rejection Company 8F22','IT','trader_distributor','HP3 Applicant'
) returning id as reject_app_id \gset

select public.p0a_submit_registration_application(:'reject_app_id'::uuid);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p0a_reject_registration_application(
  :'reject_app_id'::uuid,
  'incomplete_information',
  'Required evidence is missing.'
) as first_reject \gset

select public.p0a_reject_registration_application(
  :'reject_app_id'::uuid,
  'incomplete_information',
  'Required evidence is missing.'
) as replay_reject \gset

select pg_temp.hp3_assert(
  (:'first_reject'::jsonb->>'status')='rejected'
  and not coalesce((:'first_reject'::jsonb->>'idempotent_replay')::boolean,false)
  and coalesce((:'replay_reject'::jsonb->>'idempotent_replay')::boolean,false),
  'identical rejection retry must be idempotent'
);

select pg_temp.hp3_assert_raises(
  format(
    'select public.p0a_reject_registration_application(%L::uuid,%L,%L)',
    :'reject_app_id',
    'other',
    'Different terminal decision'
  ),
  'rejected application decision is immutable'
);

reset role;

select pg_temp.hp3_assert(
  (select count(*) from public.platform_registration_events
   where application_id=:'reject_app_id'::uuid
     and event_type='application_rejected')=1,
  'rejection replay must not duplicate the rejection event'
);

-- Full successful activation remains retry-safe under the canonical matrix.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003303',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,website_url,primary_company_type,contact_name
) values (
  'HP3 Activation Company C933','IT',
  'https://hp3-activation-c933.example.test',
  'producer','HP3 Applicant'
) returning id as activate_app_id \gset

select public.p0a_submit_registration_application(:'activate_app_id'::uuid);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p0a_approve_registration_application(:'activate_app_id'::uuid);
select public.p0a_activate_registration_application(:'activate_app_id'::uuid)
  as first_activation \gset
select public.p0a_activate_registration_application(:'activate_app_id'::uuid)
  as replay_activation \gset

select pg_temp.hp3_assert(
  (:'first_activation'::jsonb->>'status')='activated'
  and not coalesce((:'first_activation'::jsonb->>'idempotent_replay')::boolean,false)
  and coalesce((:'replay_activation'::jsonb->>'idempotent_replay')::boolean,false),
  'activation must remain retry-safe'
);

reset role;

select pg_temp.hp3_assert(
  (select count(*) from public.platform_registration_events
   where application_id=:'activate_app_id'::uuid
     and event_type='activation_completed')=1,
  'activation replay must not duplicate terminal audit events'
);

-- Legacy lifecycle states are no longer reachable.
select pg_temp.hp3_assert_raises(
  format(
    'update public.company_registration_applications set application_status=%L where id=%L::uuid',
    'submitted',
    :'reject_app_id'
  ),
  'invalid registration transition'
);

-- Audit helper rejects an impossible transition description.
select pg_temp.hp3_assert_raises(
  format(
    'select private.p0a_append_registration_event(%L::uuid,%L,%L::uuid,%L,%L,%L,%L::jsonb)',
    :'cycle_app_id',
    'application_submitted',
    :'owner_id',
    'platform_owner',
    'draft',
    'approved',
    '{}'
  ),
  'invalid registration event transition'
);

rollback;
