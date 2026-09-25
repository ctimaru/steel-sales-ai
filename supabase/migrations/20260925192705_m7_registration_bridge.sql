alter table public.company_registration_applications
  add column matched_network_company_id uuid null
    references public.network_companies(id) on delete restrict;

create index company_registration_applications_matched_network_company_idx
  on public.company_registration_applications (matched_network_company_id)
  where matched_network_company_id is not null;

create table public.organization_network_company_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  application_id uuid not null references public.company_registration_applications(id) on delete restrict,
  link_status text not null default 'active',
  linked_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint organization_network_company_links_status_check check (link_status in ('active','revoked')),
  constraint organization_network_company_links_org_unique unique (organization_id),
  constraint organization_network_company_links_company_unique unique (network_company_id),
  constraint organization_network_company_links_application_unique unique (application_id)
);

alter table public.organization_network_company_links enable row level security;
revoke all on table public.organization_network_company_links from public,anon,authenticated;
grant select,insert,update,delete on table public.organization_network_company_links to service_role;

create or replace function private.m7_application_candidates_impl(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid;
  v_app public.company_registration_applications%rowtype;
  v_domain text;
  v_normalized_name text;
  v_result jsonb;
begin
  v_actor := (select auth.uid());
  if v_actor is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  select * into v_app
  from public.company_registration_applications
  where id=p_application_id;

  if not found then
    raise exception 'registration application not found' using errcode='P0002';
  end if;

  v_normalized_name := lower(regexp_replace(btrim(v_app.legal_name), '\s+', ' ', 'g'));

  v_domain := null;
  if v_app.website_url is not null then
    v_domain := lower(regexp_replace(
      regexp_replace(btrim(v_app.website_url), '^https?://', '', 'i'),
      '^www\.', '',
      'i'
    ));
    v_domain := split_part(v_domain,'/',1);
    v_domain := nullif(v_domain,'');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'network_company_id',nc.id,
      'legal_name',nc.legal_name,
      'country_code',nc.country_code,
      'website_domain',nc.website_domain,
      'publication_status',nc.publication_status,
      'verification_status',nc.verification_status,
      'signals',x.signals,
      'match_score',x.match_score
    )
    order by x.match_score desc,nc.legal_name,nc.id
  ),'[]'::jsonb)
  into v_result
  from public.network_companies nc
  cross join lateral (
    select
      array_remove(array[
        case when nc.country_code=v_app.country_code
          and v_app.vat_id is not null and nc.vat_id is not null
          and lower(btrim(nc.vat_id))=lower(btrim(v_app.vat_id))
          then 'country_vat_exact' end,
        case when nc.country_code=v_app.country_code
          and v_app.registration_id is not null and nc.registration_id is not null
          and lower(btrim(nc.registration_id))=lower(btrim(v_app.registration_id))
          then 'country_registration_exact' end,
        case when v_domain is not null and nc.website_domain is not null
          and lower(btrim(nc.website_domain))=v_domain
          then 'website_domain_exact' end,
        case when nc.country_code=v_app.country_code
          and nc.normalized_legal_name=v_normalized_name
          then 'country_normalized_legal_name_exact' end
      ],null)::text[] signals,
      greatest(
        case when nc.country_code=v_app.country_code and v_app.vat_id is not null and nc.vat_id is not null
          and lower(btrim(nc.vat_id))=lower(btrim(v_app.vat_id)) then 1.0000 else 0 end,
        case when nc.country_code=v_app.country_code and v_app.registration_id is not null and nc.registration_id is not null
          and lower(btrim(nc.registration_id))=lower(btrim(v_app.registration_id)) then 0.9800 else 0 end,
        case when v_domain is not null and nc.website_domain is not null
          and lower(btrim(nc.website_domain))=v_domain then 0.8500 else 0 end,
        case when nc.country_code=v_app.country_code and nc.normalized_legal_name=v_normalized_name
          then 0.7500 else 0 end
      )::numeric(5,4) match_score
  ) x
  where nc.publication_status<>'archived'
    and cardinality(x.signals)>0;

  return jsonb_build_object('application_id',v_app.id,'candidates',v_result);
end;
$function$;

revoke all on function private.m7_application_candidates_impl(uuid) from public,anon;
grant execute on function private.m7_application_candidates_impl(uuid) to authenticated,service_role;

