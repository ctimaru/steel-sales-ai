-- CPOST1 — Post delle aziende nel feed della Home: acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.cp_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'CPOST1 assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.cp_assert_raises(statement text, expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise exception 'CPOST1 expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'CPOST1 statement unexpectedly succeeded: %', statement;
end;
$$;

create or replace function pg_temp.cp_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Fixtures
-- c301 admin A · c302 salesperson A · c303 operations A · c304 admin B
-- c305/c306/c307 members of C/D/E · c308 trust staff
-- ---------------------------------------------------------------------
insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000c301'::uuid, 'admin-a@cpost1.example.test', now()),
  ('00000000-0000-0000-0000-00000000c302'::uuid, 'sales-a@cpost1.example.test', now()),
  ('00000000-0000-0000-0000-00000000c303'::uuid, 'ops-a@cpost1.example.test', now()),
  ('00000000-0000-0000-0000-00000000c304'::uuid, 'admin-b@cpost1.example.test', now()),
  ('00000000-0000-0000-0000-00000000c305'::uuid, 'member-c@cpost1.example.test', now()),
  ('00000000-0000-0000-0000-00000000c306'::uuid, 'member-d@cpost1.example.test', now()),
  ('00000000-0000-0000-0000-00000000c307'::uuid, 'member-e@cpost1.example.test', now()),
  ('00000000-0000-0000-0000-00000000c308'::uuid, 'trust@cpost1.example.test', now())
on conflict (id) do nothing;

