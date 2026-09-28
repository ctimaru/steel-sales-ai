-- SA4 — Registration Delegation Cutover.
--
-- First operational Platform Staff cutover. Registration Admin and read-only
-- staff with registrations.read can enter the registration surface, while
-- every mutation is enforced by its dedicated SA1 permission at Postgres.
-- Discovery, Claims, Knowledge and People & Access are not delegated here.

alter table public.platform_registration_events
  drop constraint platform_registration_events_actor_type_check,
  drop constraint platform_registration_events_actor_integrity_check;

alter table public.platform_registration_events
  add constraint platform_registration_events_actor_type_check
    check (actor_type in (
      'applicant',
      'platform_superadmin',
      'platform_owner',
      'platform_staff',
      'system',
      'service'
    )),
  add constraint platform_registration_events_actor_integrity_check
    check (
      (
        actor_type in (
          'applicant',
          'platform_superadmin',
          'platform_owner',
          'platform_staff'
        )
        and actor_user_id is not null
      )
      or actor_type in ('system','service')
    );

create or replace function private.sa4_platform_actor_type()
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when private.is_platform_superadmin() then 'platform_owner'::text
    when private.has_platform_permission('platform.console.access') then 'platform_staff'::text
    else null::text
  end;
$function$;

revoke all on function private.sa4_platform_actor_type()
  from public,anon,authenticated;

create or replace function private.sa4_record_registration_action(
  p_permission_key text,
  p_action text,
  p_application_id uuid,
  p_from_status text,
  p_to_status text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
begin
  return private.sa2_record_platform_event(
    p_permission_key,
    p_action,
    'registration_application',
    p_application_id::text,
    null,
    jsonb_build_object('status',p_from_status),
    jsonb_build_object('status',p_to_status),
    p_reason,
    jsonb_build_object('surface','registrations')
  );
end;
$function$;

revoke all on function private.sa4_record_registration_action(text,text,uuid,text,text,text)
  from public,anon,authenticated;

create or replace function private.p0a_admin_registration_queue_impl(
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_rows jsonb;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.read');

  if p_status is not null and p_status not in (
    'draft',
    'submitted',
    'email_verification_pending',
    'pending_review',
    'needs_information',
    'approved',
    'rejected',
    'withdrawn',
    'activated',
    'suspended'
  ) then
    raise exception 'invalid registration status filter'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'applicant_user_id', a.applicant_user_id,
        'applicant_email', a.applicant_email_snapshot,
        'legal_name', a.legal_name,
        'trading_name', a.trading_name,
        'country_code', a.country_code,
        'vat_id', a.vat_id,
        'primary_company_type', a.primary_company_type,
        'application_status', a.application_status,
        'submitted_at', a.submitted_at,
        'reviewed_at', a.reviewed_at,
        'reviewed_by', a.reviewed_by,
        'activated_organization_id', a.activated_organization_id,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      )
      order by
        case
          when a.application_status = 'pending_review' then 0
          when a.application_status = 'needs_information' then 1
          when a.application_status = 'approved' then 2
          else 3
        end,
        a.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.company_registration_applications a
  where p_status is null or a.application_status = p_status;

  return jsonb_build_object(
    'status_filter', p_status,
    'count', jsonb_array_length(v_rows),
    'applications', v_rows
  );
end;
$function$;

create or replace function private.p0a_admin_registration_detail_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_application jsonb;
  v_events jsonb;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.read');

  select to_jsonb(a)
    into v_application
  from public.company_registration_applications a
  where a.id = p_application_id;

  if v_application is null then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'actor_user_id', e.actor_user_id,
        'actor_type', e.actor_type,
        'from_status', e.from_status,
        'to_status', e.to_status,
        'metadata', e.metadata,
        'occurred_at', e.occurred_at
      )
      order by e.occurred_at asc, e.id asc
    ),
    '[]'::jsonb
  )
  into v_events
  from public.platform_registration_events e
  where e.application_id = p_application_id;

  return jsonb_build_object(
    'application', v_application,
    'events', v_events
  );
end;
$function$;

