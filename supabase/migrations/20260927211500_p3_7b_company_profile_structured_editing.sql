create or replace function private.p3_7b_require_manage_access(
  p_network_company_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not private.m7_user_can_manage_network_company(p_network_company_id,v_user)
     and not private.is_platform_superadmin() then
    raise exception 'managed Network company access required' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.network_companies c
    where c.id=p_network_company_id
      and c.publication_status<>'archived'
  ) then
    raise exception 'network company not found or archived' using errcode='P0002';
  end if;

  return v_user;
end;
$function$;

revoke all on function private.p3_7b_require_manage_access(uuid) from public,anon,authenticated;

create or replace function private.p3_7b_create_assertion(
  p_network_company_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_field_path text,
  p_asserted_value jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_id uuid;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,
    asserted_by,confidence,review_state
  )
  values(
    p_entity_type,p_entity_id,btrim(p_field_path),coalesce(p_asserted_value,'{}'::jsonb),
    'company_declared','managed_profile:p3.7b','company_managed',
    v_user,1.0000,'accepted'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.p3_7b_create_assertion(uuid,text,uuid,text,jsonb)
from public,anon,authenticated;

create or replace function private.p3_7b_set_role_impl(
  p_network_company_id uuid,
  p_role_key text,
  p_enabled boolean,
  p_is_primary boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_role public.network_company_roles%rowtype;
  v_assignment public.network_company_role_assignments%rowtype;
  v_assignment_id uuid;
  v_assertion_id uuid;
  v_source_ownership text;
  v_requested_primary boolean;
  v_other record;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  select * into v_role
  from public.network_company_roles
  where canonical_key=btrim(p_role_key)
    and status='active';

  if not found then
    raise exception 'active company role not found' using errcode='P0002';
  end if;

  select r.* into v_assignment
  from public.network_company_role_assignments r
  where r.company_id=p_network_company_id
    and r.role_id=v_role.id
  for update;

  if coalesce(p_enabled,false) then
    v_requested_primary := coalesce(p_is_primary,false)
      or not exists(
        select 1 from public.network_company_role_assignments r
        where r.company_id=p_network_company_id
      );

    if v_requested_primary then
      for v_other in
        select r.*,a.ownership_type
        from public.network_company_role_assignments r
        join public.network_data_assertions a on a.id=r.source_assertion_id
        where r.company_id=p_network_company_id
          and r.is_primary
          and (not found or r.id<>v_assignment.id)
        for update of r
      loop
        v_assertion_id := private.p3_7b_create_assertion(
          p_network_company_id,
          'company_role_assignment',
          v_other.id,
          'is_primary',
          jsonb_build_object(
            'role_id',v_other.role_id,
            'is_primary',false
          )
        );

        update public.network_company_role_assignments
        set is_primary=false,source_assertion_id=v_assertion_id
        where id=v_other.id;

        perform private.p3_7_record_profile_event_impl(
          p_network_company_id,'add_relation','company_role_assignment',
          v_other.id,'is_primary',
          jsonb_build_object('is_primary',true),
          jsonb_build_object('is_primary',false),
          v_assertion_id
        );
      end loop;
    end if;

    if found then
      if v_assignment.is_primary is distinct from v_requested_primary then
        v_assertion_id := private.p3_7b_create_assertion(
          p_network_company_id,
          'company_role_assignment',
          v_assignment.id,
          'role_state',
          jsonb_build_object(
            'role_key',v_role.canonical_key,
            'enabled',true,
            'is_primary',v_requested_primary
          )
        );

        update public.network_company_role_assignments
        set is_primary=v_requested_primary,source_assertion_id=v_assertion_id
        where id=v_assignment.id;

        perform private.p3_7_record_profile_event_impl(
          p_network_company_id,'add_relation','company_role_assignment',
          v_assignment.id,'role_state',
          jsonb_build_object(
            'role_key',v_role.canonical_key,
            'enabled',true,
            'is_primary',v_assignment.is_primary
          ),
          jsonb_build_object(
            'role_key',v_role.canonical_key,
            'enabled',true,
            'is_primary',v_requested_primary
          ),
          v_assertion_id
        );
      end if;

      return jsonb_build_object(
        'relation_id',v_assignment.id,
        'enabled',true,
        'is_primary',v_requested_primary,
        'idempotent',v_assignment.is_primary is not distinct from v_requested_primary
      );
    end if;

    v_assignment_id := gen_random_uuid();
    v_assertion_id := private.p3_7b_create_assertion(
      p_network_company_id,
      'company_role_assignment',
      v_assignment_id,
      'role_state',
      jsonb_build_object(
        'role_key',v_role.canonical_key,
        'enabled',true,
        'is_primary',v_requested_primary
      )
    );

    insert into public.network_company_role_assignments(
      id,company_id,role_id,is_primary,source_assertion_id
    )
    values(
      v_assignment_id,p_network_company_id,v_role.id,
      v_requested_primary,v_assertion_id
    );

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_relation','company_role_assignment',
      v_assignment_id,'role_state',null,
      jsonb_build_object(
        'role_key',v_role.canonical_key,
        'enabled',true,
        'is_primary',v_requested_primary
      ),
      v_assertion_id
    );

    return jsonb_build_object(
      'relation_id',v_assignment_id,
      'enabled',true,
      'is_primary',v_requested_primary,
      'idempotent',false
    );
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  select a.ownership_type into v_source_ownership
  from public.network_data_assertions a
  where a.id=v_assignment.source_assertion_id;

  if v_source_ownership='platform_verified' then
    raise exception 'platform-verified role cannot be removed by company manager'
      using errcode='42501';
  end if;

  if v_assignment.is_primary then
    raise exception 'primary role must be replaced before it can be removed'
      using errcode='22023';
  end if;

  if exists(
    select 1
    from public.network_company_subtype_assignments s
    join public.network_company_subtypes t on t.id=s.subtype_id
    where s.company_id=p_network_company_id
      and t.company_role_id=v_role.id
  ) then
    raise exception 'remove dependent company subtypes before removing this role'
      using errcode='23503';
  end if;

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,
    'company_role_assignment',
    v_assignment.id,
    'removed',
    jsonb_build_object(
      'role_key',v_role.canonical_key,
      'enabled',false,
      'previous_is_primary',v_assignment.is_primary
    )
  );

  delete from public.network_company_role_assignments
  where id=v_assignment.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_relation','company_role_assignment',
    v_assignment.id,'removed',
    jsonb_build_object(
      'role_key',v_role.canonical_key,
      'enabled',true,
      'is_primary',v_assignment.is_primary
    ),
    jsonb_build_object(
      'role_key',v_role.canonical_key,
      'enabled',false
    ),
    v_assertion_id
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7b_set_role_impl(uuid,text,boolean,boolean)
from public,anon;
grant execute on function private.p3_7b_set_role_impl(uuid,text,boolean,boolean)
to authenticated,service_role;

