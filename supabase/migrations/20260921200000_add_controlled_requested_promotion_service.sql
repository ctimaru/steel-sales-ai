-- PA2.3 — controlled requested-observation promotion service.
-- Creates RFQ + RFQ Line atomically for mature requested observations only.

create or replace function private.promote_requested_observation_impl(
  p_observation_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  obs public.commercial_observations%rowtype;
  existing public.current_commercial_entity_promotions%rowtype;
  new_rfq_id uuid := gen_random_uuid();
  new_line_id uuid := gen_random_uuid();
  promotion_id bigint;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into obs
  from public.commercial_observations
  where id = p_observation_id
  for share;

  if not found then
    raise exception 'Observation not found';
  end if;

  if not public.is_organization_member(obs.organization_id, true) then
    raise exception 'Active organization write membership required';
  end if;

  if obs.item_role <> 'requested' then
    raise exception 'Only requested observations are eligible';
  end if;

  if coalesce(obs.confidence, 0) < 0.90 then
    raise exception 'Observation confidence below promotion threshold';
  end if;

  if obs.canonical_product_id is null or obs.canonical_product_key is null then
    raise exception 'Canonical product identity required';
  end if;

  if exists (
    select 1
    from public.commercial_review_queue q
    where q.organization_id = obs.organization_id
      and q.observation_id = obs.id
      and q.status = 'pending'
  ) then
    raise exception 'Pending review blocks promotion';
  end if;

  select *
  into existing
  from public.current_commercial_entity_promotions p
  where p.organization_id = obs.organization_id
    and p.observation_id = obs.id
    and p.entity_type = 'rfq_line'
  order by p.id
  limit 1;

  if found then
    return jsonb_build_object(
      'status','already_promoted',
      'observation_id',obs.id,
      'rfq_line_id',existing.entity_id,
      'promotion_id',existing.id
    );
  end if;

  insert into public.rfqs (
    id,
    owner_id,
    organization_id,
    assigned_to_user_id,
    created_by_user_id,
    requested_at,
    status,
    priority,
    notes
  )
  values (
    new_rfq_id,
    actor_id,
    obs.organization_id,
    actor_id,
    actor_id,
    obs.created_at,
    'new',
    'normal',
    concat('Controlled promotion from observation ', obs.id)
  );

  insert into public.rfq_lines (
    id,
    owner_id,
    organization_id,
    rfq_id,
    requested_quantity,
    quantity_unit,
    requested_grade,
    requested_standard,
    min_length_mm,
    max_length_mm,
    canonical_product_id,
    canonical_product_key,
    source_observation_id,
    raw_spec_text
  )
  values (
    new_line_id,
    actor_id,
    obs.organization_id,
    new_rfq_id,
    obs.quantity,
    obs.quantity_unit,
    obs.grade,
    obs.standard,
    obs.length_mm,
    obs.length_mm,
    obs.canonical_product_id,
    obs.canonical_product_key,
    obs.id,
    obs.source_text
  );

  promotion_id := private.record_commercial_entity_promotion_impl(
    obs.organization_id,
    obs.id,
    'rfq_line',
    new_line_id,
    null,
    'created',
    'applied',
    obs.confidence,
    'deterministic_match',
    null,
    null,
    jsonb_build_object(
      'phase','PA2.3',
      'service','requested_observation_promotion'
    )
  );

  return jsonb_build_object(
    'status','promoted',
    'observation_id',obs.id,
    'rfq_id',new_rfq_id,
    'rfq_line_id',new_line_id,
    'promotion_id',promotion_id
  );
end;
$$;

revoke execute on function private.promote_requested_observation_impl(bigint)
from public, anon;
grant execute on function private.promote_requested_observation_impl(bigint)
to authenticated, service_role;

create or replace function public.promote_requested_observation(
  p_observation_id bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.promote_requested_observation_impl(p_observation_id);
$$;

revoke execute on function public.promote_requested_observation(bigint)
from public, anon;
grant execute on function public.promote_requested_observation(bigint)
to authenticated, service_role;

comment on function public.promote_requested_observation(bigint) is
  'PA2.3 conservative requested-observation promotion: confidence>=0.90, canonical identity, no pending review, idempotent current-link behavior.';
