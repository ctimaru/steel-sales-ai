create table public.network_profile_management_events (
  id uuid primary key default gen_random_uuid(),
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid null references auth.users(id) on delete set null,
  operation text not null check (
    operation in (
      'update_overview',
      'add_relation',
      'remove_relation',
      'add_facility',
      'update_facility',
      'archive_facility',
      'add_capability',
      'remove_capability',
      'add_certification',
      'update_certification',
      'remove_certification'
    )
  ),
  entity_type text not null check (
    entity_type in (
      'company',
      'company_role_assignment',
      'company_subtype_assignment',
      'company_product',
      'company_market',
      'facility',
      'facility_capability',
      'company_certification'
    )
  ),
  entity_id uuid null,
  field_path text not null check (
    char_length(btrim(field_path)) between 1 and 255
  ),
  before_value jsonb null,
  after_value jsonb null,
  source_assertion_id uuid null references public.network_data_assertions(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.network_profile_management_events enable row level security;

revoke all on table public.network_profile_management_events from anon, authenticated;
grant select, insert on table public.network_profile_management_events to service_role;

create index network_profile_management_events_company_created_idx
  on public.network_profile_management_events(network_company_id, created_at desc);

create index network_profile_management_events_org_created_idx
  on public.network_profile_management_events(organization_id, created_at desc);

create or replace function private.p3_7_profile_event_immutable_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'network profile management events are immutable'
    using errcode='55000';
end;
$function$;

revoke all on function private.p3_7_profile_event_immutable_guard() from public,anon,authenticated;

create trigger network_profile_management_events_immutable
before update or delete on public.network_profile_management_events
for each row execute function private.p3_7_profile_event_immutable_guard();

create or replace function private.p3_7_record_profile_event_impl(
  p_network_company_id uuid,
  p_operation text,
  p_entity_type text,
  p_entity_id uuid,
  p_field_path text,
  p_before_value jsonb,
  p_after_value jsonb,
  p_source_assertion_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_org uuid;
  v_id uuid;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not private.m7_user_can_manage_network_company(p_network_company_id,v_user)
     and not private.is_platform_superadmin() then
    raise exception 'managed Network company access required' using errcode='42501';
  end if;

  select l.organization_id into v_org
  from public.organization_network_company_links l
  where l.network_company_id=p_network_company_id
    and l.link_status='active'
  order by l.linked_at desc
  limit 1;

  if v_org is null then
    raise exception 'active organization-company link required' using errcode='42501';
  end if;

  insert into public.network_profile_management_events(
    network_company_id,organization_id,actor_user_id,operation,
    entity_type,entity_id,field_path,before_value,after_value,source_assertion_id
  )
  values(
    p_network_company_id,v_org,v_user,p_operation,
    p_entity_type,p_entity_id,btrim(p_field_path),
    p_before_value,p_after_value,p_source_assertion_id
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.p3_7_record_profile_event_impl(
  uuid,text,text,uuid,text,jsonb,jsonb,uuid
) from public,anon,authenticated;
grant execute on function private.p3_7_record_profile_event_impl(
  uuid,text,text,uuid,text,jsonb,jsonb,uuid
) to service_role;

create or replace function public.p3_7_profile_management_contract()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'version','P3.7A-v1',
    'canonical_profile_model','single_profile',
    'principles',jsonb_build_array(
      'claim_does_not_equal_verification',
      'self_declared_does_not_equal_verified',
      'crawler_and_platform_provenance_is_preserved',
      'verified_facts_cannot_be_silently_overridden',
      'structural_changes_are_audited'
    ),
    'sections',jsonb_build_object(
      'overview',jsonb_build_object(
        'company_managed',jsonb_build_array('trading_name','website_url','description'),
        'platform_controlled',jsonb_build_array(
          'legal_name','country_code','registration_id','vat_id',
          'publication_status','claimed_status','verification_status'
        )
      ),
      'roles_subtypes',jsonb_build_object(
        'company_can_manage',true,
        'taxonomy_controlled',true,
        'removal_policy','allowed_unless_platform_verified'
      ),
      'products',jsonb_build_object(
        'company_can_manage',true,
        'relationship_types',jsonb_build_array('produces','distributes','stocks','processes','uses'),
        'removal_policy','allowed_unless_platform_verified'
      ),
      'facilities',jsonb_build_object(
        'company_can_manage',true,
        'legal_identity_fields',false,
        'verification_platform_controlled',true,
        'archive_instead_of_hard_delete',true
      ),
      'capabilities',jsonb_build_object(
        'company_can_manage',true,
        'facility_scoped',true,
        'verification_platform_controlled',true
      ),
      'markets',jsonb_build_object(
        'company_can_manage',true,
        'taxonomy_controlled',true
      ),
      'certifications',jsonb_build_object(
        'company_can_manage',true,
        'verification_platform_controlled',true,
        'evidence_preserved',true
      )
    ),
    'provenance',jsonb_build_object(
      'company_source_type','company_declared',
      'company_ownership_type','company_managed',
      'company_default_review_state','accepted',
      'verification_ownership_type','platform_verified'
    )
  );
$function$;

revoke all on function public.p3_7_profile_management_contract() from public,anon;
grant execute on function public.p3_7_profile_management_contract() to authenticated,service_role;

create or replace function private.p3_7_managed_profile_state_impl(
  p_network_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_company public.network_companies%rowtype;
  v_org uuid;
  v_passed integer;
  v_total constant integer := 7;
  v_identity boolean;
  v_products boolean;
  v_facilities boolean;
  v_capabilities boolean;
  v_markets boolean;
  v_certifications boolean;
  v_inquiry boolean;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not private.m7_user_can_manage_network_company(p_network_company_id,v_user)
     and not private.is_platform_superadmin() then
    raise exception 'managed Network company access required' using errcode='42501';
  end if;

  select * into v_company
  from public.network_companies
  where id=p_network_company_id
    and publication_status<>'archived';

  if not found then
    raise exception 'network company not found or archived' using errcode='P0002';
  end if;

  select l.organization_id into v_org
  from public.organization_network_company_links l
  where l.network_company_id=p_network_company_id
    and l.link_status='active'
  order by l.linked_at desc
  limit 1;

  v_identity :=
    nullif(btrim(coalesce(v_company.website_url,'')),'') is not null
    and nullif(btrim(coalesce(v_company.description,'')),'') is not null;

  v_products := exists(
    select 1 from public.network_company_products p
    where p.company_id=p_network_company_id
  );

  v_facilities := exists(
    select 1 from public.network_facilities f
    where f.company_id=p_network_company_id
      and f.publication_status<>'archived'
  );

  v_capabilities := exists(
    select 1
    from public.network_facility_capabilities fc
    join public.network_facilities f on f.id=fc.facility_id
    where f.company_id=p_network_company_id
      and f.publication_status<>'archived'
  );

  v_markets := exists(
    select 1 from public.network_company_markets m
    where m.company_id=p_network_company_id
  );

  v_certifications := exists(
    select 1 from public.network_company_certifications c
    where c.company_id=p_network_company_id
  );

  v_inquiry := coalesce((
    select p.inquiries_enabled
    from public.network_inquiry_preferences p
    where p.organization_id=v_org
  ),false);

  v_passed :=
    (case when v_identity then 1 else 0 end) +
    (case when v_products then 1 else 0 end) +
    (case when v_facilities then 1 else 0 end) +
    (case when v_capabilities then 1 else 0 end) +
    (case when v_markets then 1 else 0 end) +
    (case when v_certifications then 1 else 0 end) +
    (case when v_inquiry then 1 else 0 end);

  return jsonb_build_object(
    'contract',public.p3_7_profile_management_contract(),
    'organization_id',v_org,
    'company',jsonb_build_object(
      'id',v_company.id,
      'legal_name',v_company.legal_name,
      'trading_name',v_company.trading_name,
      'country_code',v_company.country_code,
      'registration_id',v_company.registration_id,
      'vat_id',v_company.vat_id,
      'website_url',v_company.website_url,
      'website_domain',v_company.website_domain,
      'description',v_company.description,
      'publication_status',v_company.publication_status,
      'claimed_status',v_company.claimed_status,
      'verification_status',v_company.verification_status
    ),
    'roles',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',r.id,
        'key',t.canonical_key,
        'name',t.display_name,
        'is_primary',r.is_primary,
        'source_assertion_id',r.source_assertion_id,
        'source_type',a.source_type,
        'ownership_type',a.ownership_type,
        'review_state',a.review_state
      ) order by r.is_primary desc,t.sort_order,t.display_name),'[]'::jsonb)
      from public.network_company_role_assignments r
      join public.network_company_roles t on t.id=r.role_id
      join public.network_data_assertions a on a.id=r.source_assertion_id
      where r.company_id=p_network_company_id
    ),
    'subtypes',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',s.id,
        'key',t.canonical_key,
        'name',t.display_name,
        'role_key',cr.canonical_key,
        'source_assertion_id',s.source_assertion_id,
        'source_type',a.source_type,
        'ownership_type',a.ownership_type,
        'review_state',a.review_state
      ) order by t.sort_order,t.display_name),'[]'::jsonb)
      from public.network_company_subtype_assignments s
      join public.network_company_subtypes t on t.id=s.subtype_id
      join public.network_company_roles cr on cr.id=t.company_role_id
      join public.network_data_assertions a on a.id=s.source_assertion_id
      where s.company_id=p_network_company_id
    ),
    'products',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',p.id,
        'key',t.canonical_key,
        'name',t.display_name,
        'relationship_type',p.relationship_type,
        'facility_id',p.facility_id,
        'source_assertion_id',p.source_assertion_id,
        'source_type',a.source_type,
        'ownership_type',a.ownership_type,
        'review_state',a.review_state
      ) order by t.sort_order,t.display_name,p.relationship_type),'[]'::jsonb)
      from public.network_company_products p
      join public.network_product_families t on t.id=p.product_family_id
      join public.network_data_assertions a on a.id=p.source_assertion_id
      where p.company_id=p_network_company_id
    ),
    'facilities',(
      select coalesce(jsonb_agg(jsonb_build_object(
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
        'publication_status',f.publication_status,
        'verification_status',f.verification_status,
        'capabilities',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',fc.id,
            'key',cap.canonical_key,
            'name',cap.display_name,
            'verification_status',fc.verification_status,
            'source_assertion_id',fc.source_assertion_id,
            'source_type',a.source_type,
            'ownership_type',a.ownership_type,
            'review_state',a.review_state
          ) order by cap.sort_order,cap.display_name)
          from public.network_facility_capabilities fc
          join public.network_capabilities cap on cap.id=fc.capability_id
          join public.network_data_assertions a on a.id=fc.source_assertion_id
          where fc.facility_id=f.id
        ),'[]'::jsonb)
      ) order by f.created_at,f.name),'[]'::jsonb)
      from public.network_facilities f
      where f.company_id=p_network_company_id
        and f.publication_status<>'archived'
    ),
    'markets',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',m.id,
        'key',t.canonical_key,
        'name',t.display_name,
        'source_assertion_id',m.source_assertion_id,
        'source_type',a.source_type,
        'ownership_type',a.ownership_type,
        'review_state',a.review_state
      ) order by t.sort_order,t.display_name),'[]'::jsonb)
      from public.network_company_markets m
      join public.network_markets t on t.id=m.market_id
      join public.network_data_assertions a on a.id=m.source_assertion_id
      where m.company_id=p_network_company_id
    ),
    'certifications',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',c.id,
        'key',t.canonical_key,
        'name',t.display_name,
        'facility_id',c.facility_id,
        'issuer',c.issuer,
        'certificate_identifier',c.certificate_identifier,
        'valid_from',c.valid_from,
        'valid_to',c.valid_to,
        'scope_text',c.scope_text,
        'verification_status',c.verification_status,
        'evidence_reference',c.evidence_reference,
        'source_assertion_id',c.source_assertion_id,
        'source_type',a.source_type,
        'ownership_type',a.ownership_type,
        'review_state',a.review_state
      ) order by t.sort_order,t.display_name,c.created_at),'[]'::jsonb)
      from public.network_company_certifications c
      join public.network_certification_types t on t.id=c.certification_type_id
      join public.network_data_assertions a on a.id=c.source_assertion_id
      where c.company_id=p_network_company_id
    ),
    'taxonomy',jsonb_build_object(
      'roles',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',t.canonical_key,'name',t.display_name
        ) order by t.sort_order,t.display_name),'[]'::jsonb)
        from public.network_company_roles t where t.status='active'
      ),
      'subtypes',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',t.canonical_key,'name',t.display_name,'role_key',r.canonical_key
        ) order by t.sort_order,t.display_name),'[]'::jsonb)
        from public.network_company_subtypes t
        join public.network_company_roles r on r.id=t.company_role_id
        where t.status='active'
      ),
      'products',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',t.canonical_key,'name',t.display_name
        ) order by t.sort_order,t.display_name),'[]'::jsonb)
        from public.network_product_families t where t.status='active'
      ),
      'capabilities',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',t.canonical_key,'name',t.display_name
        ) order by t.sort_order,t.display_name),'[]'::jsonb)
        from public.network_capabilities t where t.status='active'
      ),
      'markets',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',t.canonical_key,'name',t.display_name
        ) order by t.sort_order,t.display_name),'[]'::jsonb)
        from public.network_markets t where t.status='active'
      ),
      'certifications',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',t.canonical_key,'name',t.display_name
        ) order by t.sort_order,t.display_name),'[]'::jsonb)
        from public.network_certification_types t where t.status='active'
      )
    ),
    'completeness',jsonb_build_object(
      'version','P3.7A-v1',
      'passed_sections',v_passed,
      'total_sections',v_total,
      'percentage',round((v_passed::numeric / v_total::numeric) * 100),
      'sections',jsonb_build_object(
        'identity',v_identity,
        'products',v_products,
        'facilities',v_facilities,
        'capabilities',v_capabilities,
        'markets',v_markets,
        'certifications',v_certifications,
        'inquiry_readiness',v_inquiry
      )
    )
  );