create or replace function public.m7_registration_network_candidates(p_application_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.m7_application_candidates_impl(p_application_id);
$function$;

revoke all on function public.m7_registration_network_candidates(uuid) from public,anon;
grant execute on function public.m7_registration_network_candidates(uuid) to authenticated,service_role;

create or replace function private.m7_user_can_manage_network_company(
  p_network_company_id uuid,
  p_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists (
    select 1
    from public.organization_network_company_links l
    join public.organization_memberships om on om.organization_id=l.organization_id
    join public.network_company_claims c
      on c.organization_id=l.organization_id
     and c.network_company_id=l.network_company_id
    where l.network_company_id=p_network_company_id
      and l.link_status='active'
      and om.user_id=coalesce(p_user_id,(select auth.uid()))
      and om.status='active'
      and om.role='admin'
      and c.status='approved'
  );
$function$;

revoke all on function private.m7_user_can_manage_network_company(uuid,uuid) from public,anon,authenticated;
grant execute on function private.m7_user_can_manage_network_company(uuid,uuid) to service_role;

create or replace function private.m7_bridge_registration_impl(
  p_application_id uuid,
  p_network_company_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid;
  v_app public.company_registration_applications%rowtype;
  v_org uuid;
  v_company uuid;
  v_claim uuid;
  v_link uuid;
  v_domain text;
  v_candidates jsonb;
  v_candidate_count integer;
  v_assertion uuid;
  v_role_key text;
  v_role_assignment uuid;
  v_existing_claim public.network_company_claims%rowtype;
begin
  v_actor := (select auth.uid());
  if v_actor is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  select * into v_app
  from public.company_registration_applications
  where id=p_application_id
  for update;

  if not found then
    raise exception 'registration application not found' using errcode='P0002';
  end if;

  if v_app.application_status<>'activated' then
    raise exception 'registration bridge requires activated application' using errcode='22023';
  end if;

  v_org := v_app.activated_organization_id;
  if v_org is null then
    raise exception 'activated application has no organization' using errcode='23514';
  end if;

  select l.id,l.network_company_id into v_link,v_company
  from public.organization_network_company_links l
  where l.application_id=v_app.id;

  if found then
    if p_network_company_id is not null and p_network_company_id<>v_company then
      raise exception 'application already bridged to another network company' using errcode='23505';
    end if;

    select id into v_claim
    from public.network_company_claims
    where network_company_id=v_company
      and organization_id=v_org
      and status='approved'
    order by reviewed_at desc
    limit 1;

    return jsonb_build_object(
      'application_id',v_app.id,'organization_id',v_org,'network_company_id',v_company,
      'link_id',v_link,'claim_id',v_claim,'created_network_company',false,
      'verification_status',(select verification_status from public.network_companies where id=v_company),
      'idempotent_replay',true
    );
  end if;

  if v_app.matched_network_company_id is not null then
    if p_network_company_id is not null and p_network_company_id<>v_app.matched_network_company_id then
      raise exception 'application matched_network_company_id conflicts with requested target' using errcode='23514';
    end if;
    v_company := v_app.matched_network_company_id;
  else
    v_company := p_network_company_id;
  end if;

  v_domain := null;
  if v_app.website_url is not null then
    v_domain := lower(regexp_replace(
      regexp_replace(btrim(v_app.website_url),'^https?://','','i'),
      '^www\.','','i'
    ));
    v_domain := split_part(v_domain,'/',1);
    v_domain := nullif(v_domain,'');
  end if;

  if v_company is null then
    v_candidates := private.m7_application_candidates_impl(v_app.id)->'candidates';
    v_candidate_count := jsonb_array_length(v_candidates);

    if v_candidate_count>0 then
      raise exception 'identity candidates exist; explicit network company selection required' using errcode='22023';
    end if;

    insert into public.network_companies(
      legal_name,trading_name,country_code,vat_id,registration_id,
      website_url,website_domain,description,
      publication_status,claimed_status,verification_status
    )
    values(
      btrim(v_app.legal_name),nullif(btrim(v_app.trading_name),''),
      v_app.country_code,nullif(btrim(v_app.vat_id),''),
      nullif(btrim(v_app.registration_id),''),
      nullif(btrim(v_app.website_url),''),v_domain,
      nullif(btrim(v_app.short_description),''),
      'pending_review','unclaimed','unverified'
    )
    returning id into v_company;

    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    )
    values
      ('company',v_company,'legal_name',to_jsonb(btrim(v_app.legal_name)),
       'registration_application','registration_application:'||v_app.id::text,
       'company_managed',v_app.applicant_user_id,1.0000,'accepted'),
      ('company',v_company,'country_code',to_jsonb(v_app.country_code),
       'registration_application','registration_application:'||v_app.id::text,
       'company_managed',v_app.applicant_user_id,1.0000,'accepted');

    if v_app.vat_id is not null then
      insert into public.network_data_assertions(
        entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
        ownership_type,asserted_by,confidence,review_state
      ) values (
        'company',v_company,'vat_id',to_jsonb(v_app.vat_id),'registration_application',
        'registration_application:'||v_app.id::text,'company_managed',
        v_app.applicant_user_id,1.0000,'accepted'
      );
    end if;

    if v_app.registration_id is not null then
      insert into public.network_data_assertions(
        entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
        ownership_type,asserted_by,confidence,review_state
      ) values (
        'company',v_company,'registration_id',to_jsonb(v_app.registration_id),'registration_application',
        'registration_application:'||v_app.id::text,'company_managed',
        v_app.applicant_user_id,1.0000,'accepted'
      );
    end if;

    if v_app.website_url is not null then
      insert into public.network_data_assertions(
        entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
        ownership_type,asserted_by,confidence,review_state
      ) values (
        'company',v_company,'website_url',to_jsonb(v_app.website_url),'registration_application',
        'registration_application:'||v_app.id::text,'company_managed',
        v_app.applicant_user_id,0.9500,'accepted'
      );
    end if;

    foreach v_role_key in array array_prepend(v_app.primary_company_type,v_app.secondary_company_types)
    loop
      v_role_assignment := gen_random_uuid();

      insert into public.network_data_assertions(
        entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
        ownership_type,asserted_by,confidence,review_state
      )
      values(
        'company_role_assignment',v_role_assignment,'role',to_jsonb(v_role_key),
        'registration_application','registration_application:'||v_app.id::text,
        'company_managed',v_app.applicant_user_id,1.0000,'accepted'
      )
      returning id into v_assertion;

      insert into public.network_company_role_assignments(
        id,company_id,role_id,is_primary,source_assertion_id
      )
      select v_role_assignment,v_company,r.id,(v_role_key=v_app.primary_company_type),v_assertion
      from public.network_company_roles r
      where r.canonical_key=v_role_key;
    end loop;
  else
    if not exists(
      select 1 from public.network_companies where id=v_company and publication_status<>'archived'
    ) then
      raise exception 'selected network company not found or archived' using errcode='P0002';
    end if;

    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    )
    values
      ('company',v_company,'legal_name',to_jsonb(btrim(v_app.legal_name)),
       'registration_application','registration_application:'||v_app.id::text,
       'company_managed',v_app.applicant_user_id,1.0000,'pending'),
      ('company',v_company,'country_code',to_jsonb(v_app.country_code),
       'registration_application','registration_application:'||v_app.id::text,
       'company_managed',v_app.applicant_user_id,1.0000,'pending');
  end if;

  if exists(
    select 1 from public.organization_network_company_links
    where organization_id=v_org and network_company_id<>v_company and link_status='active'
  ) then
    raise exception 'organization already linked to another network company' using errcode='23505';
  end if;

  select * into v_existing_claim
  from public.network_company_claims
  where network_company_id=v_company and status='approved'
  order by reviewed_at desc
  limit 1;

  if found and v_existing_claim.organization_id<>v_org then
    raise exception 'network company already has an approved claim by another organization' using errcode='23505';
  end if;

  update public.company_registration_applications
  set matched_network_company_id=v_company
  where id=v_app.id;

  insert into public.organization_network_company_links(
    organization_id,network_company_id,application_id,link_status,linked_by
  )
  values(v_org,v_company,v_app.id,'active',v_actor)
  returning id into v_link;

  perform private.p0a_append_registration_event(
    v_app.id,'network_company_linked',v_actor,'platform_superadmin','activated','activated',
    jsonb_build_object('organization_id',v_org,'network_company_id',v_company)
  );

  if v_existing_claim.id is not null then
    v_claim := v_existing_claim.id;
  else
    insert into public.network_company_claims(
      network_company_id,organization_id,requested_by,status,
      request_note,reviewed_by,reviewed_at,review_note
    )
    values(
      v_company,v_org,v_app.applicant_user_id,'approved',
      'Created by M7 registration bridge',v_actor,now(),
      'Approved as part of controlled registration bridge'
    )
    returning id into v_claim;

    update public.network_companies
    set claimed_status='claimed'
    where id=v_company;

    perform private.p0a_append_registration_event(
      v_app.id,'claim_created',v_actor,'platform_superadmin','activated','activated',
      jsonb_build_object(
        'claim_id',v_claim,'organization_id',v_org,
        'network_company_id',v_company,'claim_status','approved'
      )
    );
  end if;

  return jsonb_build_object(
    'application_id',v_app.id,'organization_id',v_org,'network_company_id',v_company,
    'link_id',v_link,'claim_id',v_claim,
    'created_network_company',(p_network_company_id is null and v_app.matched_network_company_id is null),
    'claim_status','approved',
    'verification_status',(select verification_status from public.network_companies where id=v_company),
    'idempotent_replay',false
  );
end;
$function$;

revoke all on function private.m7_bridge_registration_impl(uuid,uuid) from public,anon;
grant execute on function private.m7_bridge_registration_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.m7_bridge_registration(
  p_application_id uuid,
  p_network_company_id uuid default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.m7_bridge_registration_impl(p_application_id,p_network_company_id);
$function$;

revoke all on function public.m7_bridge_registration(uuid,uuid) from public,anon;
grant execute on function public.m7_bridge_registration(uuid,uuid) to authenticated,service_role;

comment on table public.organization_network_company_links is
  'M7 authoritative organization-to-Network-company bridge created from approved/activated registration. Raw table is platform-controlled.';
comment on function public.m7_registration_network_candidates(uuid) is
  'M7 Superadmin-only candidate matching for an activated registration application.';
comment on function public.m7_bridge_registration(uuid,uuid) is
  'M7 Superadmin-only idempotent registration bridge. Creates or links Network Company, creates approved claim, never verifies the company.';
