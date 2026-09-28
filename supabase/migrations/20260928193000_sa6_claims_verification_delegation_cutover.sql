-- SA6 — Claims & Verification Delegation Cutover.
--
-- Delegates Company Claims and ownership-proof verification to capability-authorized
-- Platform Staff. This cutover deliberately does NOT delegate Network verification:
-- public.m4_record_verification remains Platform Owner-only and claim approval never
-- changes network_companies.verification_status.

create or replace function private.sa6_record_claim_action(
  p_permission_key text,
  p_action text,
  p_claim_id uuid,
  p_target_organization_id uuid,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null
)
returns uuid
language sql
security definer
set search_path=''
as $function$
  select private.sa2_record_platform_event(
    p_permission_key,
    p_action,
    'company_claim',
    p_claim_id::text,
    p_target_organization_id,
    p_before_state,
    p_after_state,
    p_reason,
    jsonb_build_object('surface','company_claims')
  );
$function$;

revoke all on function private.sa6_record_claim_action(text,text,uuid,uuid,jsonb,jsonb,text)
  from public,anon,authenticated;

create or replace function private.p3_6_admin_claim_queue_impl(
  p_status text default null,p_limit integer default 100
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare v_user_id uuid; v_limit integer;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('claims.read');

  if p_status is not null and p_status not in ('requested','under_review','approved','rejected','revoked') then
    raise exception 'invalid claim status' using errcode='22023';
  end if;
  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',(
      select coalesce(jsonb_agg(to_jsonb(q) order by q.requested_at desc),'[]'::jsonb)
      from (
        select cl.id as claim_id,cl.status,cl.proof_method,cl.proof_status,
               cl.proof_reference,cl.proof_review_note,cl.request_note,cl.requested_at,
               cl.reviewed_at,cl.review_note,cl.network_company_id,
               nc.legal_name as company_legal_name,nc.website_domain,nc.claimed_status,
               nc.verification_status,cl.organization_id,o.name as organization_name
        from public.network_company_claims cl
        join public.network_companies nc on nc.id=cl.network_company_id
        join public.organizations o on o.id=cl.organization_id
        where p_status is null or cl.status=p_status
        order by cl.requested_at desc limit v_limit
      ) q
    ),
    'total',(select count(*) from public.network_company_claims cl where p_status is null or cl.status=p_status),
    'proof_pending',(select count(*) from public.network_company_claims cl where (p_status is null or cl.status=p_status) and cl.proof_status='pending'),
    'proof_verified',(select count(*) from public.network_company_claims cl where (p_status is null or cl.status=p_status) and cl.proof_status='verified')
  );
end;
$function$;

