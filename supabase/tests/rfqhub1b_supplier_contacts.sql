-- RFQHUB1B acceptance: a supplier's commercial contacts are saved in the
-- organization's Commerciale tables, attached once to the Network company,
-- never duplicated by e-mail, never moved between companies, write members
-- only, tenant isolated, no anonymous access.
begin;

create or replace function pg_temp.r1b_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'RFQHUB1B assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users(id, email) values
('00000000-0000-0000-0000-0000001b1a01', 'r1b-buyer@example.com'),
('00000000-0000-0000-0000-0000001b1a02', 'r1b-colleague@example.com'),
('00000000-0000-0000-0000-0000001b1a03', 'r1b-viewer@example.com'),
('00000000-0000-0000-0000-0000001b1b01', 'r1b-other@example.com');

insert into public.organizations(id, name, slug, created_by, country_code, onboarding_status) values
('00000000-0000-0000-0000-0000001b1f01', 'R1B Buyer', 'r1b-buyer', '00000000-0000-0000-0000-0000001b1a01', 'IT', 'completed'),
('00000000-0000-0000-0000-0000001b1f02', 'R1B Other', 'r1b-other', '00000000-0000-0000-0000-0000001b1b01', 'IT', 'completed');

insert into public.organization_memberships(organization_id, user_id, role, status, is_default) values
('00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1a01', 'admin', 'active', true),
('00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1a02', 'member', 'active', true),
('00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1a03', 'viewer', 'active', true),
('00000000-0000-0000-0000-0000001b1f02', '00000000-0000-0000-0000-0000001b1b01', 'admin', 'active', true);

insert into public.network_companies(id, legal_name, trading_name, country_code, website_url, publication_status, claimed_status, verification_status, archived_at) values
('00000000-0000-0000-0000-0000001b1c01', 'R1B Tubi S.p.A.', 'R1B Tubi', 'IT', 'https://r1b-tubi.example', 'published', 'unclaimed', 'unverified', null),
('00000000-0000-0000-0000-0000001b1c02', 'R1B Bozza S.r.l.', null, 'IT', null, 'draft', 'unclaimed', 'unverified', null),
('00000000-0000-0000-0000-0000001b1c03', 'R1B Lamiere S.r.l.', null, 'IT', null, 'published', 'unclaimed', 'unverified', null);

create temp table r1b_out(step text primary key, result jsonb) on commit drop;
grant all on r1b_out to authenticated;

-- Buyer saves the first contact of a Network supplier: the private company
-- is created once, linked to the Network company, typed «supplier».
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000001b1a01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001b1a01","role":"authenticated"}', true);
insert into r1b_out values ('first', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c01', null,
  ' Mario Rossi ', ' Mario.Rossi@R1B-Tubi.example ', '+39 02 000', 'Ufficio vendite'));
reset role;

select pg_temp.r1b_assert((select (result->>'ok')::boolean and (result->>'created')::boolean from r1b_out where step = 'first'), 'first contact created');
select pg_temp.r1b_assert((select count(*) = 1 from public.companies
  where organization_id = '00000000-0000-0000-0000-0000001b1f01'
    and network_company_id = '00000000-0000-0000-0000-0000001b1c01'
    and name = 'R1B Tubi' and company_type = 'supplier' and country = 'IT'), 'one linked supplier company');
select pg_temp.r1b_assert((select email_normalized = 'mario.rossi@r1b-tubi.example' and full_name = 'Mario Rossi'
  and role = 'Ufficio vendite' and company_id = (select (result->>'company_id')::uuid from r1b_out where step = 'first')
  from public.contacts where id = (select (result->>'contact_id')::uuid from r1b_out where step = 'first')), 'contact normalized and attached');

-- A colleague adds a second contact to the same supplier: same company.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000001b1a02', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001b1a02","role":"authenticated"}', true);
insert into r1b_out values ('colleague', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c01', null,
  'Anna Bianchi', 'anna@r1b-tubi.example'));
-- Same e-mail again: reused, not duplicated; name updated.
insert into r1b_out values ('again', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c01', null,
  'Anna Bianchi Verdi', 'ANNA@r1b-tubi.example'));
-- The same e-mail cannot be moved to another supplier.
insert into r1b_out values ('moved', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c03', null,
  'Anna Bianchi', 'anna@r1b-tubi.example'));
