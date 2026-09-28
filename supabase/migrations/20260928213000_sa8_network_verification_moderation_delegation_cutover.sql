-- SA8 — Network Verification & Moderation Delegation Cutover.
--
-- Final operational delegation boundary for the Platform Control Plane.
-- Delegates evidence curation, Network verification, change-review moderation and
-- identity-resolution review through explicit SA2 capabilities.
--
-- Deliberate non-goals:
--   * no automatic company merge;
--   * no Platform Staff access to tenant-private Commercial Memory;
--   * no delegation of People & Access, global settings or tenant break-glass.

alter table public.platform_permissions
  drop constraint platform_permissions_area_check;

alter table public.platform_permissions
  add constraint platform_permissions_area_check
  check (area in (
    'platform',
    'registrations',
    'discovery',
    'claims',
    'knowledge',
    'network_trust',
    'tenant_access'
  ));

insert into public.platform_permissions (
  permission_key,area,action,risk_level,description,is_root_only
) values
  (
    'network_trust.read',
    'network_trust',
    'read',
    'low',
    'Read Network verification evidence, current verification state, change reviews and identity-resolution candidates.',
    false
  ),
  (
    'network_trust.assert',
    'network_trust',
    'assert',
    'medium',
    'Create append-only Platform evidence assertions from approved public or manual-review sources.',
    false
  ),
  (
    'network_trust.verify',
    'network_trust',
    'verify',
    'high',
    'Record a current Network verification outcome backed by a matching evidence assertion.',
    false
  ),
  (
    'network_trust.revoke',
    'network_trust',
    'revoke',
    'high',
    'Revoke or expire a current Network verification using evidence-backed history.',
    false
  ),
  (
    'network_trust.review_changes',
    'network_trust',
    'review_changes',
    'high',
    'Open and decide Network provenance/change-review conflicts without silently overwriting source evidence.',
    false
  ),
  (
    'network_trust.identity_refresh',
    'network_trust',
    'identity_refresh',
    'medium',
    'Refresh deterministic Network identity-resolution candidates. This never performs a merge.',
    false
  ),
  (
    'network_trust.identity_review',
    'network_trust',
    'identity_review',
    'high',
    'Confirm or dismiss an identity-resolution candidate. Confirmation is evidence only and never performs a merge.',
    false
  )
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=excluded.is_root_only;

insert into public.platform_roles(role_key,label,description,status,is_system_role)
values (
  'network_trust_admin',
  'Network Trust Admin',
  'Reviews public Network evidence, verification states, provenance conflicts and identity-resolution candidates without tenant-private access or automatic merges.',
  'active',
  true
)
on conflict (role_key) do update
set
  label=excluded.label,
  description=excluded.description,
  status='active',
  is_system_role=true;

-- Remove the overloaded "Verification" wording from the ownership-claim role
-- label while retaining the stable role_key for backwards compatibility.
update public.platform_roles
set
  label='Claims & Ownership Admin',
  description='Processes company ownership proofs and claim lifecycle decisions; this role does not control Network verification.'
where role_key='claims_verification_admin';

insert into public.platform_role_permissions(role_key,permission_key) values
  ('network_trust_admin','platform.console.access'),
  ('network_trust_admin','network_trust.read'),
  ('network_trust_admin','network_trust.assert'),
  ('network_trust_admin','network_trust.verify'),
  ('network_trust_admin','network_trust.revoke'),
  ('network_trust_admin','network_trust.review_changes'),
  ('network_trust_admin','network_trust.identity_refresh'),
  ('network_trust_admin','network_trust.identity_review'),
  ('platform_auditor','network_trust.read')
on conflict (role_key,permission_key) do nothing;

