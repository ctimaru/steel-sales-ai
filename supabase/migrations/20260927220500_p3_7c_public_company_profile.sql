create or replace function public.p3_7c_public_company_profile(
  p_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
with company_row as (
  select c.*
  from public.network_companies c
  where c.id=p_company_id
    and c.publication_status='published'
),
section_flags as (
  select
    c.id,
    (
      nullif(btrim(coalesce(c.website_url,'')),'') is not null
      and nullif(btrim(coalesce(c.description,'')),'') is not null
    ) as identity,
    exists(
      select 1
      from public.network_company_role_assignments r
      where r.company_id=c.id
    ) as positioning,
    exists(
      select 1
      from public.network_company_products p
      where p.company_id=c.id
    ) as products,
    exists(
      select 1
      from public.network_facilities f
      where f.company_id=c.id
        and f.publication_status='published'
    ) as facilities,
    exists(
      select 1
      from public.network_facilities f
      join public.network_facility_capabilities fc on fc.facility_id=f.id
      where f.company_id=c.id
        and f.publication_status='published'
    ) as capabilities,
    exists(
      select 1
      from public.network_company_markets m
      where m.company_id=c.id
    ) as markets,
    exists(
      select 1
      from public.network_company_certifications cert
      where cert.company_id=c.id
    ) as certifications
  from company_row c
),
completeness as (
  select
    s.*,
    (
      (case when s.identity then 1 else 0 end) +
      (case when s.positioning then 1 else 0 end) +
      (case when s.products then 1 else 0 end) +
      (case when s.facilities then 1 else 0 end) +
      (case when s.capabilities then 1 else 0 end) +
      (case when s.markets then 1 else 0 end) +
      (case when s.certifications then 1 else 0 end)
    ) as passed
  from section_flags s
),
company_provenance as (
  select
    c.id,
    case
      when c.verification_status='verified' then 'platform_verified'
      when exists(
        select 1
        from public.network_data_assertions a
        where a.entity_type='company'
          and a.entity_id=c.id
          and a.review_state='accepted'
          and a.ownership_type='company_managed'
      ) then 'company_declared'
      when exists(
        select 1
        from public.network_data_assertions a
        where a.entity_type='company'
          and a.entity_id=c.id
          and a.review_state='accepted'
          and a.source_type='public_web'
      ) then 'public_web'
      else 'platform_curated'
    end as provenance_kind
  from company_row c
)
select jsonb_build_object(
  'contract','P3.7C-v1',
  'company',jsonb_build_object(
    'id',c.id,
    'legal_name',c.legal_name,
    'trading_name',c.trading_name,
    'country_code',c.country_code,
    'website_url',c.website_url,
    'website_domain',c.website_domain,
    'description',c.description,
    'verification_status',c.verification_status,
    'claimed_status',c.claimed_status,
    'provenance_kind',cp.provenance_kind
  ),
  'trust',jsonb_build_object(
    'claimed',c.claimed_status='claimed',
    'verified',c.verification_status='verified',
    'verified_facilities',(
      select count(*)
      from public.network_facilities f
      where f.company_id=c.id
        and f.publication_status='published'
        and f.verification_status='verified'
    ),
    'verified_capabilities',(
      select count(*)
      from public.network_facilities f
      join public.network_facility_capabilities fc on fc.facility_id=f.id
      where f.company_id=c.id
        and f.publication_status='published'
        and fc.verification_status='verified'
    ),
    'verified_certifications',(
      select count(*)
      from public.network_company_certifications cert
      where cert.company_id=c.id
        and cert.verification_status='verified'
    )
  ),
  'completeness',jsonb_build_object(
    'version','P3.7C-v1',
    'passed_sections',s.passed,
    'total_sections',7,
    'percentage',round((s.passed::numeric / 7::numeric) * 100),
    'sections',jsonb_build_object(
      'identity',s.identity,
      'positioning',s.positioning,
      'products',s.products,
      'facilities',s.facilities,
      'capabilities',s.capabilities,
      'markets',s.markets,
      'certifications',s.certifications
    )
  ),
  'roles',coalesce((
    select jsonb_agg(jsonb_build_object(
      'key',r.canonical_key,
      'name',r.display_name,
      'is_primary',ra.is_primary,
      'provenance_kind',case
        when a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by ra.is_primary desc,r.sort_order,r.display_name)
    from public.network_company_role_assignments ra
    join public.network_company_roles r on r.id=ra.role_id
    left join public.network_data_assertions a on a.id=ra.source_assertion_id
    where ra.company_id=c.id
  ),'[]'::jsonb),
  'subtypes',coalesce((
    select jsonb_agg(jsonb_build_object(
      'key',st.canonical_key,
      'name',st.display_name,
      'role_key',r.canonical_key,
      'provenance_kind',case
        when a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by st.sort_order,st.display_name)
    from public.network_company_subtype_assignments sa
    join public.network_company_subtypes st on st.id=sa.subtype_id
    join public.network_company_roles r on r.id=st.company_role_id
    left join public.network_data_assertions a on a.id=sa.source_assertion_id
    where sa.company_id=c.id
  ),'[]'::jsonb),
  'products',coalesce((
    select jsonb_agg(jsonb_build_object(
      'key',pf.canonical_key,
      'name',pf.display_name,
      'relationship_type',p.relationship_type,
      'facility_id',p.facility_id,
      'provenance_kind',case
        when a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by pf.sort_order,pf.display_name,p.relationship_type)
    from public.network_company_products p
    join public.network_product_families pf on pf.id=p.product_family_id
    left join public.network_data_assertions a on a.id=p.source_assertion_id
    where p.company_id=c.id
  ),'[]'::jsonb),
  'markets',coalesce((
    select jsonb_agg(jsonb_build_object(
      'key',m.canonical_key,
      'name',m.display_name,
      'provenance_kind',case
        when a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by m.sort_order,m.display_name)
    from public.network_company_markets cm
    join public.network_markets m on m.id=cm.market_id
    left join public.network_data_assertions a on a.id=cm.source_assertion_id
    where cm.company_id=c.id
  ),'[]'::jsonb),
  'facilities',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',f.id,
      'name',f.name,
      'facility_type',f.facility_type,
      'address_line_1',f.address_line_1,
      'address_line_2',f.address_line_2,
      'postal_code',f.postal_code,
      'city',f.city,
      'region',f.region,
      'country_code',f.country_code,
      'website_url',f.website_url,
      'verification_status',f.verification_status,
      'provenance_kind',case
        when f.verification_status='verified' then 'platform_verified'
        when fa.ownership_type='company_managed' then 'company_declared'
        when fa.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end,
      'capabilities',coalesce((
        select jsonb_agg(jsonb_build_object(
          'key',cap.canonical_key,
          'name',cap.display_name,
          'verification_status',fc.verification_status,
          'provenance_kind',case
            when fc.verification_status='verified'
              or ca.ownership_type='platform_verified' then 'platform_verified'
            when ca.ownership_type='company_managed' then 'company_declared'
            when ca.source_type='public_web' then 'public_web'
            else 'platform_curated'
          end
        ) order by cap.sort_order,cap.display_name)
        from public.network_facility_capabilities fc
        join public.network_capabilities cap on cap.id=fc.capability_id
        left join public.network_data_assertions ca on ca.id=fc.source_assertion_id
        where fc.facility_id=f.id
      ),'[]'::jsonb)
    ) order by f.country_code,f.city nulls last,f.name)
    from public.network_facilities f
    left join lateral (
      select a.source_type,a.ownership_type
      from public.network_data_assertions a
      where a.entity_type='facility'
        and a.entity_id=f.id
        and a.review_state='accepted'
      order by a.created_at desc,a.id desc
      limit 1
    ) fa on true
    where f.company_id=c.id
      and f.publication_status='published'
  ),'[]'::jsonb),
  'certifications',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',cert.id,
      'facility_id',cert.facility_id,
      'certification_type_key',ct.canonical_key,
      'certification_type_name',ct.display_name,
      'issuer',cert.issuer,
      'certificate_identifier',cert.certificate_identifier,
      'valid_from',cert.valid_from,
      'valid_to',cert.valid_to,
      'scope_text',cert.scope_text,
      'verification_status',cert.verification_status,
      'validity_state',case
        when cert.valid_to is not null and cert.valid_to < current_date then 'expired'
        when cert.valid_from is not null and cert.valid_from > current_date then 'not_yet_valid'
        when cert.valid_from is not null or cert.valid_to is not null then 'valid'
        else 'unknown'
      end,
      'provenance_kind',case
        when cert.verification_status='verified'
          or a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by ct.sort_order,ct.display_name,cert.valid_to desc nulls last)
    from public.network_company_certifications cert
    join public.network_certification_types ct on ct.id=cert.certification_type_id
    left join public.network_data_assertions a on a.id=cert.source_assertion_id
    where cert.company_id=c.id
  ),'[]'::jsonb),
  'contacts',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',nc.id,
      'facility_id',nc.facility_id,
      'contact_type',nc.contact_type,
      'display_name',nc.display_name,
      'email',nc.email,
      'phone',nc.phone,
      'website_url',nc.website_url
    ) order by nc.contact_type,nc.display_name nulls last,nc.id)
    from public.network_contacts nc
    where nc.company_id=c.id
      and nc.publication_status='published'
  ),'[]'::jsonb)
)
from company_row c
join completeness s on s.id=c.id
join company_provenance cp on cp.id=c.id;
$function$;

revoke all on function public.p3_7c_public_company_profile(uuid) from public;
grant execute on function public.p3_7c_public_company_profile(uuid)
to anon,authenticated,service_role;

comment on function public.p3_7c_public_company_profile(uuid) is
  'P3.7C public Network Company Profile composition with safe trust/provenance labels and deterministic completeness; no governance assertion IDs or private Commercial Memory data.';
