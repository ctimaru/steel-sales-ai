-- PA2.16 — controlled RFQ backlog promotion.
-- Promotes exactly one PA2.15-ready requested observation per explicit call.
-- No batch endpoint and no automatic execution are introduced.

create or replace function public.p1_promote_ready_rfq_observation(
  p_organization_id uuid,
  p_observation_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  obs public.commercial_observations%rowtype;
  requested_lines_in_thread integer;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_organization_member(p_organization_id, true) then
    raise exception 'Active organization write membership required';
  end if;

  select *
  into obs
  from public.commercial_observations
  where organization_id=p_organization_id
    and id=p_observation_id
  ;

  if not found then
    raise exception 'Observation not found in organization';
  end if;

  -- Preserve idempotency before readiness checks: an already-promoted source
  -- returns the canonical existing link rather than being treated as stale.
  if exists (
    select 1 from public.current_commercial_entity_promotions p
    where p.organization_id=p_organization_id
      and p.observation_id=p_observation_id
      and p.entity_type='rfq_line'
      and p.status='applied'
  ) then
    return private.promote_requested_observation_impl(p_observation_id);
  end if;

  if obs.item_role <> 'requested' then
    raise exception 'Only requested observations are eligible';
  end if;

  select count(*)
  into requested_lines_in_thread
  from public.commercial_observations x
  where x.organization_id=p_organization_id
    and x.thread_id=obs.thread_id
    and x.item_role='requested';

  if coalesce(obs.confidence,0)<0.90
     or obs.canonical_product_id is null
     or obs.canonical_product_key is null
     or obs.quantity is null
     or obs.quantity_unit is null
     or obs.length_mm is null
     or nullif(btrim(coalesce(obs.source_text,'')),'') is null
     or requested_lines_in_thread<>1
     or exists (
       select 1 from public.commercial_review_queue q
       where q.organization_id=p_organization_id
         and q.observation_id=p_observation_id
         and q.status='pending'
     )
  then
    raise exception 'Observation is not PA2.15 ready for controlled RFQ promotion';
  end if;

  result := private.promote_requested_observation_impl(p_observation_id);

  if result->>'status' not in ('promoted','already_promoted') then
    raise exception 'Unexpected promotion result';
  end if;

  return result || jsonb_build_object(
    'control_phase','PA2.16',
    'execution_mode','single_explicit'
  );
end;
$$;

revoke all on function public.p1_promote_ready_rfq_observation(uuid,bigint)
from public,anon;
grant execute on function public.p1_promote_ready_rfq_observation(uuid,bigint)
to authenticated,service_role;

comment on function public.p1_promote_ready_rfq_observation(uuid,bigint) is
  'PA2.16 explicit single-observation RFQ promotion. Revalidates the PA2.15 ready contract, preserves immutable ledger/idempotency, and provides no bulk promotion endpoint.';