create or replace function private.p0a_request_registration_information_impl(
  p_application_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.company_registration_applications%rowtype;
  v_note text;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.request_information');

  v_note := nullif(btrim(p_note), '');
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'information request note exceeds 1000 characters'
      using errcode = '22023';
  end if;

  select *
    into v_row
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_row.application_status <> 'pending_review' then
    raise exception 'information can only be requested from pending_review'
      using errcode = '22023';
  end if;

  update public.company_registration_applications
  set
    application_status = 'needs_information',
    reviewed_at = now(),
    reviewed_by = v_user_id,
    rejection_reason_code = null,
    rejection_note = null
  where id = p_application_id
  returning * into v_row;

  perform private.p0a_append_registration_event(
    p_application_id,
    'information_requested',
    v_user_id,
    private.sa4_platform_actor_type(),
    'pending_review',
    'needs_information',
    case
      when v_note is null then '{}'::jsonb
      else jsonb_build_object('note', v_note)
    end
  );

  perform private.sa4_record_registration_action(
    'registrations.request_information',
    'registration_information_requested',
    p_application_id,
    'pending_review',
    'needs_information',
    v_note
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at
  );
end;
$function$;

create or replace function private.p0a_approve_registration_application_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.company_registration_applications%rowtype;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.approve');

  select *
    into v_row
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_row.application_status <> 'pending_review' then
    raise exception 'application can only be approved from pending_review'
      using errcode = '22023';
  end if;

  if v_row.email_verified_at is null then
    raise exception 'verified email required before approval'
      using errcode = '22023';
  end if;

  update public.company_registration_applications
  set
    application_status = 'approved',
    reviewed_at = now(),
    reviewed_by = v_user_id,
    rejection_reason_code = null,
    rejection_note = null
  where id = p_application_id
  returning * into v_row;

  perform private.p0a_append_registration_event(
    p_application_id,
    'application_approved',
    v_user_id,
    private.sa4_platform_actor_type(),
    'pending_review',
    'approved',
    '{}'::jsonb
  );

  perform private.sa4_record_registration_action(
    'registrations.approve',
    'registration_application_approved',
    p_application_id,
    'pending_review',
    'approved',
    null
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at,
    'reviewed_by', v_row.reviewed_by
  );
end;
$function$;

create or replace function private.p0a_reject_registration_application_impl(
  p_application_id uuid,
  p_reason_code text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.company_registration_applications%rowtype;
  v_note text;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.reject');

  if p_reason_code not in (
    'duplicate_application',
    'unverifiable_identity',
    'incomplete_information',
    'unsupported_business',
    'abuse_or_spam',
    'other'
  ) then
    raise exception 'invalid rejection reason code'
      using errcode = '22023';
  end if;

  v_note := nullif(btrim(p_note), '');
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'rejection note exceeds 1000 characters'
      using errcode = '22023';
  end if;

  select *
    into v_row
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_row.application_status <> 'pending_review' then
    raise exception 'application can only be rejected from pending_review'
      using errcode = '22023';
  end if;

  update public.company_registration_applications
  set
    application_status = 'rejected',
    reviewed_at = now(),
    reviewed_by = v_user_id,
    rejection_reason_code = p_reason_code,
    rejection_note = v_note
  where id = p_application_id
  returning * into v_row;

  perform private.p0a_append_registration_event(
    p_application_id,
    'application_rejected',
    v_user_id,
    private.sa4_platform_actor_type(),
    'pending_review',
    'rejected',
    jsonb_build_object(
      'reason_code', p_reason_code,
      'note_present', v_note is not null
    )
  );

  perform private.sa4_record_registration_action(
    'registrations.reject',
    'registration_application_rejected',
    p_application_id,
    'pending_review',
    'rejected',
    coalesce(v_note,p_reason_code)
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at,
    'reviewed_by', v_row.reviewed_by,
    'rejection_reason_code', v_row.rejection_reason_code
  );
end;
$function$;

create or replace function private.p0a_activate_registration_application_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid;
  v_app public.company_registration_applications%rowtype;
  v_organization_id uuid;
  v_slug_base text;
  v_slug text;
  v_is_default boolean;
  v_existing_membership boolean;
begin
  v_actor_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.activate');

  select *
    into v_app
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_app.application_status = 'activated' then
    if v_app.activated_organization_id is null then
      raise exception 'activated application has no organization'
        using errcode = '23514';
    end if;

    return jsonb_build_object(
      'application_id', v_app.id,
      'status', v_app.application_status,
      'organization_id', v_app.activated_organization_id,
      'idempotent_replay', true
    );
  end if;

  if v_app.application_status <> 'approved' then
    raise exception 'application can only be activated from approved'
      using errcode = '22023';
  end if;

  if v_app.activated_organization_id is not null then
    raise exception 'approved application already references an organization'
      using errcode = '23514';
  end if;

  perform private.p0a_append_registration_event(
    p_application_id,
    'activation_started',
    v_actor_user_id,
    private.sa4_platform_actor_type(),
    'approved',
    'approved',
    '{}'::jsonb
  );

  v_slug_base := regexp_replace(
    lower(btrim(v_app.legal_name)),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  v_slug_base := trim(both '-' from v_slug_base);

  if v_slug_base = '' then
    v_slug_base := 'company';
  end if;

  v_slug := left(v_slug_base, 48) || '-' || left(replace(v_app.id::text, '-', ''), 12);

  insert into public.organizations (
    name,
    slug,
    created_by,
    industry,
    country_code,
    onboarding_status,
    source_preferences,
    onboarding_updated_by
  )
  values (
    btrim(v_app.legal_name),
    v_slug,
    v_app.applicant_user_id,
    'steel',
    v_app.country_code,
    'not_started',
    '{}'::text[],
    v_app.applicant_user_id
  )
  returning id into v_organization_id;

  perform private.p0a_append_registration_event(
    p_application_id,
    'organization_created',
    v_actor_user_id,
    private.sa4_platform_actor_type(),
    'approved',
    'approved',
    jsonb_build_object(
      'organization_id', v_organization_id,
      'slug', v_slug
    )
  );

  select exists (
    select 1
    from public.organization_memberships om
    where om.user_id = v_app.applicant_user_id
      and om.status = 'active'
      and om.is_default
  )
  into v_existing_membership;

  v_is_default := not v_existing_membership;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    is_default,
    business_role
  )
  values (
    v_organization_id,
    v_app.applicant_user_id,
    'admin',
    'active',
    v_is_default,
    null
  )
  on conflict (organization_id, user_id) do update
  set
    role = 'admin',
    status = 'active',
    updated_at = now();

  update public.company_registration_applications
  set
    application_status = 'activated',
    activated_organization_id = v_organization_id,
    reviewed_at = coalesce(reviewed_at, now()),
    reviewed_by = coalesce(reviewed_by, v_actor_user_id)
  where id = p_application_id
  returning * into v_app;

  perform private.p0a_append_registration_event(
    p_application_id,
    'activation_completed',
    v_actor_user_id,
    private.sa4_platform_actor_type(),
    'approved',
    'activated',
    jsonb_build_object(
      'organization_id', v_organization_id,
      'membership_role', 'admin',
      'membership_status', 'active',
      'is_default', v_is_default,
      'network_link_status', 'pending_m2_m4'
    )
  );

  perform private.sa4_record_registration_action(
    'registrations.activate',
    'registration_workspace_activated',
    p_application_id,
    'approved',
    'activated',
    null
  );

  return jsonb_build_object(
    'application_id', v_app.id,
    'status', v_app.application_status,
    'organization_id', v_organization_id,
    'membership_role', 'admin',
    'membership_status', 'active',
    'is_default', v_is_default,
    'network_link_status', 'pending_m2_m4',
    'idempotent_replay', false
  );
end;
$function$;

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
  perform private.require_platform_permission('registrations.bridge_network');

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
  perform private.require_platform_permission('registrations.bridge_network');

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
    v_app.id,'network_company_linked',v_actor,private.sa4_platform_actor_type(),'activated','activated',
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
      v_app.id,'claim_created',v_actor,private.sa4_platform_actor_type(),'activated','activated',
      jsonb_build_object(
        'claim_id',v_claim,'organization_id',v_org,
        'network_company_id',v_company,'claim_status','approved'
      )
    );
  end if;

  perform private.sa4_record_registration_action(
    'registrations.bridge_network',
    'registration_network_bridge_completed',
    p_application_id,
    'activated',
    'activated',
    case
      when p_network_company_id is null then 'created_or_resolved_network_company'
      else 'linked_existing_network_company'
    end
  );

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

comment on function public.p0a_admin_registration_queue(text) is
  'SA4 registration queue. Requires registrations.read; Platform Owner retains implicit access.';
comment on function public.p0a_admin_registration_detail(uuid) is
  'SA4 registration detail and audit timeline. Requires registrations.read.';
comment on function public.p0a_request_registration_information(uuid,text) is
  'SA4 registration information request. Requires registrations.request_information.';
comment on function public.p0a_approve_registration_application(uuid) is
  'SA4 registration approval. Requires registrations.approve.';
comment on function public.p0a_reject_registration_application(uuid,text,text) is
  'SA4 registration rejection. Requires registrations.reject.';
comment on function public.p0a_activate_registration_application(uuid) is
  'SA4 organization activation. Requires registrations.activate.';
comment on function public.m7_registration_network_candidates(uuid) is
  'SA4 registration bridge candidate matching. Requires registrations.bridge_network.';
comment on function public.m7_bridge_registration(uuid,uuid) is
  'SA4 controlled registration bridge. Requires registrations.bridge_network.';

do $sa4$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in (
        'p0a_admin_registration_queue_impl',
        'p0a_admin_registration_detail_impl',
        'p0a_request_registration_information_impl',
        'p0a_approve_registration_application_impl',
        'p0a_reject_registration_application_impl',
        'p0a_activate_registration_application_impl',
        'm7_application_candidates_impl',
        'm7_bridge_registration_impl'
      )
      and pg_get_functiondef(p.oid) like '%not private.is_platform_superadmin()%'
  ) then
    raise exception 'SA4 registration cutover left a direct Superadmin gate';
  end if;

  if (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in (
        'p0a_admin_registration_queue_impl',
        'p0a_admin_registration_detail_impl',
        'p0a_request_registration_information_impl',
        'p0a_approve_registration_application_impl',
        'p0a_reject_registration_application_impl',
        'p0a_activate_registration_application_impl',
        'm7_application_candidates_impl',
        'm7_bridge_registration_impl'
      )
      and pg_get_functiondef(p.oid) like '%require_platform_permission%'
  ) <> 8 then
    raise exception 'SA4 expected all eight registration functions to require explicit permissions';
  end if;
end
$sa4$;