create or replace function private.p3_6_review_claim_proof_impl(
  p_claim_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_claim public.network_company_claims%rowtype;
  v_note text;
  v_before_state jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('claims.review_proof');

  if p_decision not in ('verified','rejected') then
    raise exception 'invalid ownership proof decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'proof review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_claim
  from public.network_company_claims
  where id=p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode='P0002';
  end if;

  if v_claim.status not in ('requested','under_review') then
    raise exception 'ownership proof can only be reviewed for an active claim'
      using errcode='22023';
  end if;

  if v_claim.proof_status='verified' and p_decision='verified' then
    return jsonb_build_object(
      'claim_id',v_claim.id,
      'proof_status',v_claim.proof_status,
      'proof_method',v_claim.proof_method,
      'idempotent_replay',true
    );
  end if;

  v_before_state:=jsonb_build_object(
    'status',v_claim.status,
    'proof_status',v_claim.proof_status,
    'proof_method',v_claim.proof_method
  );

  update public.network_company_claims
  set proof_method=case
        when proof_method='authenticated_corporate_email' and proof_status='verified'
          then proof_method
        else 'manual_review'
      end,
      proof_status=p_decision,
      proof_reference=case
        when proof_reference is not null then proof_reference
        else 'manual_platform_review'
      end,
      proof_review_note=v_note,
      proof_verified_by=v_user_id,
      proof_verified_at=now()
  where id=p_claim_id
  returning * into v_claim;

  perform private.sa6_record_claim_action(
    'claims.review_proof',
    case when p_decision='verified'
      then 'company_claim_proof_verified'
      else 'company_claim_proof_rejected'
    end,
    v_claim.id,
    v_claim.organization_id,
    v_before_state,
    jsonb_build_object(
      'status',v_claim.status,
      'proof_status',v_claim.proof_status,
      'proof_method',v_claim.proof_method
    ),
    v_note
  );

  return jsonb_build_object(
    'claim_id',v_claim.id,
    'proof_status',v_claim.proof_status,
    'proof_method',v_claim.proof_method,
    'proof_verified_by',v_claim.proof_verified_by,
    'proof_verified_at',v_claim.proof_verified_at
  );
end;
$function$;

create or replace function private.m4_review_company_claim_impl(
  p_claim_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_claim public.network_company_claims%rowtype;
  v_note text;
  v_link_id uuid;
  v_permission text;
  v_before_state jsonb;
  v_claimed_status text;
  v_verification_status text;
begin
  v_user_id:=(select auth.uid());

  if p_decision not in ('under_review','approved','rejected','revoked') then
    raise exception 'invalid claim decision' using errcode='22023';
  end if;

  if p_decision='under_review' then
    v_permission:='claims.review_proof';
    perform private.require_platform_permission('claims.review_proof');
  elsif p_decision='approved' then
    v_permission:='claims.approve';
    perform private.require_platform_permission('claims.approve');
  elsif p_decision='rejected' then
    v_permission:='claims.reject';
    perform private.require_platform_permission('claims.reject');
  else
    v_permission:='claims.revoke';
    perform private.require_platform_permission('claims.revoke');
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_claim
  from public.network_company_claims
  where id=p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode='P0002';
  end if;

  select nc.claimed_status,nc.verification_status
  into v_claimed_status,v_verification_status
  from public.network_companies nc
  where nc.id=v_claim.network_company_id;

  v_before_state:=jsonb_build_object(
    'status',v_claim.status,
    'proof_status',v_claim.proof_status,
    'claimed_status',v_claimed_status,
    'verification_status',v_verification_status
  );

  if p_decision='under_review' and v_claim.status<>'requested' then
    raise exception 'under_review requires requested claim' using errcode='22023';
  elsif p_decision in ('approved','rejected')
        and v_claim.status not in ('requested','under_review') then
    raise exception '% requires requested or under_review claim',p_decision
      using errcode='22023';
  elsif p_decision='revoked' and v_claim.status<>'approved' then
    raise exception 'revoked requires approved claim' using errcode='22023';
  end if;

  if p_decision='approved' and v_claim.proof_status<>'verified' then
    raise exception 'verified ownership proof required before claim approval'
      using errcode='23514';
  end if;

  if p_decision='approved' and exists(
    select 1 from public.network_company_claims c
    where c.network_company_id=v_claim.network_company_id
      and c.status='approved' and c.id<>v_claim.id
  ) then
    raise exception 'another approved claim already exists for this company'
      using errcode='23505';
  end if;

  if p_decision='approved' and exists(
    select 1 from public.organization_network_company_links l
    where l.network_company_id=v_claim.network_company_id
      and l.organization_id<>v_claim.organization_id
      and l.link_status='active'
  ) then
    raise exception 'network company already controlled by another organization'
      using errcode='23505';
  end if;

  if p_decision='approved' and exists(
    select 1 from public.organization_network_company_links l
    where l.organization_id=v_claim.organization_id
      and l.network_company_id<>v_claim.network_company_id
      and l.link_status='active'
  ) then
    raise exception 'organization already controls another Network company'
      using errcode='23505';
  end if;

  update public.network_company_claims
  set status=p_decision,reviewed_by=v_user_id,reviewed_at=now(),
      review_note=v_note,revoked_at=case when p_decision='revoked' then now() else null end
  where id=p_claim_id
  returning * into v_claim;

  if p_decision='approved' then
    select l.id into v_link_id
    from public.organization_network_company_links l
    where l.organization_id=v_claim.organization_id
      and l.network_company_id=v_claim.network_company_id
    order by (l.link_status='active') desc,l.created_at
    limit 1
    for update;

    if v_link_id is null then
      insert into public.organization_network_company_links(
        organization_id,network_company_id,application_id,claim_id,link_status,linked_by
      )
      values(v_claim.organization_id,v_claim.network_company_id,null,v_claim.id,'active',v_user_id)
      returning id into v_link_id;
    else
      update public.organization_network_company_links
      set link_status='active',linked_by=v_user_id,linked_at=now()
      where id=v_link_id;
    end if;

    update public.network_companies set claimed_status='claimed'
    where id=v_claim.network_company_id;
  elsif p_decision='revoked' then
    update public.organization_network_company_links
    set link_status='revoked'
    where organization_id=v_claim.organization_id
      and network_company_id=v_claim.network_company_id
      and link_status='active';

    update public.network_companies set claimed_status='revoked'
    where id=v_claim.network_company_id;
  elsif p_decision='rejected' and not exists(
    select 1 from public.network_company_claims c
    where c.network_company_id=v_claim.network_company_id
      and c.id<>v_claim.id
      and c.status in ('requested','under_review','approved')
  ) then
    update public.network_companies set claimed_status='unclaimed'
    where id=v_claim.network_company_id;
  end if;

  select nc.claimed_status,nc.verification_status
  into v_claimed_status,v_verification_status
  from public.network_companies nc
  where nc.id=v_claim.network_company_id;

  perform private.sa6_record_claim_action(
    v_permission,
    case p_decision
      when 'under_review' then 'company_claim_review_started'
      when 'approved' then 'company_claim_approved'
      when 'rejected' then 'company_claim_rejected'
      when 'revoked' then 'company_claim_revoked'
    end,
    v_claim.id,
    v_claim.organization_id,
    v_before_state,
    jsonb_build_object(
      'status',v_claim.status,
      'proof_status',v_claim.proof_status,
      'claimed_status',v_claimed_status,
      'verification_status',v_verification_status,
      'link_id',v_link_id
    ),
    v_note
  );

  return jsonb_build_object(
    'claim_id',v_claim.id,'network_company_id',v_claim.network_company_id,
    'organization_id',v_claim.organization_id,'status',v_claim.status,
    'proof_status',v_claim.proof_status,'proof_method',v_claim.proof_method,
    'link_id',v_link_id,'reviewed_by',v_claim.reviewed_by,'reviewed_at',v_claim.reviewed_at,
    'verification_status',v_verification_status
  );
end;
$function$;

comment on function public.p3_6_review_claim_proof(uuid,text,text) is
  'SA6 capability-authorized ownership-proof review. This verifies claim ownership evidence only and never changes Network verification_status.';

comment on function public.m4_review_company_claim(uuid,text,text) is
  'SA6 capability-authorized claim lifecycle decision. Approval requires verified ownership proof and never changes Network verification_status.';

comment on function public.m4_record_verification(text,uuid,text,uuid,timestamptz,text) is
  'M4 Platform Owner-controlled Network verification. SA6 does not delegate this state machine to Claims & Verification Admin.';

do $sa6$
begin
  if private.has_platform_permission('claims.read') is null then
    raise exception 'SA6 Claims cutover failed to resolve claims.read';
  end if;
end
$sa6$;