do $root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role = 'platform_superadmin' and status = 'active'
  ) then
    insert into auth.users(id, email, email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000c300'::uuid, 'owner@cpost1.example.test', now())
    on conflict (id) do nothing;
    insert into public.platform_user_roles(user_id, role, status, granted_by, reason)
    values ('00000000-0000-0000-0000-00000000c300'::uuid, 'platform_superadmin', 'active', null,
            'CPOST1 acceptance fallback owner');
  end if;
end
$root$;

select user_id as owner_id
from public.platform_user_roles
where role = 'platform_superadmin' and status = 'active'
limit 1 \gset

insert into public.platform_staff(user_id, status, activated_at, updated_at)
values ('00000000-0000-0000-0000-00000000c308'::uuid, 'active', now(), now())
on conflict (user_id) do update set status = 'active', suspended_at = null, revoked_at = null, updated_at = now();
insert into public.platform_staff_roles(user_id, role_key, status, assigned_by, reason)
values ('00000000-0000-0000-0000-00000000c308'::uuid, 'network_trust_admin', 'active', :'owner_id'::uuid, 'CPOST1 acceptance');

insert into public.organizations(id, name, slug) values
  ('00000000-0000-0000-0000-00000000ca01'::uuid, 'CPOST1 Org A', 'cpost1-org-a'),
  ('00000000-0000-0000-0000-00000000ca02'::uuid, 'CPOST1 Org B', 'cpost1-org-b'),
  ('00000000-0000-0000-0000-00000000ca03'::uuid, 'CPOST1 Org C', 'cpost1-org-c'),
  ('00000000-0000-0000-0000-00000000ca04'::uuid, 'CPOST1 Org D', 'cpost1-org-d'),
  ('00000000-0000-0000-0000-00000000ca05'::uuid, 'CPOST1 Org E', 'cpost1-org-e');

insert into public.organization_memberships(organization_id, user_id, role, status, business_role, is_default) values
  ('00000000-0000-0000-0000-00000000ca01'::uuid, '00000000-0000-0000-0000-00000000c301'::uuid, 'admin',  'active', null,          true),
  ('00000000-0000-0000-0000-00000000ca01'::uuid, '00000000-0000-0000-0000-00000000c302'::uuid, 'member', 'active', 'salesperson', true),
  ('00000000-0000-0000-0000-00000000ca01'::uuid, '00000000-0000-0000-0000-00000000c303'::uuid, 'member', 'active', 'operations',  true),
  ('00000000-0000-0000-0000-00000000ca02'::uuid, '00000000-0000-0000-0000-00000000c304'::uuid, 'admin',  'active', null,          true),
  ('00000000-0000-0000-0000-00000000ca03'::uuid, '00000000-0000-0000-0000-00000000c305'::uuid, 'member', 'active', null,          true),
  ('00000000-0000-0000-0000-00000000ca04'::uuid, '00000000-0000-0000-0000-00000000c306'::uuid, 'member', 'active', null,          true),
  ('00000000-0000-0000-0000-00000000ca05'::uuid, '00000000-0000-0000-0000-00000000c307'::uuid, 'member', 'active', null,          true);

insert into public.network_companies(id, legal_name, country_code, publication_status, claimed_status, verification_status) values
  ('00000000-0000-0000-0000-00000000cb01'::uuid, 'CPOST1 Acciai Verificata S.r.l.', 'IT', 'pending_review', 'claimed', 'verified'),
  ('00000000-0000-0000-0000-00000000cb02'::uuid, 'CPOST1 Tubi Non Verificata S.r.l.', 'IT', 'pending_review', 'claimed', 'unverified');

insert into public.network_company_claims(id, network_company_id, organization_id, requested_by, status,
  reviewed_by, reviewed_at, proof_method, proof_status, proof_verified_by, proof_verified_at) values
  ('00000000-0000-0000-0000-00000000cc01'::uuid, '00000000-0000-0000-0000-00000000cb01'::uuid,
   '00000000-0000-0000-0000-00000000ca01'::uuid, '00000000-0000-0000-0000-00000000c301'::uuid, 'approved',
   :'owner_id'::uuid, now(), 'manual_review', 'verified', :'owner_id'::uuid, now()),
  ('00000000-0000-0000-0000-00000000cc02'::uuid, '00000000-0000-0000-0000-00000000cb02'::uuid,
   '00000000-0000-0000-0000-00000000ca02'::uuid, '00000000-0000-0000-0000-00000000c304'::uuid, 'approved',
   :'owner_id'::uuid, now(), 'manual_review', 'verified', :'owner_id'::uuid, now());

insert into public.organization_network_company_links(organization_id, network_company_id, claim_id, link_status, linked_by) values
  ('00000000-0000-0000-0000-00000000ca01'::uuid, '00000000-0000-0000-0000-00000000cb01'::uuid,
   '00000000-0000-0000-0000-00000000cc01'::uuid, 'active', :'owner_id'::uuid),
  ('00000000-0000-0000-0000-00000000ca02'::uuid, '00000000-0000-0000-0000-00000000cb02'::uuid,
   '00000000-0000-0000-0000-00000000cc02'::uuid, 'active', :'owner_id'::uuid);

-- ---------------------------------------------------------------------
-- 0. Privileges: no direct table access, nothing for anon, wrappers invoker
-- ---------------------------------------------------------------------
select pg_temp.cp_assert(
  (select bool_and(c.relrowsecurity) from pg_class c
    where c.oid in ('public.company_posts'::regclass, 'public.company_post_reports'::regclass,
                    'public.company_post_events'::regclass, 'private.cpost1_settings'::regclass))
  and not has_table_privilege('authenticated', 'public.company_posts', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.company_post_reports', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.company_post_events', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.company_posts', 'SELECT,INSERT,UPDATE,DELETE'),
  'CPOST1 tables have RLS and no client privileges'
);
select pg_temp.cp_assert(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname like 'cpost1\_%'
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or (n.nspname = 'public' and p.prosecdef))
  ),
  'CPOST1: no anon execute and public wrappers are security invoker'
);
select pg_temp.cp_assert(
  not has_function_privilege('authenticated', 'private.cpost1_publish_context(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.cpost1_viewer_organization()', 'EXECUTE'),
  'CPOST1 support helpers stay private'
);
select pg_temp.cp_assert(
  (select max_posts_per_org_per_day = 3 and max_body_chars = 3000 and auto_hide_report_threshold = 3 and not enabled
     from private.cpost1_settings where singleton),
  'CPOST1 ships disabled with the founder numbers (3/day, 3000 chars, 3 reports)'
);

-- ---------------------------------------------------------------------
-- 1. Kill switch: disabled until a superadmin enables it
-- ---------------------------------------------------------------------
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c301');
set local role authenticated;
select pg_temp.cp_assert(
  public.cpost1_can_publish('00000000-0000-0000-0000-00000000ca01'::uuid)->>'reason' = 'feature_disabled',
  'disabled feature blocks publishing');
select pg_temp.cp_assert((public.cpost1_feed()->'items') = '[]'::jsonb, 'disabled feature returns empty feed');
select pg_temp.cp_assert_raises('select public.cpost1_staff_update_settings(true)', 'platform superadmin required');
reset role;
select pg_temp.cp_as(:'owner_id'::uuid);
set local role authenticated;
select pg_temp.cp_assert((public.cpost1_staff_update_settings(true)->>'enabled')::boolean, 'superadmin enables CPOST1');
reset role;

