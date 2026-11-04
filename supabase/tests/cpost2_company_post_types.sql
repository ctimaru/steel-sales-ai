-- CPOST2 — Tipi di post delle aziende: acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.c2_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'CPOST2 assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.c2_assert_raises(statement text, expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise exception 'CPOST2 expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'CPOST2 statement unexpectedly succeeded: %', statement;
end;
$$;

create or replace function pg_temp.c2_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- Fixtures: c401 admin of a verified company (A), c405 member of another organization (C).
insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000c401'::uuid, 'admin-a@cpost2.example.test', now()),
  ('00000000-0000-0000-0000-00000000c405'::uuid, 'member-c@cpost2.example.test', now())
on conflict (id) do nothing;

insert into public.organizations(id, name, slug) values
  ('00000000-0000-0000-0000-00000000da01'::uuid, 'CPOST2 Org A', 'cpost2-org-a'),
  ('00000000-0000-0000-0000-00000000da03'::uuid, 'CPOST2 Org C', 'cpost2-org-c');
insert into public.organization_memberships(organization_id, user_id, role, status, business_role, is_default) values
  ('00000000-0000-0000-0000-00000000da01'::uuid, '00000000-0000-0000-0000-00000000c401'::uuid, 'admin', 'active', null, true),
  ('00000000-0000-0000-0000-00000000da03'::uuid, '00000000-0000-0000-0000-00000000c405'::uuid, 'member', 'active', null, true);
insert into public.network_companies(id, legal_name, country_code, publication_status, claimed_status, verification_status) values
  ('00000000-0000-0000-0000-00000000db01'::uuid, 'CPOST2 Tubi Verificata S.r.l.', 'IT', 'pending_review', 'claimed', 'verified');
insert into public.network_company_claims(id, network_company_id, organization_id, requested_by, status,
  reviewed_by, reviewed_at, proof_method, proof_status, proof_verified_by, proof_verified_at) values
  ('00000000-0000-0000-0000-00000000dc01'::uuid, '00000000-0000-0000-0000-00000000db01'::uuid,
   '00000000-0000-0000-0000-00000000da01'::uuid, '00000000-0000-0000-0000-00000000c401'::uuid, 'approved',
   '00000000-0000-0000-0000-00000000c401'::uuid, now(), 'manual_review', 'verified',
   '00000000-0000-0000-0000-00000000c401'::uuid, now());
insert into public.organization_network_company_links(organization_id, network_company_id, claim_id, link_status, linked_by) values
  ('00000000-0000-0000-0000-00000000da01'::uuid, '00000000-0000-0000-0000-00000000db01'::uuid,
   '00000000-0000-0000-0000-00000000dc01'::uuid, 'active', '00000000-0000-0000-0000-00000000c401'::uuid);

update private.cpost1_settings set enabled = true, max_posts_per_org_per_day = 10 where singleton;

-- 0. Privileges
select pg_temp.c2_assert(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname like 'cpost2\_%'
      and (has_function_privilege('anon', p.oid, 'EXECUTE') or (n.nspname = 'public' and p.prosecdef))
  )
  and not has_function_privilege('authenticated', 'private.cpost2_normalize_details(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.cpost2_expires_at(text,jsonb,timestamptz)', 'EXECUTE'),
  'CPOST2: no anon, invoker wrappers, validation helpers stay private');
select pg_temp.c2_assert(
  (select count(*) from public.company_posts where post_type <> 'news' and created_at < '2026-11-04 17:00+01') = 0,
  'posts published before CPOST2 are news');

-- 1. Validation
select pg_temp.c2_as('00000000-0000-0000-0000-00000000c401');
set local role authenticated;
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'spam', 'x')$$, 'invalid post type');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'capacity', '', '{"process":"magia"}')$$, 'invalid capacity process');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'capacity', '', '{"process":"altro"}')$$, 'missing post detail: process_detail');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'capacity', '', '{"process":"taglio","available_to":"2020-01-01"}')$$, 'already ended');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'capacity', '', '{"process":"taglio","available_to":"2026-13-45"}')$$, 'invalid post date');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'stock', '', '{"standard":"EN 10216-2"}')$$, 'missing post detail: product');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'stock', '', '{"product":"Tubo","certificate_31":"si"}')$$, 'certificate_31');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'event', '', '{"name":"Fiera","location":"Milano"}')$$, 'missing post detail: date_from');
select pg_temp.c2_assert_raises($$select public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'news', '   ')$$, 'empty');

-- 2. Creation, normalization, expiry
select pg_temp.c2_assert(public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'capacity', 'Anche piccoli lotti',
  jsonb_build_object('process', 'taglio', 'available_to', to_char(current_date + 10, 'YYYY-MM-DD'),
                     'quantity', '200 t/mese', 'location', 'Brescia', 'extra', 'ignored'))->>'post_type' = 'capacity', 'capacity post');