create or replace function public.p3_7b_set_role(
  p_network_company_id uuid,
  p_role_key text,
  p_enabled boolean,
  p_is_primary boolean default false
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_set_role_impl(
    p_network_company_id,p_role_key,p_enabled,p_is_primary
  );
$function$;

revoke all on function public.p3_7b_set_role(uuid,text,boolean,boolean)
from public,anon;
grant execute on function public.p3_7b_set_role(uuid,text,boolean,boolean)
to authenticated,service_role;

create or replace function private.p3_7b_set_subtype_impl(
  p_network_company_id uuid,
  p_subtype_key text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_subtype public.network_company_subtypes%rowtype;
  v_assignment public.network_company_subtype_assignments%rowtype;
  v_id uuid;
  v_assertion_id uuid;
  v_source_ownership text;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  select * into v_subtype
  from public.network_company_subtypes
  where canonical_key=btrim(p_subtype_key)
    and status='active';

  if not found then
    raise exception 'active company subtype not found' using errcode='P0002';
  end if;

  select s.* into v_assignment
  from public.network_company_subtype_assignments s
  where s.company_id=p_network_company_id
    and s.subtype_id=v_subtype.id
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object(
        'relation_id',v_assignment.id,'enabled',true,'idempotent',true
      );
    end if;

    if not exists(
      select 1
      from public.network_company_role_assignments r
      where r.company_id=p_network_company_id
        and r.role_id=v_subtype.company_role_id
    ) then
      raise exception 'subtype requires its parent company role'
        using errcode='23503';
    end if;

    v_id := gen_random_uuid();
    v_assertion_id := private.p3_7b_create_assertion(
      p_network_company_id,
      'company_subtype_assignment',
      v_id,
      'subtype_state',
      jsonb_build_object(
        'subtype_key',v_subtype.canonical_key,
        'enabled',true
      )
    );

    insert into public.network_company_subtype_assignments(
      id,company_id,subtype_id,source_assertion_id
    )
    values(v_id,p_network_company_id,v_subtype.id,v_assertion_id);

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_relation','company_subtype_assignment',
      v_id,'subtype_state',null,
      jsonb_build_object(
        'subtype_key',v_subtype.canonical_key,'enabled',true
      ),
      v_assertion_id
    );

    return jsonb_build_object(
      'relation_id',v_id,'enabled',true,'idempotent',false
    );
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  select a.ownership_type into v_source_ownership
  from public.network_data_assertions a
  where a.id=v_assignment.source_assertion_id;

  if v_source_ownership='platform_verified' then
    raise exception 'platform-verified subtype cannot be removed by company manager'
      using errcode='42501';
  end if;

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,
    'company_subtype_assignment',
    v_assignment.id,
    'removed',
    jsonb_build_object(
      'subtype_key',v_subtype.canonical_key,'enabled',false
    )
  );

  delete from public.network_company_subtype_assignments
  where id=v_assignment.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_relation','company_subtype_assignment',
    v_assignment.id,'removed',
    jsonb_build_object(
      'subtype_key',v_subtype.canonical_key,'enabled',true
    ),
    jsonb_build_object(
      'subtype_key',v_subtype.canonical_key,'enabled',false
    ),
    v_assertion_id
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7b_set_subtype_impl(uuid,text,boolean)
from public,anon;
grant execute on function private.p3_7b_set_subtype_impl(uuid,text,boolean)
to authenticated,service_role;

