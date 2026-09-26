-- P4.8 Interaction Pilot Telemetry & P5 Readiness acceptance.
-- Disposable CI only. Everything rolls back.

begin;

insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-0000000048a1'::uuid,'p48-sender@example.test'),
  ('00000000-0000-0000-0000-0000000048b1'::uuid,'p48-recipient@example.test'),
  ('00000000-0000-0000-0000-0000000048c1'::uuid,'p48-other@example.test');

create or replace function pg_temp.assert_true(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P4.8 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P4.8 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P4.8 statement unexpectedly succeeded: %',statement;
end;
$$;

-- Create two independent organizations.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000048a1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config(
  'p48.sender_org',
  public.create_organization_for_current_user('P4.8 Sender','IT','Steel')::text,
  true
);
select public.p4_start_interaction_pilot(current_setting('p48.sender_org')::uuid);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000048b1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config(
  'p48.recipient_org',
  public.create_organization_for_current_user('P4.8 Recipient','DE','Steel')::text,
  true
);

reset role;

-- Expand the disposable test window to three days so we can validate the
-- readiness computation deterministically without waiting in CI.
update public.network_interaction_pilot_runs
set started_at=clock_timestamp()-interval '3 days'
where organization_id=current_setting('p48.sender_org')::uuid
  and status='active';

insert into public.network_companies(
  id,legal_name,country_code,publication_status,claimed_status,verification_status
) values(
  '00000000-0000-0000-0000-000000004801'::uuid,
  'P4.8 Recipient Network Company','DE','published','claimed','verified'
);

-- Ten profile views spread over three distinct dates.
insert into public.pilot_usage_events(
  organization_id,actor_user_id,event_name,entity_type,entity_id,outcome,occurred_at,metadata
)
select
  current_setting('p48.sender_org')::uuid,
  '00000000-0000-0000-0000-0000000048a1'::uuid,
  'network_profile_viewed',
  'network_company',
  '00000000-0000-0000-0000-000000004801',
  'success',
  clock_timestamp()-((g % 3)::text||' days')::interval + (g||' minutes')::interval,
  jsonb_build_object('surface','network_company_profile')
from generate_series(1,10) g;

-- Three persistent-intent signals.
insert into public.pilot_usage_events(
  organization_id,actor_user_id,event_name,entity_type,entity_id,outcome,occurred_at,metadata
) values
(
  current_setting('p48.sender_org')::uuid,
  '00000000-0000-0000-0000-0000000048a1'::uuid,
  'network_saved_created','network_company','00000000-0000-0000-0000-000000004801',
  'success',clock_timestamp()-interval '2 days',jsonb_build_object('surface','network_company_profile')
),
(
  current_setting('p48.sender_org')::uuid,
  '00000000-0000-0000-0000-0000000048a1'::uuid,
  'network_follow_created','network_company','00000000-0000-0000-0000-000000004801',
  'success',clock_timestamp()-interval '1 day',jsonb_build_object('surface','network_company_profile')
),
(
  current_setting('p48.sender_org')::uuid,
  '00000000-0000-0000-0000-0000000048a1'::uuid,
  'network_saved_created','network_company','00000000-0000-0000-0000-000000004801',
  'success',clock_timestamp(),jsonb_build_object('surface','network_company_profile')
);

insert into public.network_inquiries(
  id,sender_organization_id,sender_user_id,recipient_network_company_id,
  recipient_organization_id,subject,body,status,submitted_at,last_activity_at
) values
(
  '00000000-0000-0000-0000-000000004811'::uuid,
  current_setting('p48.sender_org')::uuid,
  '00000000-0000-0000-0000-0000000048a1'::uuid,
  '00000000-0000-0000-0000-000000004801'::uuid,
  current_setting('p48.recipient_org')::uuid,
  'Test inquiry 1','Acceptance body 1','read',
  clock_timestamp()-interval '1 day',clock_timestamp()
),
(
  '00000000-0000-0000-0000-000000004812'::uuid,
  current_setting('p48.sender_org')::uuid,
  '00000000-0000-0000-0000-0000000048a1'::uuid,
  '00000000-0000-0000-0000-000000004801'::uuid,
  current_setting('p48.recipient_org')::uuid,
  'Test inquiry 2','Acceptance body 2','submitted',
  clock_timestamp(),clock_timestamp()
);

insert into public.network_inquiry_events(
  inquiry_id,event_type,actor_user_id,actor_organization_id,
  previous_status,new_status,metadata,created_at
) values(
  '00000000-0000-0000-0000-000000004811'::uuid,
  'read',
  '00000000-0000-0000-0000-0000000048b1'::uuid,
  current_setting('p48.recipient_org')::uuid,
  'submitted','read','{}'::jsonb,clock_timestamp()
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000048a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p5_readiness(current_setting('p48.sender_org')::uuid)->>'evidence_ready')::boolean,
  'all five evidence criteria must pass for deterministic fixture'
);

select pg_temp.assert_true(
  (public.p5_readiness(current_setting('p48.sender_org')::uuid)->>'criteria_passed_count')::int=5,
  'five readiness criteria must be counted'
);

select pg_temp.assert_true(
  (public.p4_interaction_pilot_summary(current_setting('p48.sender_org')::uuid)->>'profile_views')::int=10,
  'profile views must be counted from privacy-safe usage telemetry'
);

select pg_temp.assert_true(
  (public.p4_interaction_pilot_summary(current_setting('p48.sender_org')::uuid)->>'inquiries_submitted')::int=2,
  'inquiry count must come from canonical operational data'
);

select pg_temp.assert_true(
  (public.p4_interaction_pilot_summary(current_setting('p48.sender_org')::uuid)->>'recipient_engaged_inquiries')::int=1,
  'recipient engagement must come from canonical inquiry events'
);

-- Event metadata remains bounded to source/surface/format.
select public.p1_record_pilot_usage_event(
  current_setting('p48.sender_org')::uuid,
  'network_directory_viewed',
  null,null,'success',null,null,
  jsonb_build_object(
    'surface','network_directory',
    'subject','must-not-survive',
    'body','must-not-survive',
    'price','must-not-survive'
  )
);

reset role;
select pg_temp.assert_true(
  not exists (
    select 1
    from public.pilot_usage_events
    where organization_id=current_setting('p48.sender_org')::uuid
      and metadata ?| array['subject','body','price']
  ),
  'interaction telemetry must not persist sensitive free-form metadata'
);

-- Unrelated authenticated user cannot read another organization's scorecard.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000048c1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_raises(
  format(
    $$select public.p5_readiness(%L::uuid)$$,
    current_setting('p48.sender_org')
  ),
  'active tenant membership required'
);

rollback;