-- ---------------------------------------------------------------------
-- 2. Who can publish
-- ---------------------------------------------------------------------
set local role authenticated;
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c301');
select pg_temp.cp_assert((public.cpost1_can_publish('00000000-0000-0000-0000-00000000ca01'::uuid)->>'can_publish')::boolean, 'admin of verified company can publish');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c302');
select pg_temp.cp_assert((public.cpost1_can_publish('00000000-0000-0000-0000-00000000ca01'::uuid)->>'can_publish')::boolean, 'salesperson of verified company can publish');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c303');
select pg_temp.cp_assert(public.cpost1_can_publish('00000000-0000-0000-0000-00000000ca01'::uuid)->>'reason' = 'role_not_allowed', 'operations cannot publish');
select pg_temp.cp_assert_raises($$select public.cpost1_create_post('00000000-0000-0000-0000-00000000ca01'::uuid, 'ciao')$$, 'role_not_allowed');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c304');
select pg_temp.cp_assert(public.cpost1_can_publish('00000000-0000-0000-0000-00000000ca02'::uuid)->>'reason' = 'company_not_verified', 'unverified company cannot publish');
select pg_temp.cp_assert(public.cpost1_can_publish('00000000-0000-0000-0000-00000000ca01'::uuid)->>'reason' = 'not_member', 'outsider cannot publish for another organization');

-- ---------------------------------------------------------------------
-- 3. Publishing, validation, daily cap (3)
-- ---------------------------------------------------------------------
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c302');
select pg_temp.cp_assert_raises($$select public.cpost1_create_post('00000000-0000-0000-0000-00000000ca01'::uuid, '   ')$$, 'empty');
select pg_temp.cp_assert_raises($$select public.cpost1_create_post('00000000-0000-0000-0000-00000000ca01'::uuid, repeat('x', 3001))$$, 'exceeds 3000');
select pg_temp.cp_assert(public.cpost1_create_post('00000000-0000-0000-0000-00000000ca01'::uuid, 'CPOST1 post 1')->>'status' = 'published', 'post 1 published');
select pg_temp.cp_assert(public.cpost1_create_post('00000000-0000-0000-0000-00000000ca01'::uuid, 'CPOST1 post 2')->>'status' = 'published', 'post 2 published');
select pg_temp.cp_assert(public.cpost1_create_post('00000000-0000-0000-0000-00000000ca01'::uuid, 'CPOST1 post 3')->>'status' = 'published', 'post 3 published');
select pg_temp.cp_assert_raises($$select public.cpost1_create_post('00000000-0000-0000-0000-00000000ca01'::uuid, 'CPOST1 post 4')$$, 'daily post limit');
reset role;

select id as p1 from public.company_posts where body = 'CPOST1 post 1' \gset
select id as p2 from public.company_posts where body = 'CPOST1 post 2' \gset

-- ---------------------------------------------------------------------
-- 4. Feed: cursor pagination, company identity only
-- ---------------------------------------------------------------------
set local role authenticated;
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c305');
select public.cpost1_feed(2) as page1 \gset
select pg_temp.cp_assert(jsonb_array_length(:'page1'::jsonb->'items') = 2, 'feed page 1 has 2 items');
select pg_temp.cp_assert(
  jsonb_array_length(public.cpost1_feed(2,
    (:'page1'::jsonb->'next_cursor'->>'before_created_at')::timestamptz,
    (:'page1'::jsonb->'next_cursor'->>'before_id')::uuid)->'items') = 1,
  'feed page 2 has the remaining item');
select pg_temp.cp_assert(
  (public.cpost1_feed(2,
    (:'page1'::jsonb->'next_cursor'->>'before_created_at')::timestamptz,
    (:'page1'::jsonb->'next_cursor'->>'before_id')::uuid)->'next_cursor') = 'null'::jsonb,
  'last page has no cursor');
select pg_temp.cp_assert(
  (:'page1'::jsonb->'items'->0->>'company_verified')::boolean
  and not (:'page1'::jsonb->'items'->0->>'is_own_company')::boolean
  and not ((:'page1'::jsonb->'items'->0) ?| array['author_user_id','author_name']),
  'feed shows the company, never the author');
select pg_temp.cp_assert_raises($$select public.cpost1_feed(5, now(), null)$$, 'cursor requires both');

-- ---------------------------------------------------------------------
-- 5. Edit (author only) and delete (author or company admin)
-- ---------------------------------------------------------------------
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c303');
select pg_temp.cp_assert_raises(format('select public.cpost1_edit_post(%L::uuid, %L)', :'p1', 'x'), 'only the author');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c302');
select pg_temp.cp_assert((public.cpost1_edit_post(:'p1'::uuid, 'CPOST1 post 1 corretto')->>'changed')::boolean, 'author edits');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c301');
select pg_temp.cp_assert_raises(format('select public.cpost1_edit_post(%L::uuid, %L)', :'p1', 'x'), 'only the author');
select pg_temp.cp_assert(public.cpost1_delete_post(:'p1'::uuid)->>'status' = 'deleted', 'company admin deletes');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c305');
select pg_temp.cp_assert(jsonb_array_length(public.cpost1_feed(20)->'items') = 2, 'deleted post leaves the feed');