create or replace function public.p3_7b_set_subtype(
  p_network_company_id uuid,
  p_subtype_key text,
  p_enabled boolean
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_set_subtype_impl(
    p_network_company_id,p_subtype_key,p_enabled
  );
$function$;

revoke all on function public.p3_7b_set_subtype(uuid,text,boolean)
from public,anon;
grant execute on function public.p3_7b_set_subtype(uuid,text,boolean)
to authenticated,service_role;

create or replace function private.p3_7b_set_product_impl(
  p_network_company_id uuid,
  p_product_key text,
  p_relationship_type text,
  p_facility_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_product public.network_product_families%rowtype;
  v_relation public.network_company_products%rowtype;
  v_id uuid;
  v_assertion_id uuid;
  v_source_ownership text;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  if p_relationship_type not in ('produces','distributes','stocks','processes','uses') then
    raise exception 'invalid product relationship type' using errcode='22023';
  end if;

  select * into v_product
  from public.network_product_families
  where canonical_key=btrim(p_product_key)
    and status='active';

  if not found then
    raise exception 'active product family not found' using errcode='P0002';
  end if;

  if p_facility_id is not null and not exists(
    select 1
    from public.network_facilities f
    where f.id=p_facility_id
      and f.company_id=p_network_company_id
      and f.publication_status<>'archived'
  ) then
    raise exception 'facility does not belong to managed company or is archived'
      using errcode='23503';
  end if;

  select p.* into v_relation
  from public.network_company_products p
  where p.company_id=p_network_company_id
    and p.product_family_id=v_product.id
    and p.relationship_type=p_relationship_type
    and p.facility_id is not distinct from p_facility_id
  order by p.created_at
  limit 1
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object(
        'relation_id',v_relation.id,'enabled',true,'idempotent',true
      );
    end if;

    v_id := gen_random_uuid();
    v_assertion_id := private.p3_7b_create_assertion(
      p_network_company_id,
      'company_product',
      v_id,
      'product_state',
      jsonb_build_object(
        'product_key',v_product.canonical_key,
        'relationship_type',p_relationship_type,
        'facility_id',p_facility_id,
        'enabled',true
      )
    );

    insert into public.network_company_products(
      id,company_id,product_family_id,relationship_type,
      facility_id,source_assertion_id
    )
    values(
      v_id,p_network_company_id,v_product.id,p_relationship_type,
      p_facility_id,v_assertion_id
    );

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_relation','company_product',
      v_id,'product_state',null,
      jsonb_build_object(
        'product_key',v_product.canonical_key,
        'relationship_type',p_relationship_type,
        'facility_id',p_facility_id,
        'enabled',true
      ),
      v_assertion_id
    );

    return jsonb_build_object(
      'relation_id',v_id,'enabled',true,'idempotent',false
    );
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  select a.ownership_type into v_source_ownership
  from public.network_data_assertions a
  where a.id=v_relation.source_assertion_id;

  if v_source_ownership='platform_verified' then
    raise exception 'platform-verified product relation cannot be removed by company manager'
      using errcode='42501';
  end if;

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,
    'company_product',
    v_relation.id,
    'removed',
    jsonb_build_object(
      'product_key',v_product.canonical_key,
      'relationship_type',p_relationship_type,
      'facility_id',p_facility_id,
      'enabled',false
    )
  );

  delete from public.network_company_products
  where id=v_relation.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_relation','company_product',
    v_relation.id,'removed',
    jsonb_build_object(
      'product_key',v_product.canonical_key,
      'relationship_type',p_relationship_type,
      'facility_id',p_facility_id,
      'enabled',true
    ),
    jsonb_build_object(
      'product_key',v_product.canonical_key,
      'relationship_type',p_relationship_type,
      'facility_id',p_facility_id,
      'enabled',false
    ),
    v_assertion_id
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7b_set_product_impl(uuid,text,text,uuid,boolean)
from public,anon;
grant execute on function private.p3_7b_set_product_impl(uuid,text,text,uuid,boolean)
to authenticated,service_role;

