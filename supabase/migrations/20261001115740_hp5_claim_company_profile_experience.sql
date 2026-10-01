-- HP5 — Claim Company Profile Experience.
--
-- Adds a governed claim preflight and hardens ownership proof so a shared
-- corporate domain cannot automatically prove ownership of a specific legal
-- entity. Claim control and Network verification remain separate states.

create unique index if not exists network_company_claims_one_active_org_company_uidx
on public.network_company_claims (network_company_id, organization_id)
where status in ('requested','under_review','approved');

create or replace function private.hp5_company_claim_experience_impl(
  p_network_company_id uuid,
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
  v_company public.network_companies%rowtype;
  v_org_name text;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_email_domain text;
  v_company_domain text;
  v_domain_company_count integer := 0;
  v_domain_email_matches boolean := false;
  v_automatic_proof boolean := false;
  v_proof_path text := 'manual_review';
  v_proof_reason text := 'manual_review_required';
  v_current_claim jsonb;
  v_current_status text;
  v_linked_org uuid;
  v_controlled_company uuid;
  v_approved_claim_org uuid;
  v_eligible boolean := false;
  v_reason text := 'eligible';
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user_id
      and om.status='active'
      and om.role='admin'
  ) then
    raise exception 'active organization admin membership required'
      using errcode='42501';
  end if;

  select *
  into v_company
  from public.network_companies
  where id=p_network_company_id
    and publication_status<>'archived';

  if not found then
    raise exception 'network company not found' using errcode='P0002';
  end if;

  select o.name
  into v_org_name
  from public.organizations o
  where o.id=p_organization_id;

  if v_org_name is null then
    raise exception 'organization not found' using errcode='P0002';
  end if;

  select u.email,u.email_confirmed_at
  into v_email,v_email_confirmed_at
  from auth.users u
  where u.id=v_user_id;

  v_email_domain := private.hp4_normalize_domain(
    split_part(coalesce(v_email,''),'@',2)
  );
  v_company_domain := private.hp4_normalize_domain(v_company.website_domain);

  if v_company_domain is not null then
    select count(*)
    into v_domain_company_count
    from public.network_companies nc
    where nc.publication_status<>'archived'
      and private.hp4_normalize_domain(nc.website_domain)=v_company_domain;
  end if;

  v_domain_email_matches :=
    v_email_domain is not null
    and v_company_domain is not null
    and (
      v_email_domain=v_company_domain
      or v_email_domain like '%.'||v_company_domain
    );

  v_automatic_proof :=
    v_email_confirmed_at is not null
    and v_domain_email_matches
    and v_domain_company_count=1;

  if v_automatic_proof then
    v_proof_path := 'automatic_corporate_email';
    v_proof_reason := 'unique_company_domain_match';
  elsif v_email_confirmed_at is null then
    v_proof_reason := 'email_not_confirmed';
  elsif v_company_domain is null then
    v_proof_reason := 'company_domain_missing';
  elsif v_email_domain is null then
    v_proof_reason := 'email_domain_missing';
  elsif not v_domain_email_matches then
    v_proof_reason := 'email_domain_mismatch';
  elsif v_domain_company_count>1 then
    v_proof_reason := 'company_domain_shared';
  end if;

  select to_jsonb(q),q.status
  into v_current_claim,v_current_status
  from (
    select
      c.id as claim_id,
      c.status,
      c.proof_method,
      c.proof_status,
      c.proof_reference,
      c.proof_review_note,
      c.requested_at,
      c.reviewed_at,
      c.review_note
    from public.network_company_claims c
    where c.network_company_id=p_network_company_id
      and c.organization_id=p_organization_id
    order by c.created_at desc
    limit 1
  ) q;

  select l.organization_id
  into v_linked_org
  from public.organization_network_company_links l
  where l.network_company_id=p_network_company_id
    and l.link_status='active'
  limit 1;

  select l.network_company_id
  into v_controlled_company
  from public.organization_network_company_links l
  where l.organization_id=p_organization_id
    and l.link_status='active'
  limit 1;

  select c.organization_id
  into v_approved_claim_org
  from public.network_company_claims c
  where c.network_company_id=p_network_company_id
    and c.status='approved'
  limit 1;

  if v_company.publication_status<>'published' then
    v_reason := 'company_not_published';
  elsif v_linked_org=p_organization_id
        or v_approved_claim_org=p_organization_id
        or v_current_status='approved' then
    v_reason := 'already_managed';
  elsif (v_linked_org is not null and v_linked_org<>p_organization_id)
        or (v_approved_claim_org is not null and v_approved_claim_org<>p_organization_id)
        or v_company.claimed_status='claimed' then
    v_reason := 'already_claimed';
  elsif v_controlled_company is not null
        and v_controlled_company<>p_network_company_id then
    v_reason := 'organization_already_controls_profile';
  elsif v_current_status in ('requested','under_review') then
    v_reason := 'claim_in_progress';
  else
    v_eligible := true;
    v_reason := 'eligible';
  end if;

  return jsonb_build_object(
    'network_company_id',v_company.id,
    'legal_name',v_company.legal_name,
    'trading_name',v_company.trading_name,
    'country_code',v_company.country_code,
    'website_domain',v_company_domain,
    'publication_status',v_company.publication_status,
    'claimed_status',v_company.claimed_status,
    'verification_status',v_company.verification_status,
    'organization_id',p_organization_id,
    'organization_name',v_org_name,
    'eligible',v_eligible,
    'eligibility_reason',v_reason,
    'proof_path',v_proof_path,
    'proof_reason',v_proof_reason,
    'automatic_ownership_proof_available',v_automatic_proof,
    'corporate_email_confirmed',(v_email_confirmed_at is not null),
    'email_domain_matches_company',v_domain_email_matches,
    'company_domain_profile_count',v_domain_company_count,
    'current_claim',v_current_claim,
    'claim_is_separate_from_network_verification',true
  );