create or replace function private.sa8_record_network_trust_action(
  p_permission_key text,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language sql
security definer
set search_path=''
as $function$
  select private.sa2_record_platform_event(
    p_permission_key,
    p_action,
    p_entity_type,
    p_entity_id,
    null,
    p_before_state,
    p_after_state,
    p_reason,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('surface','network_trust')
  );
$function$;

revoke all on function private.sa8_record_network_trust_action(
  text,text,text,text,jsonb,jsonb,text,jsonb
) from public,anon,authenticated;

create or replace function private.sa8_network_trust_queue_impl(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),250);
begin
  perform private.require_platform_permission('network_trust.read');

  return jsonb_build_object(
    'counts',jsonb_build_object(
      'accepted_evidence',(
        select count(*)
        from public.network_data_assertions a
        where a.review_state='accepted'
          and a.entity_type in (
            'company','facility','facility_capability','company_certification'
          )
      ),
      'current_verifications',(
        select count(*) from public.network_verifications v where v.is_current
      ),
      'open_change_reviews',(
        select count(*) from public.network_change_reviews r where r.status='open'
      ),
      'open_identity_candidates',(
        select count(*)
        from public.network_identity_resolution_candidates c
        where c.status='open' and c.is_active
      ),
      'unverified_companies',(
        select count(*) from public.network_companies c
        where c.publication_status<>'archived'
          and c.verification_status='unverified'
      )
    ),
    'evidence',(
      select coalesce(jsonb_agg(to_jsonb(q) order by q.captured_at desc),'[]'::jsonb)
      from (
        select
          a.id as assertion_id,
          a.entity_type,
          case a.entity_type
            when 'company' then 'company'
            when 'facility' then 'facility'
            when 'facility_capability' then 'facility_capability'
            when 'company_certification' then 'company_certification'
          end as verification_scope,
          a.entity_id as target_id,
          case a.entity_type
            when 'company' then coalesce(
              (select c.legal_name from public.network_companies c where c.id=a.entity_id),
              a.entity_id::text
            )
            when 'facility' then coalesce(
              (select f.name from public.network_facilities f where f.id=a.entity_id),
              a.entity_id::text
            )
            when 'facility_capability' then coalesce(
              (
                select f.name || ' · ' || cap.display_name
                from public.network_facility_capabilities fc
                join public.network_facilities f on f.id=fc.facility_id
                join public.network_capabilities cap on cap.id=fc.capability_id
                where fc.id=a.entity_id
              ),
              a.entity_id::text
            )
            when 'company_certification' then coalesce(
              (
                select c.legal_name || ' · ' ||
                       coalesce(cert.certificate_identifier,cert.issuer,'certification')
                from public.network_company_certifications cert
                join public.network_companies c on c.id=cert.company_id
                where cert.id=a.entity_id
              ),
              a.entity_id::text
            )
            else a.entity_id::text
          end as target_label,
          a.field_path,
          a.asserted_value,
          a.source_type,
          a.source_reference,
          a.ownership_type,
          a.confidence,
          a.review_state,
          a.captured_at,
          case a.entity_type
            when 'company' then (
              select c.verification_status from public.network_companies c where c.id=a.entity_id
            )
            when 'facility' then (
              select f.verification_status from public.network_facilities f where f.id=a.entity_id
            )
            when 'facility_capability' then (
              select fc.verification_status from public.network_facility_capabilities fc where fc.id=a.entity_id
            )
            when 'company_certification' then (
              select cert.verification_status from public.network_company_certifications cert where cert.id=a.entity_id
            )
          end as target_verification_status
        from public.network_data_assertions a
        where a.review_state='accepted'
          and a.entity_type in (
            'company','facility','facility_capability','company_certification'
          )
        order by a.captured_at desc
        limit v_limit
      ) q
    ),
    'current_verifications',(
      select coalesce(jsonb_agg(to_jsonb(q) order by q.verified_at desc),'[]'::jsonb)
      from (
        select
          v.id as verification_id,
          v.scope,
          coalesce(v.company_id,v.facility_id,v.facility_capability_id,v.company_certification_id) as target_id,
          case v.scope
            when 'company' then coalesce(c.legal_name,v.company_id::text)
            when 'facility' then coalesce(f.name,v.facility_id::text)
            when 'facility_capability' then coalesce(
              fcf.name || ' · ' || cap.display_name,
              v.facility_capability_id::text
            )
            when 'company_certification' then coalesce(
              cc.legal_name || ' · ' ||
              coalesce(cert.certificate_identifier,cert.issuer,'certification'),
              v.company_certification_id::text
            )
          end as target_label,
          v.status,
          v.evidence_assertion_id,
          a.field_path as evidence_field_path,
          a.source_type as evidence_source_type,
          a.source_reference as evidence_source_reference,
          v.verified_by,
          v.verified_at,
          v.expires_at,
          v.note
        from public.network_verifications v
        left join public.network_data_assertions a on a.id=v.evidence_assertion_id
        left join public.network_companies c
          on v.scope='company' and c.id=v.company_id
        left join public.network_facilities f
          on v.scope='facility' and f.id=v.facility_id
        left join public.network_facility_capabilities fc
          on v.scope='facility_capability' and fc.id=v.facility_capability_id
        left join public.network_facilities fcf on fcf.id=fc.facility_id
        left join public.network_capabilities cap on cap.id=fc.capability_id
        left join public.network_company_certifications cert
          on v.scope='company_certification' and cert.id=v.company_certification_id
        left join public.network_companies cc on cc.id=cert.company_id
        where v.is_current
        order by v.verified_at desc
        limit v_limit
      ) q
    ),
    'change_reviews',(
      select coalesce(jsonb_agg(to_jsonb(q) order by q.opened_at desc),'[]'::jsonb)
      from (
        select
          r.id as review_id,
          r.network_company_id,
          c.legal_name as company_legal_name,
          r.assertion_id,
          r.field_path,
          r.previous_value,
          r.proposed_value,
          r.status,
          r.opened_by,
          r.opened_at,
          r.reviewed_by,
          r.reviewed_at,
          r.review_note,
          a.source_type,
          a.source_reference,
          a.ownership_type,
          a.review_state as assertion_review_state
        from public.network_change_reviews r
        join public.network_companies c on c.id=r.network_company_id
        join public.network_data_assertions a on a.id=r.assertion_id
        where r.status='open'
        order by r.opened_at desc
        limit v_limit
      ) q
    ),
    'identity_candidates',(
      select coalesce(jsonb_agg(to_jsonb(q) order by q.match_score desc,q.last_evaluated_at desc),'[]'::jsonb)
      from (
        select
          i.id as candidate_id,
          i.company_a_id,
          a.legal_name as company_a_legal_name,
          a.website_domain as company_a_domain,
          i.company_b_id,
          b.legal_name as company_b_legal_name,
          b.website_domain as company_b_domain,
          i.signals,
          i.match_score,
          i.status,
          i.is_active,
          i.generated_at,
          i.last_evaluated_at,
          i.reviewed_by,
          i.reviewed_at,
          i.review_note
        from public.network_identity_resolution_candidates i
        join public.network_companies a on a.id=i.company_a_id
        join public.network_companies b on b.id=i.company_b_id
        where i.is_active
        order by i.match_score desc,i.last_evaluated_at desc
        limit v_limit
      ) q
    )
  );