create or replace function public.p3_7b_set_product(
  p_network_company_id uuid,
  p_product_key text,
  p_relationship_type text,
  p_facility_id uuid default null,
  p_enabled boolean default true
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_set_product_impl(
    p_network_company_id,p_product_key,p_relationship_type,
    p_facility_id,p_enabled
  );
$function$;

revoke all on function public.p3_7b_set_product(uuid,text,text,uuid,boolean)
from public,anon;
grant execute on function public.p3_7b_set_product(uuid,text,text,uuid,boolean)
to authenticated,service_role;

create or replace function private.p3_7b_upsert_facility_impl(
  p_network_company_id uuid,
  p_facility_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_facility public.network_facilities%rowtype;
  v_id uuid;
  v_assertion_id uuid;
  v_name text;
  v_type text;
  v_address1 text;
  v_address2 text;
  v_postal text;
  v_city text;
  v_region text;
  v_country text;
  v_website text;
  v_publication text;
  v_before jsonb;
  v_after jsonb;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  v_name := nullif(btrim(p_payload->>'name'),'');
  v_type := nullif(btrim(p_payload->>'facility_type'),'');
  v_address1 := nullif(btrim(p_payload->>'address_line_1'),'');
  v_address2 := nullif(btrim(p_payload->>'address_line_2'),'');
  v_postal := nullif(btrim(p_payload->>'postal_code'),'');
  v_city := nullif(btrim(p_payload->>'city'),'');
  v_region := nullif(btrim(p_payload->>'region'),'');
  v_country := upper(nullif(btrim(p_payload->>'country_code'),''));
  v_website := nullif(btrim(p_payload->>'website_url'),'');
  v_publication := coalesce(nullif(btrim(p_payload->>'publication_status'),''),'published');

  if v_name is null or char_length(v_name)>255 then
    raise exception 'facility name is required and must be <=255 characters'
      using errcode='22023';
  end if;
  if v_type is null or char_length(v_type)>100 then
    raise exception 'facility type is required and must be <=100 characters'
      using errcode='22023';
  end if;
  if v_country is null or v_country !~ '^[A-Z]{2}$' then
    raise exception 'facility country must be ISO alpha-2' using errcode='22023';
  end if;
  if v_publication not in ('draft','published') then
    raise exception 'company manager may set facility publication only to draft or published'
      using errcode='22023';
  end if;

  v_after := jsonb_build_object(
    'name',v_name,
    'facility_type',v_type,
    'address_line_1',v_address1,
    'address_line_2',v_address2,
    'postal_code',v_postal,
    'city',v_city,
    'region',v_region,
    'country_code',v_country,
    'website_url',v_website,
    'publication_status',v_publication
  );

  if p_facility_id is null then
    v_id := gen_random_uuid();

    v_assertion_id := private.p3_7b_create_assertion(
      p_network_company_id,'facility',v_id,'profile_snapshot',v_after
    );

    insert into public.network_facilities(
      id,company_id,name,facility_type,address_line_1,address_line_2,
      postal_code,city,region,country_code,website_url,
      publication_status,verification_status
    )
    values(
      v_id,p_network_company_id,v_name,v_type,v_address1,v_address2,
      v_postal,v_city,v_region,v_country,v_website,
      v_publication,'unverified'
    );

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_facility','facility',
      v_id,'profile_snapshot',null,v_after,v_assertion_id
    );

    return jsonb_build_object(
      'facility_id',v_id,'created',true,'verification_status','unverified'
    );
  end if;

  select * into v_facility
  from public.network_facilities
  where id=p_facility_id
    and company_id=p_network_company_id
  for update;

  if not found or v_facility.publication_status='archived' then
    raise exception 'managed facility not found or archived' using errcode='P0002';
  end if;

  if v_facility.verification_status<>'unverified'
     or exists(
       select 1 from public.network_verifications nv
       where nv.scope='facility'
         and nv.facility_id=v_facility.id
     ) then
    raise exception 'facility with Platform verification history requires Platform review'
      using errcode='42501';
  end if;

  v_before := jsonb_build_object(
    'name',v_facility.name,
    'facility_type',v_facility.facility_type,
    'address_line_1',v_facility.address_line_1,
    'address_line_2',v_facility.address_line_2,
    'postal_code',v_facility.postal_code,
    'city',v_facility.city,
    'region',v_facility.region,
    'country_code',v_facility.country_code,
    'website_url',v_facility.website_url,
    'publication_status',v_facility.publication_status
  );

  if v_before=v_after then
    return jsonb_build_object(
      'facility_id',v_facility.id,'created',false,'idempotent',true
    );
  end if;

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,'facility',v_facility.id,'profile_snapshot',v_after
  );

  update public.network_facilities
  set name=v_name,
      facility_type=v_type,
      address_line_1=v_address1,
      address_line_2=v_address2,
      postal_code=v_postal,
      city=v_city,
      region=v_region,
      country_code=v_country,
      website_url=v_website,
      publication_status=v_publication,
      archived_at=null,
      updated_at=now()
  where id=v_facility.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'update_facility','facility',
    v_facility.id,'profile_snapshot',v_before,v_after,v_assertion_id
  );

  return jsonb_build_object(
    'facility_id',v_facility.id,'created',false,'idempotent',false
  );
