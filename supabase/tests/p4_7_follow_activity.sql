-- P4.7 Follow & Activity Foundation acceptance.
-- Run only on disposable CI Supabase. Everything rolls back.

begin;

insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-0000000047a1'::uuid,'p47-owner@example.test'),
  ('00000000-0000-0000-0000-0000000047b1'::uuid,'p47-other@example.test');

create or replace function pg_temp.assert_true(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P4.7 assertion failed: %',message;
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
      raise exception 'P4.7 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P4.7 statement unexpectedly succeeded: %',statement;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000047a1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config(
  'p4_7.test_org_id',
  public.create_organization_for_current_user('P4.7 Test Org','IT','Steel')::text,
  true
);

reset role;

insert into public.network_companies(
  id,legal_name,country_code,publication_status,claimed_status,verification_status
) values
(
  '00000000-0000-0000-0000-000000004701'::uuid,
  'P4.7 Published Test S.p.A.','IT','published','unclaimed','unverified'
),
(
  '00000000-0000-0000-0000-000000004702'::uuid,
  'P4.7 Pending Test S.p.A.','IT','pending_review','unclaimed','unverified'
);

-- Pre-follow public changes belong to the canonical ledger but not the user's feed.
update public.network_companies
set description='before follow'
where id='00000000-0000-0000-0000-000000004701'::uuid;

select pg_temp.assert_true(
  (select count(*)=1 from public.network_activity_events
   where network_company_id='00000000-0000-0000-0000-000000004701'::uuid),
  'pre-follow published update must create canonical activity'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000047a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  coalesce((
    public.p4_follow_company(
      current_setting('p4_7.test_org_id')::uuid,
      '00000000-0000-0000-0000-000000004701'::uuid
    )->>'created'
  )::boolean,false),
  'first follow must be created'
);

select pg_temp.assert_true(
  not coalesce((
    public.p4_follow_company(
      current_setting('p4_7.test_org_id')::uuid,
      '00000000-0000-0000-0000-000000004701'::uuid
    )->>'created'
  )::boolean,true),
  'follow replay must be idempotent'
);

select pg_temp.assert_true(
  (public.p4_list_activity_feed(
    current_setting('p4_7.test_org_id')::uuid,false,50,0
  )->>'total')::int=0,
  'pre-follow history must not be retro-populated'
);

reset role;

update public.network_companies
set description='after follow'
where id='00000000-0000-0000-0000-000000004701'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000047a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p4_list_activity_feed(
    current_setting('p4_7.test_org_id')::uuid,false,50,0
  )->>'total')::int=1,
  'post-follow profile update must enter feed'
);

select set_config(
  'p4_7.event_id',
  (public.p4_list_activity_feed(
    current_setting('p4_7.test_org_id')::uuid,false,50,0
  )->'items'->0->>'activity_event_id'),
  true
);

select public.p4_mark_activity_read(
  current_setting('p4_7.test_org_id')::uuid,
  current_setting('p4_7.event_id')::uuid
);

select pg_temp.assert_true(
  (public.p4_list_activity_feed(
    current_setting('p4_7.test_org_id')::uuid,true,50,0
  )->>'total')::int=0,
  'mark read must clear unread-only feed'
);

reset role;

update public.network_companies
set verification_status='pending'
where id='00000000-0000-0000-0000-000000004701'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000047a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      public.p4_list_activity_feed(
        current_setting('p4_7.test_org_id')::uuid,false,50,0
      )->'items'
    ) item
    where item->>'activity_type'='verification_status_updated'
  ),
  'visible verification change must create feed activity'
);

select public.p4_mark_all_activity_read(current_setting('p4_7.test_org_id')::uuid);

select pg_temp.assert_true(
  (public.p4_list_activity_feed(
    current_setting('p4_7.test_org_id')::uuid,true,50,0
  )->>'unread')::int=0,
  'mark all read must clear unread state'
);

select pg_temp.assert_raises(
  format(
    $$select public.p4_follow_company(%L::uuid,'00000000-0000-0000-0000-000000004702'::uuid)$$,
    current_setting('p4_7.test_org_id')
  ),
  'published Network Company required'
);

reset role;

update public.network_companies
set description='must remain private'
where id='00000000-0000-0000-0000-000000004702'::uuid;

select pg_temp.assert_true(
  not exists (
    select 1 from public.network_activity_events
    where network_company_id='00000000-0000-0000-0000-000000004702'::uuid
  ),
  'pending-review changes must not create public activity'
);

select pg_temp.assert_raises(
  format(
    $$update public.network_activity_events set summary='tampered' where id=%L::uuid$$,
    current_setting('p4_7.event_id')
  ),
  'append-only'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000047a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p4_unfollow_company(
  current_setting('p4_7.test_org_id')::uuid,
  '00000000-0000-0000-0000-000000004701'::uuid
);
select public.p4_unfollow_company(
  current_setting('p4_7.test_org_id')::uuid,
  '00000000-0000-0000-0000-000000004701'::uuid
);

select pg_temp.assert_true(
  (public.p4_list_activity_feed(
    current_setting('p4_7.test_org_id')::uuid,false,50,0
  )->>'total')::int=0,
  'unfollow must remove company from current feed'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000047b1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_raises(
  format(
    $$select public.p4_list_followed_companies(%L::uuid,50,0)$$,
    current_setting('p4_7.test_org_id')
  ),
  'active organization membership required'
);

rollback;