end;
$function$;

revoke all on function private.hp5_company_claim_experience_impl(uuid,uuid)
  from public,anon;
grant execute on function private.hp5_company_claim_experience_impl(uuid,uuid)
  to authenticated,service_role;

create or replace function public.hp5_company_claim_experience(
  p_network_company_id uuid,
  p_organization_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.hp5_company_claim_experience_impl(
    p_network_company_id,
    p_organization_id
  );
$function$;

revoke all on function public.hp5_company_claim_experience(uuid,uuid)
  from public,anon;
grant execute on function public.hp5_company_claim_experience(uuid,uuid)
  to authenticated,service_role;

create or replace function private.p3_6_request_company_claim_impl(
  p_network_company_id uuid,
  p_organization_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_claim_id uuid;
  v_note text;
  v_company public.network_companies%rowtype;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_email_domain text;
  v_company_domain text;
  v_domain_company_count integer := 0;
  v_proof_method text:='manual_review';
  v_proof_status text:='pending';
  v_proof_reference text;
  v_proof_verified_by uuid;
  v_proof_verified_at timestamptz;
begin
  v_user_id:=(select auth.uid());

  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user_id
      and om.status='active'
      and om.role='admin'
  ) then
    raise exception 'active organization admin membership required'
      using errcode='42501';
  end if;

  select * into v_company
  from public.network_companies
  where id=p_network_company_id
  for update;

  if not found or v_company.publication_status<>'published' then
    raise exception 'only published Network companies can be claimed'
      using errcode='P0002';
  end if;

  if exists(
    select 1
    from public.network_company_claims c
    where c.network_company_id=p_network_company_id
      and c.status='approved'
  ) or v_company.claimed_status='claimed' then
    raise exception 'network company is already claimed'
      using errcode='23505';
  end if;

  if exists(
    select 1
    from public.network_company_claims c
    where c.network_company_id=p_network_company_id
      and c.organization_id=p_organization_id
      and c.status in ('requested','under_review','approved')
  ) then
    raise exception 'an active claim already exists for this organization and company'
      using errcode='23505';
  end if;

  if exists(
    select 1
    from public.organization_network_company_links l
    where l.organization_id=p_organization_id
      and l.network_company_id<>p_network_company_id
      and l.link_status='active'
  ) then
    raise exception 'organization already controls another Network company'
      using errcode='23505';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'claim note exceeds 2000 characters'
      using errcode='22023';
  end if;

  select u.email,u.email_confirmed_at
  into v_email,v_email_confirmed_at
  from auth.users u
  where u.id=v_user_id;

  v_email_domain:=private.hp4_normalize_domain(
    split_part(coalesce(v_email,''),'@',2)
  );
  v_company_domain:=private.hp4_normalize_domain(v_company.website_domain);

  if v_company_domain is not null then
    select count(*)
    into v_domain_company_count
    from public.network_companies nc
    where nc.publication_status<>'archived'
      and private.hp4_normalize_domain(nc.website_domain)=v_company_domain;
  end if;

  if v_email_confirmed_at is not null
     and v_email_domain is not null
     and v_company_domain is not null
     and (
       v_email_domain=v_company_domain
       or v_email_domain like '%.'||v_company_domain
     )
     and v_domain_company_count=1 then
    v_proof_method:='authenticated_corporate_email';
    v_proof_status:='verified';
    v_proof_reference:='email_domain:'||v_email_domain;
    v_proof_verified_by:=v_user_id;
    v_proof_verified_at:=now();
  elsif v_email_confirmed_at is not null
        and v_email_domain is not null
        and v_company_domain is not null
        and (
          v_email_domain=v_company_domain
          or v_email_domain like '%.'||v_company_domain
        )
        and v_domain_company_count>1 then
    v_proof_reference:='shared_company_domain:'||v_company_domain;
  end if;

  insert into public.network_company_claims(
    network_company_id,organization_id,requested_by,status,request_note,
    proof_method,proof_status,proof_reference,proof_verified_by,proof_verified_at
  )
  values(
    p_network_company_id,p_organization_id,v_user_id,'requested',v_note,
    v_proof_method,v_proof_status,v_proof_reference,v_proof_verified_by,v_proof_verified_at
  )
  returning id into v_claim_id;

  update public.network_companies
  set claimed_status='pending'
  where id=p_network_company_id
    and claimed_status in ('unclaimed','revoked');

  return jsonb_build_object(
    'claim_id',v_claim_id,
    'network_company_id',p_network_company_id,
    'organization_id',p_organization_id,
    'status','requested',
    'proof_method',v_proof_method,
    'proof_status',v_proof_status,
    'automatic_ownership_proof',(v_proof_status='verified'),
    'shared_company_domain',(v_domain_company_count>1),
    'network_verification_status',v_company.verification_status
  );
end;
$function$;

revoke all on function private.p3_6_request_company_claim_impl(uuid,uuid,text)
  from public,anon;
grant execute on function private.p3_6_request_company_claim_impl(uuid,uuid,text)
  to authenticated,service_role;

comment on function public.hp5_company_claim_experience(uuid,uuid) is
  'HP5 claim preflight for the active organization admin. Separates management ownership from Network verification and prevents shared company domains from becoming automatic ownership proof.';

comment on function public.p3_6_request_company_claim(uuid,uuid,text) is
  'HP5-hardened claim request. Confirmed corporate-email-domain proof is automatic only when the domain uniquely identifies one active Network company; shared domains require manual ownership review.';