end;
$function$;

revoke all on function private.p3_7b_upsert_facility_impl(uuid,uuid,jsonb)
from public,anon;
grant execute on function private.p3_7b_upsert_facility_impl(uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function public.p3_7b_upsert_facility(
  p_network_company_id uuid,
  p_facility_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_upsert_facility_impl(
    p_network_company_id,p_facility_id,p_payload
  );
$function$;

revoke all on function public.p3_7b_upsert_facility(uuid,uuid,jsonb)
from public,anon;
grant execute on function public.p3_7b_upsert_facility(uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function private.p3_7b_archive_facility_impl(
  p_network_company_id uuid,
  p_facility_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_facility public.network_facilities%rowtype;
  v_assertion_id uuid;
  v_before jsonb;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  select * into v_facility
  from public.network_facilities
  where id=p_facility_id
    and company_id=p_network_company_id
  for update;

  if not found then
    raise exception 'managed facility not found' using errcode='P0002';
  end if;

  if v_facility.publication_status='archived' then
    return jsonb_build_object(
      'facility_id',v_facility.id,'archived',true,'idempotent',true
    );
  end if;

  if v_facility.verification_status<>'unverified'
     or exists(
       select 1 from public.network_verifications nv
       where nv.scope='facility'
         and nv.facility_id=v_facility.id
     ) then
    raise exception 'facility with Platform verification history requires Platform review'
      using errcode='42501';
  end if;

  if exists(
    select 1 from public.network_facility_capabilities fc
    where fc.facility_id=v_facility.id
  ) or exists(
    select 1 from public.network_company_products p
    where p.company_id=p_network_company_id
      and p.facility_id=v_facility.id
  ) or exists(
    select 1 from public.network_company_certifications c
    where c.company_id=p_network_company_id
      and c.facility_id=v_facility.id
  ) then
    raise exception 'remove facility capabilities/products/certifications before archiving facility'
      using errcode='23503';
  end if;

  v_before := jsonb_build_object(
    'name',v_facility.name,
    'facility_type',v_facility.facility_type,
    'city',v_facility.city,
    'region',v_facility.region,
    'country_code',v_facility.country_code,
    'publication_status',v_facility.publication_status
  );

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,'facility',v_facility.id,'archived',
    jsonb_build_object('archived',true)
  );

  update public.network_facilities
  set publication_status='archived',
      archived_at=now(),
      updated_at=now()
  where id=v_facility.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'archive_facility','facility',
    v_facility.id,'archived',v_before,
    jsonb_build_object('archived',true),v_assertion_id
  );

  return jsonb_build_object(
    'facility_id',v_facility.id,'archived',true,'idempotent',false
  );
end;
$function$;

revoke all on function private.p3_7b_archive_facility_impl(uuid,uuid)
from public,anon;
grant execute on function private.p3_7b_archive_facility_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p3_7b_archive_facility(
  p_network_company_id uuid,
  p_facility_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_archive_facility_impl(
    p_network_company_id,p_facility_id
  );
$function$;

revoke all on function public.p3_7b_archive_facility(uuid,uuid)
from public,anon;
grant execute on function public.p3_7b_archive_facility(uuid,uuid)
to authenticated,service_role;

create or replace function private.p3_7b_set_facility_capability_impl(
  p_network_company_id uuid,
  p_facility_id uuid,
  p_capability_key text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_capability public.network_capabilities%rowtype;
  v_relation public.network_facility_capabilities%rowtype;
  v_id uuid;
  v_assertion_id uuid;
  v_source_ownership text;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  if not exists(
    select 1 from public.network_facilities f
    where f.id=p_facility_id
      and f.company_id=p_network_company_id
      and f.publication_status<>'archived'
  ) then
    raise exception 'managed facility not found or archived' using errcode='P0002';
  end if;

  select * into v_capability
  from public.network_capabilities
  where canonical_key=btrim(p_capability_key)
    and status='active';

  if not found then
    raise exception 'active capability not found' using errcode='P0002';
  end if;

  select fc.* into v_relation
  from public.network_facility_capabilities fc
  where fc.facility_id=p_facility_id
    and fc.capability_id=v_capability.id
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object(
        'relation_id',v_relation.id,'enabled',true,'idempotent',true
      );
    end if;

    v_id := gen_random_uuid();
    v_assertion_id := private.p3_7b_create_assertion(
      p_network_company_id,'facility_capability',v_id,'capability_state',
      jsonb_build_object(
        'facility_id',p_facility_id,
        'capability_key',v_capability.canonical_key,
        'enabled',true
      )
    );

    insert into public.network_facility_capabilities(
      id,facility_id,capability_id,source_assertion_id,verification_status
    )
    values(
      v_id,p_facility_id,v_capability.id,v_assertion_id,'unverified'
    );

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_capability','facility_capability',
      v_id,'capability_state',null,
      jsonb_build_object(
        'facility_id',p_facility_id,
        'capability_key',v_capability.canonical_key,
        'enabled',true
      ),
      v_assertion_id
    );

    return jsonb_build_object(
      'relation_id',v_id,'enabled',true,'idempotent',false
    );
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  select a.ownership_type into v_source_ownership
  from public.network_data_assertions a
  where a.id=v_relation.source_assertion_id;

  if v_relation.verification_status<>'unverified'
     or v_source_ownership='platform_verified'
     or exists(
       select 1 from public.network_verifications nv
       where nv.scope='facility_capability'
         and nv.facility_capability_id=v_relation.id
     ) then
    raise exception 'capability with Platform verification history requires Platform review'
      using errcode='42501';
  end if;

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,'facility_capability',v_relation.id,'removed',
    jsonb_build_object(
      'facility_id',p_facility_id,
      'capability_key',v_capability.canonical_key,
      'enabled',false
    )
  );

  delete from public.network_facility_capabilities
  where id=v_relation.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_capability','facility_capability',
    v_relation.id,'removed',
    jsonb_build_object(
      'facility_id',p_facility_id,
      'capability_key',v_capability.canonical_key,
      'enabled',true
    ),
    jsonb_build_object(
      'facility_id',p_facility_id,
      'capability_key',v_capability.canonical_key,
      'enabled',false
    ),
    v_assertion_id
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7b_set_facility_capability_impl(uuid,uuid,text,boolean)
from public,anon;
grant execute on function private.p3_7b_set_facility_capability_impl(uuid,uuid,text,boolean)
to authenticated,service_role;

create or replace function public.p3_7b_set_facility_capability(
  p_network_company_id uuid,
  p_facility_id uuid,
  p_capability_key text,
  p_enabled boolean
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_set_facility_capability_impl(
    p_network_company_id,p_facility_id,p_capability_key,p_enabled
  );
$function$;

revoke all on function public.p3_7b_set_facility_capability(uuid,uuid,text,boolean)
from public,anon;
grant execute on function public.p3_7b_set_facility_capability(uuid,uuid,text,boolean)
to authenticated,service_role;

create or replace function private.p3_7b_set_market_impl(
  p_network_company_id uuid,
  p_market_key text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_market public.network_markets%rowtype;
  v_relation public.network_company_markets%rowtype;
  v_id uuid;
  v_assertion_id uuid;
  v_source_ownership text;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  select * into v_market
  from public.network_markets
  where canonical_key=btrim(p_market_key)
    and status='active';

  if not found then
    raise exception 'active market not found' using errcode='P0002';
  end if;

  select m.* into v_relation
  from public.network_company_markets m
  where m.company_id=p_network_company_id
    and m.market_id=v_market.id
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object(
        'relation_id',v_relation.id,'enabled',true,'idempotent',true
      );
    end if;

    v_id := gen_random_uuid();
    v_assertion_id := private.p3_7b_create_assertion(
      p_network_company_id,'company_market',v_id,'market_state',
      jsonb_build_object(
        'market_key',v_market.canonical_key,'enabled',true
      )
    );

    insert into public.network_company_markets(
      id,company_id,market_id,source_assertion_id
    )
    values(v_id,p_network_company_id,v_market.id,v_assertion_id);

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_relation','company_market',
      v_id,'market_state',null,
      jsonb_build_object(
        'market_key',v_market.canonical_key,'enabled',true
      ),
      v_assertion_id
    );

    return jsonb_build_object(
      'relation_id',v_id,'enabled',true,'idempotent',false
    );
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  select a.ownership_type into v_source_ownership
  from public.network_data_assertions a
  where a.id=v_relation.source_assertion_id;

  if v_source_ownership='platform_verified' then
    raise exception 'platform-verified market cannot be removed by company manager'
      using errcode='42501';
  end if;

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,'company_market',v_relation.id,'removed',
    jsonb_build_object(
      'market_key',v_market.canonical_key,'enabled',false
    )
  );

  delete from public.network_company_markets
  where id=v_relation.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_relation','company_market',
    v_relation.id,'removed',
    jsonb_build_object(
      'market_key',v_market.canonical_key,'enabled',true
    ),
    jsonb_build_object(
      'market_key',v_market.canonical_key,'enabled',false
    ),
    v_assertion_id
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7b_set_market_impl(uuid,text,boolean)
from public,anon;
grant execute on function private.p3_7b_set_market_impl(uuid,text,boolean)
to authenticated,service_role;

create or replace function public.p3_7b_set_market(
  p_network_company_id uuid,
  p_market_key text,
  p_enabled boolean
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_set_market_impl(
    p_network_company_id,p_market_key,p_enabled
  );
$function$;

revoke all on function public.p3_7b_set_market(uuid,text,boolean)
from public,anon;
grant execute on function public.p3_7b_set_market(uuid,text,boolean)
to authenticated,service_role;

create or replace function private.p3_7b_upsert_certification_impl(
  p_network_company_id uuid,
  p_certification_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_cert_type public.network_certification_types%rowtype;
  v_cert public.network_company_certifications%rowtype;
  v_id uuid;
  v_assertion_id uuid;
  v_facility_id uuid;
  v_issuer text;
  v_identifier text;
  v_valid_from date;
  v_valid_to date;
  v_scope text;
  v_evidence text;
  v_type_key text;
  v_before jsonb;
  v_after jsonb;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  v_type_key := nullif(btrim(p_payload->>'certification_type_key'),'');
  if v_type_key is null then
    raise exception 'certification type is required' using errcode='22023';
  end if;

  select * into v_cert_type
  from public.network_certification_types
  where canonical_key=v_type_key
    and status='active';

  if not found then
    raise exception 'active certification type not found' using errcode='P0002';
  end if;

  begin
    v_facility_id := nullif(p_payload->>'facility_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid certification facility id' using errcode='22023';
  end;

  if v_facility_id is not null and not exists(
    select 1 from public.network_facilities f
    where f.id=v_facility_id
      and f.company_id=p_network_company_id
      and f.publication_status<>'archived'
  ) then
    raise exception 'certification facility does not belong to managed company'
      using errcode='23503';
  end if;

  v_issuer := nullif(btrim(p_payload->>'issuer'),'');
  v_identifier := nullif(btrim(p_payload->>'certificate_identifier'),'');
  v_scope := nullif(btrim(p_payload->>'scope_text'),'');
  v_evidence := nullif(btrim(p_payload->>'evidence_reference'),'');

  begin
    v_valid_from := nullif(p_payload->>'valid_from','')::date;
    v_valid_to := nullif(p_payload->>'valid_to','')::date;
  exception when invalid_datetime_format then
    raise exception 'invalid certification validity date' using errcode='22023';
  end;

  if v_valid_from is not null and v_valid_to is not null and v_valid_to<v_valid_from then
    raise exception 'certification valid_to cannot precede valid_from'
      using errcode='22023';
  end if;

  v_after := jsonb_build_object(
    'certification_type_key',v_cert_type.canonical_key,
    'facility_id',v_facility_id,
    'issuer',v_issuer,
    'certificate_identifier',v_identifier,
    'valid_from',v_valid_from,
    'valid_to',v_valid_to,
    'scope_text',v_scope,
    'evidence_reference',v_evidence
  );

  if p_certification_id is null then
    v_id := gen_random_uuid();
    v_assertion_id := private.p3_7b_create_assertion(
      p_network_company_id,'company_certification',
      v_id,'certification_profile',v_after
    );

    insert into public.network_company_certifications(
      id,company_id,facility_id,certification_type_id,
      issuer,certificate_identifier,valid_from,valid_to,
      scope_text,verification_status,evidence_reference,source_assertion_id
    )
    values(
      v_id,p_network_company_id,v_facility_id,v_cert_type.id,
      v_issuer,v_identifier,v_valid_from,v_valid_to,
      v_scope,'unverified',v_evidence,v_assertion_id
    );

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_certification','company_certification',
      v_id,'certification_profile',null,v_after,v_assertion_id
    );

    return jsonb_build_object(
      'certification_id',v_id,'created',true,
      'verification_status','unverified'
    );
  end if;

  select * into v_cert
  from public.network_company_certifications
  where id=p_certification_id
    and company_id=p_network_company_id
  for update;

  if not found then
    raise exception 'managed certification not found' using errcode='P0002';
  end if;

  if v_cert.verification_status<>'unverified'
     or exists(
       select 1 from public.network_verifications nv
       where nv.scope='company_certification'
         and nv.company_certification_id=v_cert.id
     ) then
    raise exception 'certification with Platform verification history requires Platform review'
      using errcode='42501';
  end if;

  v_before := jsonb_build_object(
    'certification_type_key',(
      select t.canonical_key
      from public.network_certification_types t
      where t.id=v_cert.certification_type_id
    ),
    'facility_id',v_cert.facility_id,
    'issuer',v_cert.issuer,
    'certificate_identifier',v_cert.certificate_identifier,
    'valid_from',v_cert.valid_from,
    'valid_to',v_cert.valid_to,
    'scope_text',v_cert.scope_text,
    'evidence_reference',v_cert.evidence_reference
  );

  if v_before=v_after then
    return jsonb_build_object(
      'certification_id',v_cert.id,'created',false,'idempotent',true
    );
  end if;

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,'company_certification',
    v_cert.id,'certification_profile',v_after
  );

  update public.network_company_certifications
  set facility_id=v_facility_id,
      certification_type_id=v_cert_type.id,
      issuer=v_issuer,
      certificate_identifier=v_identifier,
      valid_from=v_valid_from,
      valid_to=v_valid_to,
      scope_text=v_scope,
      evidence_reference=v_evidence,
      source_assertion_id=v_assertion_id
  where id=v_cert.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'update_certification','company_certification',
    v_cert.id,'certification_profile',v_before,v_after,v_assertion_id
  );

  return jsonb_build_object(
    'certification_id',v_cert.id,'created',false,'idempotent',false
  );
end;
$function$;

revoke all on function private.p3_7b_upsert_certification_impl(uuid,uuid,jsonb)
from public,anon;
grant execute on function private.p3_7b_upsert_certification_impl(uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function public.p3_7b_upsert_certification(
  p_network_company_id uuid,
  p_certification_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_upsert_certification_impl(
    p_network_company_id,p_certification_id,p_payload
  );
$function$;

revoke all on function public.p3_7b_upsert_certification(uuid,uuid,jsonb)
from public,anon;
grant execute on function public.p3_7b_upsert_certification(uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function private.p3_7b_remove_certification_impl(
  p_network_company_id uuid,
  p_certification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_cert public.network_company_certifications%rowtype;
  v_assertion_id uuid;
  v_source_ownership text;
  v_before jsonb;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  select * into v_cert
  from public.network_company_certifications
  where id=p_certification_id
    and company_id=p_network_company_id
  for update;

  if not found then
    return jsonb_build_object('removed',true,'idempotent',true);
  end if;

  select a.ownership_type into v_source_ownership
  from public.network_data_assertions a
  where a.id=v_cert.source_assertion_id;

  if v_cert.verification_status<>'unverified'
     or v_source_ownership='platform_verified'
     or exists(
       select 1 from public.network_verifications nv
       where nv.scope='company_certification'
         and nv.company_certification_id=v_cert.id
     ) then
    raise exception 'certification with Platform verification history requires Platform review'
      using errcode='42501';
  end if;

  v_before := jsonb_build_object(
    'certification_type_id',v_cert.certification_type_id,
    'facility_id',v_cert.facility_id,
    'issuer',v_cert.issuer,
    'certificate_identifier',v_cert.certificate_identifier,
    'valid_from',v_cert.valid_from,
    'valid_to',v_cert.valid_to,
    'scope_text',v_cert.scope_text,
    'evidence_reference',v_cert.evidence_reference
  );

  v_assertion_id := private.p3_7b_create_assertion(
    p_network_company_id,'company_certification',
    v_cert.id,'removed',
    jsonb_build_object('removed',true)
  );

  delete from public.network_company_certifications
  where id=v_cert.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_certification','company_certification',
    v_cert.id,'removed',v_before,
    jsonb_build_object('removed',true),v_assertion_id
  );

  return jsonb_build_object('removed',true,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7b_remove_certification_impl(uuid,uuid)
from public,anon;
grant execute on function private.p3_7b_remove_certification_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p3_7b_remove_certification(
  p_network_company_id uuid,
  p_certification_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7b_remove_certification_impl(
    p_network_company_id,p_certification_id
  );
$function$;

revoke all on function public.p3_7b_remove_certification(uuid,uuid)
from public,anon;
grant execute on function public.p3_7b_remove_certification(uuid,uuid)
to authenticated,service_role;

comment on function public.p3_7b_set_role(uuid,text,boolean,boolean) is
  'P3.7B governed company-managed role mutation. Company self-declaration never changes Platform verification.';
comment on function public.p3_7b_upsert_facility(uuid,uuid,jsonb) is
  'P3.7B governed facility create/update. Facilities with Platform verification history require Platform review.';
comment on function public.p3_7b_upsert_certification(uuid,uuid,jsonb) is
  'P3.7B governed certification create/update with company-managed provenance; verification remains Platform-controlled.';
