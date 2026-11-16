-- HOME-NETPRO-PUBLIC1 (founder decision, 16 Nov 2026): the public home shows live
-- Network totals. AGGREGATE COUNTS ONLY — no company id, name, domain, contact or
-- location — with exactly the published/role rules of
-- private.netpro1b_coverage_impl (published, not archived, supported European
-- country; module = active canonical role). Callable by anon so the statically
-- generated public home can be revalidated without a user session.
--
-- SEC1 boundary: the privileged implementation lives in sec1_public (not a
-- PostgREST schema); public exposes only a SECURITY INVOKER facade, so the
-- anonymous SECURITY DEFINER surface in public stays zero.

-- Same boundary schema as SEC1 (idempotent: already present where SEC1 ran).
create schema if not exists sec1_public;
comment on schema sec1_public is 'SEC1 internal published-content implementations; not exposed by PostgREST or GraphQL';
revoke all on schema sec1_public from public, anon, authenticated;
grant usage on schema sec1_public to anon, authenticated, service_role;

create or replace function sec1_public.public_network_counts_impl()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with published as (
    select c.id, c.country_code
    from public.network_companies c
    where c.publication_status = 'published'
      and c.archived_at is null
      and private.netpro1b_europe_country(c.country_code)
  ), assignments as (
    select distinct p.id, r.canonical_key
    from published p
    join public.network_company_role_assignments a on a.company_id = p.id
    join public.network_company_roles r on r.id = a.role_id and r.status = 'active'
  )
  select jsonb_build_object(
    'contract', 'public-network-counts-v1',
    'as_of', now(),
    'total', (select count(*) from published),
    'italy', (select count(*) from published where country_code = 'IT'),
    'countries', (select count(distinct country_code) from published),
    'modules', jsonb_build_object(
      'producers', (select count(*) from assignments where canonical_key = 'producer'),
      'distributors', (select count(*) from assignments where canonical_key = 'trader_distributor'),
      'processors', (select count(*) from assignments where canonical_key = 'processor_service_provider'),
      'end_users', (select count(*) from assignments where canonical_key = 'end_user')
    )
  );
$$;

revoke all on function sec1_public.public_network_counts_impl() from public;
grant execute on function sec1_public.public_network_counts_impl() to anon, authenticated, service_role;

create or replace function public.public_network_counts()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select sec1_public.public_network_counts_impl();
$$;

revoke all on function public.public_network_counts() from public;
grant execute on function public.public_network_counts() to anon, authenticated, service_role;

comment on function public.public_network_counts() is
  'HOME-NETPRO-PUBLIC1: SECURITY INVOKER facade; aggregate-only public Network totals (published companies per module); no per-company data.';
