-- Founder decisions history v1: read-only projection of committed Platform audit entries.
-- No new writes, no tenant-private commercial rows, no direct SELECT grants on audit.
-- This does not retroactively manufacture historical decisions.
--
-- The privileged reader lives in the non-exposed private schema.
-- The public RPC is SECURITY INVOKER and only forwards to that guarded reader.

create or replace function private.sss_founder_decision_history_read(
  p_limit integer default 20,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_limit integer := least(50, greatest(1, coalesce(p_limit, 20)));
  v_events jsonb := '[]'::jsonb;
  v_has_more boolean := false;
begin
  if v_actor is null or not coalesce(private.is_platform_superadmin(), false) then
    raise exception 'Platform founder access required' using errcode = '42501';
  end if;

  if (p_before_at is null) <> (p_before_id is null) then
    raise exception 'Incomplete history cursor' using errcode = '22023';
  end if;

  with recent as (
    select e.id, e.occurred_at, e.action, e.entity_type, e.entity_id,
           e.actor_authority_type
      from public.platform_access_events e
     where e.action in (
       'registration_application_approved',
       'registration_workspace_activated',
       'company_claim_proof_verified',
       'company_claim_approved',
       'company_claim_revoked',
       'discovery_candidate_published',
       'discovery_exact_duplicates_closed',
       'network_verification_verified'
     )
       and (p_before_at is null or (e.occurred_at, e.id) < (p_before_at, p_before_id))
     order by e.occurred_at desc, e.id desc
     limit v_limit + 1
  ),
  numbered as (
    select recent.*, row_number() over (order by recent.occurred_at desc, recent.id desc) as rn
      from recent
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', numbered.id,
               'at', numbered.occurred_at,
               'action', numbered.action,
               'entity_type', numbered.entity_type,
               'entity_id', numbered.entity_id,
               'actor_type', case
                 when numbered.actor_authority_type = 'platform_owner' then 'founder'
                 when numbered.actor_authority_type = 'platform_staff' then 'staff'
                 else 'unspecified'
               end
             )
             order by numbered.occurred_at desc, numbered.id desc
           ) filter (where numbered.rn <= v_limit),
           '[]'::jsonb
         ),
         coalesce(bool_or(numbered.rn > v_limit), false)
    into v_events, v_has_more
    from numbered;

  return jsonb_build_object(
    'events', v_events,
    'has_more', v_has_more,
    'checked_at', now(),
    'source', 'platform_access_events'
  );
end;
$function$;

revoke all on function private.sss_founder_decision_history_read(integer, timestamptz, uuid) from public, anon;
grant execute on function private.sss_founder_decision_history_read(integer, timestamptz, uuid) to authenticated;

create or replace function public.sss_founder_decision_history_read(
  p_limit integer default 20,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.sss_founder_decision_history_read(p_limit, p_before_at, p_before_id);
$function$;

revoke all on function public.sss_founder_decision_history_read(integer, timestamptz, uuid) from public, anon;
grant execute on function public.sss_founder_decision_history_read(integer, timestamptz, uuid) to authenticated;

comment on function public.sss_founder_decision_history_read(integer, timestamptz, uuid)
  is 'Founder-only, read-only, paginated audit history. Owner authorization is rechecked in the non-exposed private function.';