select pg_temp.c2_assert(public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'stock', '',
  '{"product":"Tubo senza saldatura","standard":"EN 10216-2","grade":"P235GH","dimensions":"114,3 x 6,02","quantity":"18 t","certificate_31":true}')->>'post_type' = 'stock', 'stock post with no text');
select pg_temp.c2_assert(public.cpost2_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'event', 'Vi aspettiamo',
  jsonb_build_object('name', 'Made in Steel', 'date_from', to_char(current_date + 30, 'YYYY-MM-DD'),
                     'date_to', to_char(current_date + 32, 'YYYY-MM-DD'), 'location', 'Milano Rho', 'stand', 'Pad. 3'))->>'post_type' = 'event', 'event post');
select pg_temp.c2_assert(public.cpost1_create_post('00000000-0000-0000-0000-00000000da01'::uuid, 'Nuova linea laser')->>'status' = 'published', 'cpost1 still publishes news');
reset role;

select pg_temp.c2_assert(
  (select not (details ? 'extra') and details->>'process' = 'taglio'
          and expires_at = ((current_date + 11)::timestamp at time zone 'Europe/Rome')
     from public.company_posts where organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and post_type = 'capacity'),
  'capacity: unknown keys dropped, expires when its period ends');
select pg_temp.c2_assert(
  (select expires_at = created_at + interval '30 days' and details->>'certificate_31' = 'true'
     from public.company_posts where organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and post_type = 'stock'),
  'stock: expires after 30 days');
select pg_temp.c2_assert(
  (select expires_at = ((current_date + 33)::timestamp at time zone 'Europe/Rome')
     from public.company_posts where organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and post_type = 'event'),
  'event: expires the day after it ends');
select pg_temp.c2_assert(
  (select expires_at is null from public.company_posts where organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and post_type = 'news'),
  'news never expires');
select pg_temp.c2_assert(
  (select count(*) = 4 from public.company_post_events e join public.company_posts p on p.id = e.post_id
    where p.organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and e.event_type = 'published' and e.metadata ? 'post_type'),
  'ledger records the post type');

-- 3. Feed: types, filter, expiry
select pg_temp.c2_as('00000000-0000-0000-0000-00000000c405');
set local role authenticated;
select pg_temp.c2_assert(
  (select count(*) = 4 from jsonb_array_elements(public.cpost2_feed(20)->'items') x
    where x->>'network_company_id' = '00000000-0000-0000-0000-00000000db01'),
  'feed shows the four typed posts');
select pg_temp.c2_assert(
  (select bool_and(x->>'post_type' = 'capacity') and count(*) = 1
     from jsonb_array_elements(public.cpost2_feed(20, null, null, '00000000-0000-0000-0000-00000000db01'::uuid, 'capacity')->'items') x),
  'type filter');
select pg_temp.c2_assert(((public.cpost1_feed(1)->'items'->0) ? 'post_type'), 'cpost1 feed carries the type');
select pg_temp.c2_assert_raises($$select public.cpost2_feed(20, null, null, null, 'boh')$$, 'invalid post type');
reset role;

update public.company_posts set expires_at = now() - interval '1 minute'
where organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and post_type = 'stock';
select id as stock_id from public.company_posts
where organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and post_type = 'stock' \gset

set local role authenticated;
select pg_temp.c2_as('00000000-0000-0000-0000-00000000c405');
select pg_temp.c2_assert(
  (select count(*) = 3 from jsonb_array_elements(public.cpost2_feed(20, null, null, '00000000-0000-0000-0000-00000000db01'::uuid)->'items') x),
  'expired post leaves the feed');
select pg_temp.c2_assert_raises(format('select public.cpost1_report_post(%L::uuid, %L)', :'stock_id', 'spam'), 'post not found');

-- 4. Edit keeps type and expiry; details re-validated
select pg_temp.c2_as('00000000-0000-0000-0000-00000000c401');
select pg_temp.c2_assert_raises(format('select public.cpost2_edit_post(%L::uuid, %L)', :'stock_id', 'x'), 'only published');
reset role;
select id as capacity_id, expires_at as capacity_expiry from public.company_posts
where organization_id = '00000000-0000-0000-0000-00000000da01'::uuid and post_type = 'capacity' \gset
set local role authenticated;
select pg_temp.c2_as('00000000-0000-0000-0000-00000000c401');
select pg_temp.c2_assert_raises(format('select public.cpost2_edit_post(%L::uuid, %L, %L::jsonb)', :'capacity_id', '', '{"process":"magia"}'), 'invalid capacity process');
select pg_temp.c2_assert((public.cpost2_edit_post(:'capacity_id'::uuid, 'Disponibili da lunedì',
  '{"process":"curvatura","quantity":"50 t"}'::jsonb)->>'changed')::boolean, 'author edits a typed post');
reset role;
select pg_temp.c2_assert(
  (select post_type = 'capacity' and details->>'process' = 'curvatura' and expires_at = :'capacity_expiry'::timestamptz
     from public.company_posts where id = :'capacity_id'::uuid),
  'edit keeps the type and does not extend the expiry');

rollback;
