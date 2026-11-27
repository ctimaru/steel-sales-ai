-- COMPANY-CLAIM1.A: carry an opaque public-lookup reference into the existing
-- authenticated HP5 claim experience. Resolving a target is a read only: it
-- grants no claim, membership, company link, publication or Network entitlement.

create function private.company_claim1a_resolve_target_impl(
  p_claim_ref text,
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_company_id uuid;
  v_experience jsonb;
  v_unavailable jsonb := jsonb_build_object(
    'contract','company-claim1a-target-v1',
    'ok',false,
    'code','target_unavailable',
    'network_company_id',null
  );
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  -- Match HP5's organization authority before inspecting a reference. There is
  -- deliberately no Platform role bypass and no paid Network prerequisite.
  if not exists (
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user_id
      and om.role='admin'
      and om.status='active'
  ) then
    raise exception 'active organization admin membership required'
      using errcode='42501';
  end if;

  if p_claim_ref is null or p_claim_ref !~ '^[0-9A-Fa-f]{64}$' then
    return v_unavailable;
  end if;

  select c.id into v_company_id
  from public.network_companies c
  where c.publication_status='published'
    and c.archived_at is null
    and private.pa1_4_claim_ref(c.id)=lower(p_claim_ref);

  if v_company_id is null then
    return v_unavailable;
  end if;

  -- Reuse the authorized HP5 read before returning the ID. An ineligible claim
  -- can still have a legitimate status page (already managed, pending, claimed
  -- elsewhere). Eligibility is enforced by HP5 and the existing claim writer,
  -- never inferred from a successful reference resolution.
  v_experience := private.hp5_company_claim_experience_impl(
    v_company_id,p_organization_id
  );
  if v_experience->>'network_company_id' is distinct from v_company_id::text
    or v_experience->>'organization_id' is distinct from p_organization_id::text
    or v_experience->>'publication_status' is distinct from 'published' then
    return v_unavailable;
  end if;

  return jsonb_build_object(
    'contract','company-claim1a-target-v1',
    'ok',true,
    'code','resolved',
    'network_company_id',v_company_id
  );
end;
$function$;

revoke all on function private.company_claim1a_resolve_target_impl(text,uuid)
from public,anon,authenticated,service_role;
grant execute on function private.company_claim1a_resolve_target_impl(text,uuid)
to authenticated;

create function public.company_claim1a_resolve_target(
  p_claim_ref text,
  p_organization_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.company_claim1a_resolve_target_impl(
    p_claim_ref,p_organization_id
  );
$function$;

revoke all on function public.company_claim1a_resolve_target(text,uuid)
from public,anon,authenticated,service_role;
grant execute on function public.company_claim1a_resolve_target(text,uuid)
to authenticated;

comment on function public.company_claim1a_resolve_target(text,uuid) is
  'Read-only PA1.4 claim-reference handoff for an authenticated active organization admin. Returns only a published company ID after HP5 authorization; never grants ownership or paid Network access.';
