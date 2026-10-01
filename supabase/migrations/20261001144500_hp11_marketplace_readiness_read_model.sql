-- HP11 — Marketplace Entry & Readiness UX
-- Read-only organization-level readiness model for all active tenant members.

create or replace function private.hp11_marketplace_readiness_impl(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_membership_role text;
  v_network_company_id uuid;
  v_link_status text;
  v_publication_status text;
  v_claimed_status text;
  v_verification_status text;
  v_supplier_product_count integer := 0;
  v_technical_signal_count integer := 0;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select om.role
  into v_membership_role
  from public.organization_memberships om
  where om.organization_id = p_organization_id
    and om.user_id = v_user_id
    and om.status = 'active'
  limit 1;

  if v_membership_role is null then
    raise exception 'active organization membership required' using errcode='42501';
  end if;

  select
    l.network_company_id,
    l.link_status,
    c.publication_status,
    c.claimed_status,
    c.verification_status
  into
    v_network_company_id,
    v_link_status,
    v_publication_status,
    v_claimed_status,
    v_verification_status
  from public.organization_network_company_links l
  join public.network_companies c
    on c.id = l.network_company_id
   and c.archived_at is null
  where l.organization_id = p_organization_id
    and l.link_status = 'active'
  order by l.linked_at desc nulls last, l.id
  limit 1;

  if v_network_company_id is not null then
    select count(*)::integer
    into v_supplier_product_count
    from public.network_company_products cp
    where cp.company_id = v_network_company_id
      and cp.relationship_type in (
        'produces',
        'distributes',
        'stocks',
        'processes'
      );

    select coalesce(sum(signal_count), 0)::integer
    into v_technical_signal_count
    from (
      select count(*)::integer as signal_count
      from public.network_company_product_standard_scopes s
      join public.network_company_products cp
        on cp.id = s.company_product_id
      where cp.company_id = v_network_company_id
        and cp.relationship_type in (
          'produces',
          'distributes',
          'stocks',
          'processes'
        )
      union all
      select count(*)::integer
      from public.network_company_product_grade_scopes g
      join public.network_company_products cp
        on cp.id = g.company_product_id
      where cp.company_id = v_network_company_id
        and cp.relationship_type in (
          'produces',
          'distributes',
          'stocks',
          'processes'
        )
      union all
      select count(*)::integer
      from public.network_company_product_dimension_scopes d
      join public.network_company_products cp
        on cp.id = d.company_product_id
      where cp.company_id = v_network_company_id
        and cp.relationship_type in (
          'produces',
          'distributes',
          'stocks',
          'processes'
        )
    ) signals;
  end if;

  return jsonb_build_object(
    'contract', 'HP11-marketplace-readiness-v1',
    'organization_id', p_organization_id,
    'membership_role', v_membership_role,
    'network_company_id', v_network_company_id,
    'link_status', v_link_status,
    'publication_status', v_publication_status,
    'claimed_status', v_claimed_status,
    'verification_status', v_verification_status,
    'supplier_product_count', v_supplier_product_count,
    'technical_signal_count', v_technical_signal_count,
    'named_publication_ready',
      coalesce(v_link_status = 'active' and v_publication_status = 'published', false),
    'supplier_matching_ready',
      coalesce(
        v_link_status = 'active'
        and v_publication_status = 'published'
        and v_supplier_product_count > 0,
        false
      )
  );
end;
$function$;

revoke all on function private.hp11_marketplace_readiness_impl(uuid)
from public, anon;

grant execute on function private.hp11_marketplace_readiness_impl(uuid)
to authenticated, service_role;

create or replace function public.hp11_marketplace_readiness(
  p_organization_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.hp11_marketplace_readiness_impl(p_organization_id);
$function$;

revoke all on function public.hp11_marketplace_readiness(uuid)
from public, anon;

grant execute on function public.hp11_marketplace_readiness(uuid)
to authenticated, service_role;

comment on function public.hp11_marketplace_readiness(uuid) is
  'HP11 read-only Marketplace readiness for active members of the requested organization.';