end;
$function$;

revoke all on function private.sa8_network_trust_queue_impl(integer)
  from public,anon,authenticated;
grant execute on function private.sa8_network_trust_queue_impl(integer)
  to authenticated,service_role;

create or replace function public.sa8_network_trust_queue(
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.sa8_network_trust_queue_impl(p_limit);
$function$;

revoke all on function public.sa8_network_trust_queue(integer)
  from public,anon;
grant execute on function public.sa8_network_trust_queue(integer)
  to authenticated,service_role;

create or replace function private.m4_create_data_assertion_impl(
  p_entity_type text,
  p_entity_id uuid,
  p_field_path text,
  p_asserted_value jsonb,
  p_source_type text,
  p_source_reference text,
  p_ownership_type text,
  p_confidence numeric default null,
  p_review_state text default 'pending'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_id uuid;
begin
  perform private.require_platform_permission('network_trust.assert');

  if not private.is_platform_superadmin() then
    if p_source_type not in ('platform_curated','public_web','document','manual_review') then
      raise exception 'delegated Network Trust evidence source type is not allowed'
        using errcode='42501';
    end if;

    if p_ownership_type not in ('platform_curated','platform_verified') then
      raise exception 'delegated Network Trust ownership type is not allowed'
        using errcode='42501';
    end if;

    if p_review_state not in ('pending','accepted') then
      raise exception 'delegated Network Trust assertion review state is not allowed'
        using errcode='42501';
    end if;
  end if;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,asserted_by,
    confidence,review_state
  )
  values(
    p_entity_type,p_entity_id,btrim(p_field_path),p_asserted_value,
    p_source_type,btrim(p_source_reference),p_ownership_type,v_user_id,
    p_confidence,p_review_state
  )
  returning id into v_id;

  perform private.sa8_record_network_trust_action(
    'network_trust.assert',
    'network_assertion_created',
    'network_data_assertion',
    v_id::text,
    null,
    jsonb_build_object(
      'entity_type',p_entity_type,
      'entity_id',p_entity_id,
      'field_path',btrim(p_field_path),
      'source_type',p_source_type,
      'ownership_type',p_ownership_type,
      'review_state',p_review_state,
      'confidence',p_confidence
    ),
    null,
    jsonb_build_object('source_reference',btrim(p_source_reference))
  );

  return v_id;
end;
$function$;

revoke all on function private.m4_create_data_assertion_impl(
  text,uuid,text,jsonb,text,text,text,numeric,text
) from public,anon;
grant execute on function private.m4_create_data_assertion_impl(
  text,uuid,text,jsonb,text,text,text,numeric,text
) to authenticated,service_role;

create or replace function private.m4_record_verification_impl(
  p_scope text,
  p_target_id uuid,
  p_status text,
  p_evidence_assertion_id uuid,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_id uuid;
  v_note text;
  v_expected_entity_type text;
  v_evidence public.network_data_assertions%rowtype;
  v_permission text;
  v_before jsonb;
begin
  if p_status in ('revoked','expired') then
    v_permission:='network_trust.revoke';
    perform private.require_platform_permission('network_trust.revoke');
  else
    v_permission:='network_trust.verify';
    perform private.require_platform_permission('network_trust.verify');
  end if;

  if p_scope not in ('company','facility','facility_capability','company_certification') then
    raise exception 'invalid verification scope' using errcode='22023';
  end if;
  if p_status not in ('pending','verified','rejected','expired','revoked') then
    raise exception 'invalid verification status' using errcode='22023';
  end if;
  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'verification expiry must be in the future' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'verification note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_evidence
  from public.network_data_assertions
  where id=p_evidence_assertion_id;

  if not found then
    raise exception 'evidence assertion not found' using errcode='P0002';
  end if;

  if v_evidence.review_state<>'accepted' then
    raise exception 'accepted evidence assertion required for Network verification'
      using errcode='23514';
  end if;

  v_expected_entity_type:=case p_scope
    when 'company' then 'company'
    when 'facility' then 'facility'
    when 'facility_capability' then 'facility_capability'
    when 'company_certification' then 'company_certification'
  end;

  if v_evidence.entity_type<>v_expected_entity_type
     or v_evidence.entity_id<>p_target_id then
    raise exception 'evidence assertion target does not match verification target'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'scope',p_scope,
    'target_id',p_target_id,
    'current_verification',(
      select to_jsonb(x)
      from (
        select v.id,v.status,v.evidence_assertion_id,v.verified_by,
               v.verified_at,v.expires_at,v.note
        from public.network_verifications v
        where v.is_current
          and (
            (p_scope='company' and v.scope='company' and v.company_id=p_target_id)
            or (p_scope='facility' and v.scope='facility' and v.facility_id=p_target_id)
            or (
              p_scope='facility_capability'
              and v.scope='facility_capability'
              and v.facility_capability_id=p_target_id
            )
            or (
              p_scope='company_certification'
              and v.scope='company_certification'
              and v.company_certification_id=p_target_id
            )
          )
        limit 1
      ) x
    )
  );

  if p_scope='company' then
    if not exists(select 1 from public.network_companies where id=p_target_id) then
      raise exception 'company target not found' using errcode='P0002';
    end if;

    update public.network_verifications
    set is_current=false
    where scope='company' and company_id=p_target_id and is_current;

    insert into public.network_verifications(
      scope,company_id,status,evidence_assertion_id,verified_by,expires_at,note
    )
    values(
      'company',p_target_id,p_status,p_evidence_assertion_id,
      v_user_id,p_expires_at,v_note
    )
    returning id into v_id;

    update public.network_companies
    set verification_status=p_status
    where id=p_target_id;

  elsif p_scope='facility' then
    if not exists(select 1 from public.network_facilities where id=p_target_id) then
      raise exception 'facility target not found' using errcode='P0002';
    end if;

    update public.network_verifications
    set is_current=false
    where scope='facility' and facility_id=p_target_id and is_current;

    insert into public.network_verifications(
      scope,facility_id,status,evidence_assertion_id,verified_by,expires_at,note
    )
    values(
      'facility',p_target_id,p_status,p_evidence_assertion_id,
      v_user_id,p_expires_at,v_note
    )
    returning id into v_id;

    update public.network_facilities
    set verification_status=p_status
    where id=p_target_id;

  elsif p_scope='facility_capability' then
    if not exists(
      select 1 from public.network_facility_capabilities where id=p_target_id
    ) then
      raise exception 'facility capability target not found' using errcode='P0002';
    end if;

    update public.network_verifications
    set is_current=false
    where scope='facility_capability'
      and facility_capability_id=p_target_id
      and is_current;

    insert into public.network_verifications(
      scope,facility_capability_id,status,evidence_assertion_id,
      verified_by,expires_at,note
    )
    values(
      'facility_capability',p_target_id,p_status,p_evidence_assertion_id,
      v_user_id,p_expires_at,v_note
    )
    returning id into v_id;

    update public.network_facility_capabilities
    set verification_status=p_status
    where id=p_target_id;

  else
    if not exists(
      select 1 from public.network_company_certifications where id=p_target_id
    ) then
      raise exception 'company certification target not found' using errcode='P0002';
    end if;

    update public.network_verifications
    set is_current=false
    where scope='company_certification'
      and company_certification_id=p_target_id
      and is_current;

    insert into public.network_verifications(
      scope,company_certification_id,status,evidence_assertion_id,
      verified_by,expires_at,note
    )
    values(
      'company_certification',p_target_id,p_status,p_evidence_assertion_id,
      v_user_id,p_expires_at,v_note
    )
    returning id into v_id;

    update public.network_company_certifications
    set verification_status=p_status
    where id=p_target_id;
  end if;

  perform private.sa8_record_network_trust_action(
    v_permission,
    case p_status
      when 'verified' then 'network_verification_verified'
      when 'rejected' then 'network_verification_rejected'
      when 'pending' then 'network_verification_pending'
      when 'expired' then 'network_verification_expired'
      else 'network_verification_revoked'
    end,
    'network_verification',
    v_id::text,
    v_before,
    jsonb_build_object(
      'scope',p_scope,
      'target_id',p_target_id,
      'status',p_status,
      'evidence_assertion_id',p_evidence_assertion_id,
      'expires_at',p_expires_at
    ),
    v_note,
    jsonb_build_object(
      'scope',p_scope,
      'target_id',p_target_id,
      'evidence_assertion_id',p_evidence_assertion_id
    )
  );

  return v_id;
end;
$function$;

revoke all on function private.m4_record_verification_impl(
  text,uuid,text,uuid,timestamptz,text
) from public,anon;
grant execute on function private.m4_record_verification_impl(
  text,uuid,text,uuid,timestamptz,text
) to authenticated,service_role;

create or replace function private.m4_open_change_review_impl(
  p_network_company_id uuid,
  p_assertion_id uuid,
  p_field_path text,
  p_previous_value jsonb,
  p_proposed_value jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_id uuid;
begin
  perform private.require_platform_permission('network_trust.review_changes');

  if not exists(
    select 1 from public.network_companies where id=p_network_company_id
  ) then
    raise exception 'network company not found' using errcode='P0002';
  end if;

  if not exists(
    select 1
    from public.network_data_assertions a
    where a.id=p_assertion_id
      and a.entity_type='company'
      and a.entity_id=p_network_company_id
  ) then
    raise exception 'matching company assertion required' using errcode='22023';
  end if;

  insert into public.network_change_reviews(
    network_company_id,assertion_id,field_path,
    previous_value,proposed_value,opened_by
  )
  values(
    p_network_company_id,p_assertion_id,btrim(p_field_path),
    p_previous_value,p_proposed_value,v_user_id
  )
  returning id into v_id;

  perform private.sa8_record_network_trust_action(
    'network_trust.review_changes',
    'network_change_review_opened',
    'network_change_review',
    v_id::text,
    null,
    jsonb_build_object(
      'network_company_id',p_network_company_id,
      'assertion_id',p_assertion_id,
      'field_path',btrim(p_field_path)
    ),
    null,
    jsonb_build_object('network_company_id',p_network_company_id)
  );

  return v_id;
end;
$function$;

revoke all on function private.m4_open_change_review_impl(
  uuid,uuid,text,jsonb,jsonb
) from public,anon;
grant execute on function private.m4_open_change_review_impl(
  uuid,uuid,text,jsonb,jsonb
) to authenticated,service_role;

create or replace function private.m4_decide_change_review_impl(
  p_review_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_row public.network_change_reviews%rowtype;
  v_note text;
begin
  perform private.require_platform_permission('network_trust.review_changes');

  if p_decision not in ('accepted','rejected','superseded') then
    raise exception 'invalid review decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.network_change_reviews
  where id=p_review_id
  for update;

  if not found then
    raise exception 'change review not found' using errcode='P0002';
  end if;

  if v_row.status<>'open' then
    raise exception 'only open change reviews can be decided' using errcode='22023';
  end if;

  update public.network_change_reviews
  set
    status=p_decision,
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=v_note
  where id=p_review_id
  returning * into v_row;

  perform private.sa8_record_network_trust_action(
    'network_trust.review_changes',
    case p_decision
      when 'accepted' then 'network_change_review_accepted'
      when 'rejected' then 'network_change_review_rejected'
      else 'network_change_review_superseded'
    end,
    'network_change_review',
    v_row.id::text,
    jsonb_build_object('status','open'),
    jsonb_build_object(
      'status',v_row.status,
      'network_company_id',v_row.network_company_id,
      'assertion_id',v_row.assertion_id,
      'field_path',v_row.field_path
    ),
    v_note,
    jsonb_build_object('network_company_id',v_row.network_company_id)
  );

  return jsonb_build_object(
    'review_id',v_row.id,
    'status',v_row.status,
    'network_company_id',v_row.network_company_id,
    'assertion_id',v_row.assertion_id,
    'reviewed_by',v_row.reviewed_by,
    'reviewed_at',v_row.reviewed_at,
    'automatic_overwrite_performed',false
  );
end;
$function$;

revoke all on function private.m4_decide_change_review_impl(uuid,text,text)
  from public,anon;
grant execute on function private.m4_decide_change_review_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function private.m5_refresh_identity_candidates_impl()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_upserted integer:=0;
  v_active integer:=0;
begin
  perform private.require_platform_permission('network_trust.identity_refresh');

  update public.network_identity_resolution_candidates
  set is_active=false,last_evaluated_at=now()
  where is_active=true;

  with pair_signals as (
    select
      a.id as company_a_id,
      b.id as company_b_id,
      array_remove(array[
        case
          when a.country_code=b.country_code
           and nullif(lower(btrim(a.vat_id)),'') is not null
           and lower(btrim(a.vat_id))=lower(btrim(b.vat_id))
          then 'country_vat_exact'
        end,
        case
          when a.country_code=b.country_code
           and nullif(lower(btrim(a.registration_id)),'') is not null
           and lower(btrim(a.registration_id))=lower(btrim(b.registration_id))
          then 'country_registration_exact'
        end,
        case
          when nullif(lower(btrim(a.website_domain)),'') is not null
           and lower(btrim(a.website_domain))=lower(btrim(b.website_domain))
          then 'website_domain_exact'
        end,
        case
          when a.country_code=b.country_code
           and a.normalized_legal_name=b.normalized_legal_name
          then 'country_normalized_legal_name_exact'
        end
      ],null)::text[] as signals,
      greatest(
        case
          when a.country_code=b.country_code
           and nullif(lower(btrim(a.vat_id)),'') is not null
           and lower(btrim(a.vat_id))=lower(btrim(b.vat_id))
          then 1.0000 else 0 end,
        case
          when a.country_code=b.country_code
           and nullif(lower(btrim(a.registration_id)),'') is not null
           and lower(btrim(a.registration_id))=lower(btrim(b.registration_id))
          then 0.9800 else 0 end,
        case
          when nullif(lower(btrim(a.website_domain)),'') is not null
           and lower(btrim(a.website_domain))=lower(btrim(b.website_domain))
          then 0.8500 else 0 end,
        case
          when a.country_code=b.country_code
           and a.normalized_legal_name=b.normalized_legal_name
          then 0.7500 else 0 end
      )::numeric(5,4) as match_score
    from public.network_companies a
    join public.network_companies b on a.id<b.id
    where a.publication_status<>'archived'
      and b.publication_status<>'archived'
  ),
  matches as (
    select
      company_a_id,
      company_b_id,
      to_jsonb(signals) as signals,
      match_score
    from pair_signals
    where cardinality(signals)>0
      and match_score>0
  ),
  upserted as (
    insert into public.network_identity_resolution_candidates(
      company_a_id,company_b_id,signals,match_score,status,is_active,
      generated_at,last_evaluated_at
    )
    select
      company_a_id,company_b_id,signals,match_score,'open',true,now(),now()
    from matches
    on conflict (company_a_id,company_b_id)
    do update set
      signals=excluded.signals,
      match_score=excluded.match_score,
      is_active=true,
      last_evaluated_at=now()
    returning 1
  )
  select count(*) into v_upserted from upserted;

  select count(*) into v_active
  from public.network_identity_resolution_candidates
  where is_active=true;

  perform private.sa8_record_network_trust_action(
    'network_trust.identity_refresh',
    'network_identity_candidates_refreshed',
    'network_identity_resolution_batch',
    null,
    null,
    jsonb_build_object(
      'upserted_candidates',v_upserted,
      'active_candidates',v_active,
      'automatic_merge_performed',false
    ),
    null,
    jsonb_build_object('automatic_merge_performed',false)
  );

  return jsonb_build_object(
    'upserted_candidates',v_upserted,
    'active_candidates',v_active,
    'automatic_merge_performed',false
  );
end;
$function$;

revoke all on function private.m5_refresh_identity_candidates_impl()
  from public,anon;
grant execute on function private.m5_refresh_identity_candidates_impl()
  to authenticated,service_role;

create or replace function private.m5_review_identity_candidate_impl(
  p_candidate_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_row public.network_identity_resolution_candidates%rowtype;
  v_note text;
begin
  perform private.require_platform_permission('network_trust.identity_review');

  if p_decision not in ('confirmed_match','dismissed') then
    raise exception 'invalid identity candidate decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.network_identity_resolution_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'identity candidate not found' using errcode='P0002';
  end if;

  if v_row.status<>'open' then
    raise exception 'only open identity candidates can be reviewed'
      using errcode='22023';
  end if;

  update public.network_identity_resolution_candidates
  set
    status=p_decision,
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=v_note
  where id=p_candidate_id
  returning * into v_row;

  perform private.sa8_record_network_trust_action(
    'network_trust.identity_review',
    case p_decision
      when 'confirmed_match' then 'network_identity_match_confirmed'
      else 'network_identity_candidate_dismissed'
    end,
    'network_identity_resolution_candidate',
    v_row.id::text,
    jsonb_build_object('status','open','is_active',v_row.is_active),
    jsonb_build_object(
      'status',v_row.status,
      'is_active',v_row.is_active,
      'company_a_id',v_row.company_a_id,
      'company_b_id',v_row.company_b_id,
      'match_score',v_row.match_score,
      'merge_performed',false
    ),
    v_note,
    jsonb_build_object('automatic_merge_performed',false)
  );

  return jsonb_build_object(
    'candidate_id',v_row.id,
    'company_a_id',v_row.company_a_id,
    'company_b_id',v_row.company_b_id,
    'status',v_row.status,
    'merge_performed',false
  );
end;
$function$;

revoke all on function private.m5_review_identity_candidate_impl(uuid,text,text)
  from public,anon;
grant execute on function private.m5_review_identity_candidate_impl(uuid,text,text)
  to authenticated,service_role;

comment on function public.m4_create_data_assertion(
  text,uuid,text,jsonb,text,text,text,numeric,text
) is
  'SA8 capability-authorized append-only Network evidence assertion. Delegated staff sources are restricted to public/platform/manual-review evidence.';

comment on function public.m4_record_verification(
  text,uuid,text,uuid,timestamptz,text
) is
  'SA8 capability-authorized Network verification state transition backed by an accepted matching evidence assertion.';

comment on function public.m4_decide_change_review(uuid,text,text) is
  'SA8 capability-authorized provenance conflict decision. Acceptance records the decision but performs no silent source overwrite.';

comment on function public.m5_review_identity_candidate(uuid,text,text) is
  'SA8 capability-authorized identity candidate review. confirmed_match is evidence only and never performs an automatic company merge.';

do $sa8$
begin
  if not exists (
    select 1 from public.platform_roles
    where role_key='network_trust_admin' and status='active'
  ) then
    raise exception 'SA8 Network Trust role not installed';
  end if;

  if (
    select count(*)
    from public.platform_role_permissions
    where role_key='network_trust_admin'
      and permission_key like 'network_trust.%'
  )<>7 then
    raise exception 'SA8 Network Trust role capability set incomplete';
  end if;

  if exists (
    select 1
    from public.platform_role_permissions rp
    join public.platform_permissions p on p.permission_key=rp.permission_key
    where rp.role_key='network_trust_admin'
      and p.is_root_only
  ) then
    raise exception 'SA8 Network Trust role must not receive root-only permissions';
  end if;
end
$sa8$;