-- Validation and unpublished Network companies.
insert into r1b_out values ('bad_email', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c01', null, 'X', 'not-an-email'));
insert into r1b_out values ('no_name', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c01', null, '  ', 'x@example.com'));
insert into r1b_out values ('two_targets', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c01',
  (select (result->>'company_id')::uuid from r1b_out where step = 'first'), 'X', 'x@example.com'));
insert into r1b_out values ('draft', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c02', null, 'X', 'x@example.com'));
-- Existing private company as target.
insert into r1b_out values ('by_company', public.rfqhub1b_save_supplier_contact(
  '00000000-0000-0000-0000-0000001b1f01', null,
  (select (result->>'company_id')::uuid from r1b_out where step = 'first'), 'Luca Neri', 'luca@r1b-tubi.example'));
reset role;

select pg_temp.r1b_assert((select (result->>'company_id') = (select result->>'company_id' from r1b_out where step = 'first')
  from r1b_out where step = 'colleague'), 'colleague uses the same supplier company');
select pg_temp.r1b_assert((select not (result->>'created')::boolean and result->>'contact_id' = (select result->>'contact_id' from r1b_out where step = 'colleague')
  from r1b_out where step = 'again'), 'same e-mail reused');
select pg_temp.r1b_assert((select full_name = 'Anna Bianchi Verdi' from public.contacts
  where id = (select (result->>'contact_id')::uuid from r1b_out where step = 'again')), 'name updated on reuse');
select pg_temp.r1b_assert((select result->>'error' = 'email_in_use' from r1b_out where step = 'moved'), 'no move between suppliers');
select pg_temp.r1b_assert((select count(*) = 0 from public.companies
  where network_company_id = '00000000-0000-0000-0000-0000001b1c03'), 'rejected save left no company behind');
select pg_temp.r1b_assert((select result->>'error' = 'email' from r1b_out where step = 'bad_email'), 'invalid e-mail rejected');
select pg_temp.r1b_assert((select result->>'error' = 'name' from r1b_out where step = 'no_name'), 'empty name rejected');
select pg_temp.r1b_assert((select result->>'error' = 'target' from r1b_out where step = 'two_targets'), 'exactly one target');
select pg_temp.r1b_assert((select result->>'error' = 'network_company_not_found' from r1b_out where step = 'draft'), 'unpublished Network company rejected');
select pg_temp.r1b_assert((select (result->>'ok')::boolean from r1b_out where step = 'by_company'), 'save on existing company');
select pg_temp.r1b_assert((select count(*) = 3 from public.contacts where company_id = (select (result->>'company_id')::uuid from r1b_out where step = 'first')),
  'three contacts on the supplier');

-- One Network company maps to one company per organization.
do $$
begin
  insert into public.companies(owner_id, organization_id, name, network_company_id)
  values ('00000000-0000-0000-0000-0000001b1a01', '00000000-0000-0000-0000-0000001b1f01', 'Dup', '00000000-0000-0000-0000-0000001b1c01');
  raise exception 'RFQHUB1B assertion failed: duplicate Network link accepted';
exception when unique_violation then null;
end;
$$;

-- Viewers and other tenants cannot write into the organization.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000001b1a03', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001b1a03","role":"authenticated"}', true);
do $$
begin
  perform public.rfqhub1b_save_supplier_contact('00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c03', null, 'V', 'v@example.com');
  raise exception 'RFQHUB1B assertion failed: viewer wrote a contact';
exception when insufficient_privilege then null;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000001b1b01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001b1b01","role":"authenticated"}', true);
do $$
begin
  perform public.rfqhub1b_save_supplier_contact('00000000-0000-0000-0000-0000001b1f01', '00000000-0000-0000-0000-0000001b1c03', null, 'O', 'o@example.com');
  raise exception 'RFQHUB1B assertion failed: other tenant wrote a contact';
exception when insufficient_privilege then null;
end;
$$;
-- The other tenant's own save stays in its organization, independent of the buyer's.
select pg_temp.r1b_assert((public.rfqhub1b_save_supplier_contact('00000000-0000-0000-0000-0000001b1f02',
  '00000000-0000-0000-0000-0000001b1c01', null, 'Mario Rossi', 'mario.rossi@r1b-tubi.example')->>'created')::boolean,
  'same e-mail allowed in another organization');
select pg_temp.r1b_assert((select count(*) = 0 from public.contacts where organization_id = '00000000-0000-0000-0000-0000001b1f01'),
  'other tenant cannot read buyer contacts');
reset role;

select pg_temp.r1b_assert(not has_function_privilege('anon', 'public.rfqhub1b_save_supplier_contact(uuid,uuid,uuid,text,text,text,text)', 'execute'), 'anon cannot save');

rollback;
