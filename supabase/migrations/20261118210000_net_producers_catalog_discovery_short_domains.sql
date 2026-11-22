-- CATALOG-DISCOVERY1: canonical domains with short labels such as ims.it
-- are legitimate first-party sources. Keep DNS/public IP and domain-match
-- safety checks; do not filter on domain length beyond syntax validity.
create or replace function private.netproducers_catalog_discovery_seed_impl(p_limit int default 250)
returns jsonb language plpgsql security definer set search_path='' as $q$
declare v_count int;v_rows jsonb;
begin
 if p_limit is null or p_limit not between 1 and 500 then
  raise exception 'Discovery seed limit invalid' using errcode='22023';end if;
 with candidates as (
  select c.id as company_id,c.website_domain,c.country_code,c.legal_name
  from public.network_companies c
  where c.country_code in ('IT','RO')
   and c.publication_status='published' and c.archived_at is null
   and c.website_domain is not null
   and c.website_domain ~* '^[a-z0-9][a-z0-9.-]{1,200}[.][a-z]{2,}$'
   and exists (
    select 1 from public.network_company_role_assignments a
    join public.network_company_roles r on r.id=a.role_id
    where a.company_id=c.id and r.canonical_key='producer' and r.status='active')
   and not exists (
    select 1 from private.network_producer_catalog_discovery_queue q
    where q.company_id=c.id)
  order by case when c.legal_name ~* '(tubi|tube|tubes|tubif|pipe|profili|inox|acciai|steel)' then 0 else 1 end,
   c.country_code,c.id limit p_limit
 ), inserted as (
 insert into private.network_producer_catalog_discovery_queue(
  company_id,canonical_domain,country_code,priority)
 select company_id,regexp_replace(lower(website_domain),'^www[.]',''),
  country_code,
  case when legal_name ~* '(tubi|tube|tubes|tubif|pipe|profili|inox|acciai|steel)' then 10 else 0 end
 from candidates
 on conflict(company_id) do nothing
 returning company_id
 )
 insert into private.network_producer_catalog_discovery_events(company_id,action)
 select company_id,'seed' from inserted;
 get diagnostics v_count=row_count;
 return jsonb_build_object('contract','netproducers-catalog-discovery-v1',
  'operation','seed','added',v_count);
end;
$q$;


-- Idempotently seed any eligible profile skipped by the former size bound.
select private.netproducers_catalog_discovery_seed_impl(250);