end;
$function$;

revoke all on function private.p3_7_managed_profile_state_impl(uuid) from public,anon;
grant execute on function private.p3_7_managed_profile_state_impl(uuid) to authenticated,service_role;

create or replace function public.p3_7_managed_profile_state(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_7_managed_profile_state_impl(p_network_company_id);
$function$;

revoke all on function public.p3_7_managed_profile_state(uuid) from public,anon;
grant execute on function public.p3_7_managed_profile_state(uuid) to authenticated,service_role;

create or replace function private.m8_update_managed_network_company_impl(
  p_network_company_id uuid,
  p_trading_name text default null,
  p_website_url text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_before public.network_companies%rowtype;
  v_after public.network_companies%rowtype;
  v_assertion_id uuid;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not private.m7_user_can_manage_network_company(p_network_company_id,v_user) then
    raise exception 'approved company claim and active organization admin membership required'
      using errcode='42501';
  end if;

  select * into v_before
  from public.network_companies
  where id=p_network_company_id
  for update;

  if not found or v_before.publication_status='archived' then
    raise exception 'network company not found or archived' using errcode='P0002';
  end if;

  if p_trading_name is not null and char_length(btrim(p_trading_name))>255 then
    raise exception 'trading name exceeds 255 characters' using errcode='22023';
  end if;
  if p_website_url is not null and char_length(btrim(p_website_url))>500 then
    raise exception 'website url exceeds 500 characters' using errcode='22023';
  end if;
  if p_description is not null and char_length(p_description)>4000 then
    raise exception 'description exceeds 4000 characters' using errcode='22023';
  end if;

  update public.network_companies
  set trading_name=nullif(btrim(p_trading_name),''),
      website_url=nullif(btrim(p_website_url),''),
      description=nullif(btrim(p_description),'')
  where id=p_network_company_id
  returning * into v_after;

  if v_before.trading_name is distinct from v_after.trading_name then
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    ) values(
      'company',p_network_company_id,'trading_name',to_jsonb(v_after.trading_name),
      'company_declared','managed_profile:p3.7a','company_managed',v_user,1.0000,'accepted'
    ) returning id into v_assertion_id;

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'update_overview','company',p_network_company_id,'trading_name',
      to_jsonb(v_before.trading_name),to_jsonb(v_after.trading_name),v_assertion_id
    );
  end if;

  if v_before.website_url is distinct from v_after.website_url then
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    ) values(
      'company',p_network_company_id,'website_url',to_jsonb(v_after.website_url),
      'company_declared','managed_profile:p3.7a','company_managed',v_user,1.0000,'accepted'
    ) returning id into v_assertion_id;

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'update_overview','company',p_network_company_id,'website_url',
      to_jsonb(v_before.website_url),to_jsonb(v_after.website_url),v_assertion_id
    );
  end if;

  if v_before.description is distinct from v_after.description then
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    ) values(
      'company',p_network_company_id,'description',to_jsonb(v_after.description),
      'company_declared','managed_profile:p3.7a','company_managed',v_user,1.0000,'accepted'
    ) returning id into v_assertion_id;

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'update_overview','company',p_network_company_id,'description',
      to_jsonb(v_before.description),to_jsonb(v_after.description),v_assertion_id
    );
  end if;

  return jsonb_build_object(
    'network_company_id',v_after.id,
    'trading_name',v_after.trading_name,
    'website_url',v_after.website_url,
    'description',v_after.description,
    'publication_status',v_after.publication_status,
    'verification_status',v_after.verification_status,
    'ownership_contract','P3.7A-v1'
  );
end;
$function$;

comment on table public.network_profile_management_events is
  'P3.7A immutable audit ledger for company-managed Network Profile changes. Direct authenticated access is denied; controlled RPCs write events.';
comment on function public.p3_7_profile_management_contract() is
  'P3.7A executable ownership contract for Network Company Profile management.';
comment on function public.p3_7_managed_profile_state(uuid) is
  'P3.7A managed-profile read model with provenance, taxonomy options and deterministic completeness. Requires profile-management authority or Platform Superadmin.';