-- ---------------------------------------------------------------------
-- 6. Reports and automatic hiding (3 different organizations)
-- ---------------------------------------------------------------------
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c301');
select pg_temp.cp_assert_raises(format('select public.cpost1_report_post(%L::uuid, %L)', :'p2', 'spam'), 'own company');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c305');
select pg_temp.cp_assert_raises(format('select public.cpost1_report_post(%L::uuid, %L)', :'p2', 'boh'), 'invalid report reason');
select pg_temp.cp_assert(not (public.cpost1_report_post(:'p2'::uuid, 'spam')->>'auto_hidden')::boolean, 'first report');
select pg_temp.cp_assert((public.cpost1_report_post(:'p2'::uuid, 'spam')->>'duplicate')::boolean, 'duplicate report is idempotent');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c306');
select pg_temp.cp_assert(not (public.cpost1_report_post(:'p2'::uuid, 'inappropriate')->>'auto_hidden')::boolean, 'second report');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c307');
select pg_temp.cp_assert((public.cpost1_report_post(:'p2'::uuid, 'fraud_suspicious', 'Sembra una truffa')->>'auto_hidden')::boolean, 'third organization hides the post');
select pg_temp.cp_assert(jsonb_array_length(public.cpost1_feed(20)->'items') = 1, 'hidden post leaves the feed');

-- ---------------------------------------------------------------------
-- 7. Staff console
-- ---------------------------------------------------------------------
select pg_temp.cp_assert_raises('select public.cpost1_staff_queue()', 'network_trust.posts_read');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c308');
select pg_temp.cp_assert((public.cpost1_staff_queue()->0->>'open_reports')::int = 3, 'queue lists the hidden post with 3 reports');
select pg_temp.cp_assert((public.cpost1_staff_moderate_post(:'p2'::uuid, 'restore')->>'reports_closed')::int = 3, 'restore dismisses the reports');
select pg_temp.cp_assert(jsonb_array_length(public.cpost1_staff_queue()) = 0, 'queue is empty after restore');
select pg_temp.cp_assert_raises(format('select public.cpost1_staff_moderate_post(%L::uuid, %L)', :'p2', 'remove'), 'note is required');
select pg_temp.cp_assert(public.cpost1_staff_moderate_post(:'p2'::uuid, 'remove', 'Contenuto ingannevole')->>'status' = 'removed', 'staff removes');
select pg_temp.cp_assert_raises(format('select public.cpost1_staff_moderate_post(%L::uuid, %L)', :'p2', 'restore'), 'cannot be moderated');
select pg_temp.cp_assert_raises('select public.cpost1_staff_update_settings(false)', 'platform superadmin required');
reset role;

-- ---------------------------------------------------------------------
-- 8. Revoked badge: posts disappear, publishing blocked
-- ---------------------------------------------------------------------
update public.network_companies set verification_status = 'revoked'
where id = '00000000-0000-0000-0000-00000000cb01'::uuid;
set local role authenticated;
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c305');
select pg_temp.cp_assert(jsonb_array_length(public.cpost1_feed(20)->'items') = 0, 'revoked badge hides company posts');
select pg_temp.cp_as('00000000-0000-0000-0000-00000000c302');
select pg_temp.cp_assert(public.cpost1_can_publish('00000000-0000-0000-0000-00000000ca01'::uuid)->>'reason' = 'company_not_verified', 'revoked badge blocks publishing');
reset role;

-- ---------------------------------------------------------------------
-- 9. Append-only ledger
-- ---------------------------------------------------------------------
select pg_temp.cp_assert_raises($$update public.company_post_events set metadata = '{}'::jsonb$$, 'append-only');
select pg_temp.cp_assert(
  (select string_agg(event_type || '=' || n, ',' order by event_type)
     from (select e.event_type, count(*) n
             from public.company_post_events e
             join public.company_posts p on p.id = e.post_id
            where p.organization_id = '00000000-0000-0000-0000-00000000ca01'::uuid
            group by 1) z)
  = 'auto_hidden=1,deleted=1,edited=1,published=3,reported=3,staff_removed=1,staff_restored=1',
  'ledger records every step');

rollback;
