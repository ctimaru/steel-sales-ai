-- COMPANY-UX2.C.1: a company-confirmed description takes precedence over a
-- research summary. Only a field-specific boolean leaves the provenance ledger.
-- Public wrappers, entitlement/privacy guards and publication rules stay intact.

create or replace function private.company_ux2c1_description_is_declared(
  p_company_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path=''
as $function$
  select coalesce((
    select a.ownership_type='company_managed'
      and a.source_type='company_declared'
      and a.asserted_value=to_jsonb(c.description)
    from public.network_companies c
    join lateral (
      select assertion.ownership_type,assertion.source_type,assertion.asserted_value
      from public.network_data_assertions assertion
      where assertion.entity_type='company'
        and assertion.entity_id=c.id
        and assertion.field_path='description'
        and assertion.review_state='accepted'
      order by assertion.created_at desc,assertion.id desc
      limit 1
    ) a on true
    where c.id=p_company_id
      and c.publication_status='published'
      and c.archived_at is null
      and nullif(btrim(c.description),'') is not null
  ),false);
$function$;

revoke all on function private.company_ux2c1_description_is_declared(uuid)
from public,anon,authenticated,service_role;

-- Preserve LR4's contact privacy filter. The existing Pro wrapper still calls
-- pa1_3_require_current_network_access before this privileged projection.
create or replace function private.lr4_public_company_profile_impl(
  p_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_profile jsonb;
  v_contacts jsonb;
begin
  v_profile:=private.p3_7c_public_company_profile_impl(p_company_id);

  if v_profile is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',nc.id,
    'facility_id',nc.facility_id,
    'contact_type',nc.contact_type,
    'display_name',nc.display_name,
    'email',nc.email,
    'phone',nc.phone,
    'website_url',nc.website_url
  ) order by nc.contact_type,nc.display_name nulls last,nc.id),'[]'::jsonb)
  into v_contacts
  from public.network_contacts nc
  where nc.company_id=p_company_id
    and nc.publication_status='published'
    and private.lr4_contact_privacy_ready(
      nc.privacy_classification,
      nc.privacy_legal_basis,
      nc.lia_status,
      nc.art14_status,
      nc.privacy_review_expires_at
    );

  v_profile:=jsonb_set(v_profile,'{contacts}',v_contacts,true);
  return jsonb_set(v_profile,'{company,description_is_company_declared}',
    to_jsonb(private.company_ux2c1_description_is_declared(p_company_id)),true);
end;
$function$;

-- Preserve the active-company guard, Italy-only published projection, 1,200
-- character Free description limit and the existing explicit field allowlist.
create or replace function private.netux11_free_profile_impl(
  p_organization_id uuid, p_company_id uuid
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_profile jsonb;
begin
  perform private.netux11_require_active_company(p_organization_id);

  select jsonb_build_object(
    'contract', 'netux11-free-profile-v1',
    'company', jsonb_build_object(
      'id', c.id, 'legal_name', c.legal_name,
      'trading_name', c.trading_name, 'country_code', c.country_code,
      'website_url', c.website_url,
      'description', left(c.description, 1200),
      'description_is_company_declared', private.company_ux2c1_description_is_declared(c.id),
      'claimed_status', c.claimed_status,
      'verification_status', c.verification_status
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', r.canonical_key, 'name', r.display_name,
        'is_primary', a.is_primary
      ) order by a.is_primary desc, r.display_name)
      from public.network_company_role_assignments a
      join public.network_company_roles r on r.id = a.role_id
      where a.company_id = c.id and r.status='active'
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(distinct p.display_name)
      from public.network_company_products cp
      join public.network_product_families p on p.id=cp.product_family_id
      where cp.company_id=c.id and p.status='active'
    ), '[]'::jsonb),
    'facilities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'city', f.city, 'region', f.region, 'country_code', f.country_code
      ) order by f.city nulls last, f.id)
      from public.network_facilities f
      where f.company_id=c.id and f.publication_status='published'
        and f.archived_at is null
    ), '[]'::jsonb)
  ) into v_profile
  from public.network_companies c
  where c.id = p_company_id and c.publication_status='published'
    and c.archived_at is null and c.country_code='IT';

  return v_profile;
end;
$$;

comment on function private.company_ux2c1_description_is_declared(uuid) is
  'C.1 safe description provenance predicate. Latest accepted field assertion must be company-declared and match the current published value exactly. No verification or publication mutation.';
