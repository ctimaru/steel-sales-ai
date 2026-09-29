-- P5.3a — Deterministic Entitlement Ordering
-- PostgreSQL now() is transaction-stable. Grant/revoke events created in the
-- same transaction can therefore share identical timestamps. Use an identity
-- sequence as the authoritative tie-break for entitlement event order.

alter table public.marketplace_entitlement_events
  add column event_sequence bigint generated always as identity;

create unique index marketplace_entitlement_events_sequence_uidx
  on public.marketplace_entitlement_events(event_sequence);

create or replace function private.p5_3_resolve_entitlement_impl(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
  v_specific public.marketplace_entitlement_events%rowtype;
  v_global public.marketplace_entitlement_events%rowtype;
  v_specific_active boolean := false;
  v_global_active boolean := false;
  v_expired public.marketplace_entitlement_events%rowtype;
begin
  select * into v_request
  from public.marketplace_requests r
  where r.id=p_request_id
    and r.status='published'
    and r.opens_at<=now()
    and r.closes_at>now()
    and r.organization_id<>p_supplier_organization_id;

  if not found then
    return null;
  end if;

  select * into v_specific
  from public.marketplace_entitlement_events e
  where e.supplier_organization_id=p_supplier_organization_id
    and e.entitlement_key='opportunity_unlock'
    and e.request_id=p_request_id
    and e.effective_at<=now()
  order by e.effective_at desc,e.event_sequence desc
  limit 1;

  if found then
    v_specific_active :=
      v_specific.event_type='granted'
      and (v_specific.expires_at is null or v_specific.expires_at>now());
  end if;

  select * into v_global
  from public.marketplace_entitlement_events e
  where e.supplier_organization_id=p_supplier_organization_id
    and e.entitlement_key='marketplace_access'
    and e.request_id is null
    and e.effective_at<=now()
  order by e.effective_at desc,e.event_sequence desc
  limit 1;

  if found then
    v_global_active :=
      v_global.event_type='granted'
      and (v_global.expires_at is null or v_global.expires_at>now());
  end if;

  if v_specific_active then
    return jsonb_build_object(
      'contract','P5.3-entitlement-v1',
      'request_id',p_request_id,
      'state','entitled',
      'can_view_locked_detail',true,
      'can_respond',false,
      'entitlement_key','opportunity_unlock',
      'source_kind',v_specific.source_kind,
      'expires_at',v_specific.expires_at,
      'entitlement_event_id',v_specific.id
    );
  end if;

  if v_global_active then
    return jsonb_build_object(
      'contract','P5.3-entitlement-v1',
      'request_id',p_request_id,
      'state','entitled',
      'can_view_locked_detail',true,
      'can_respond',false,
      'entitlement_key','marketplace_access',
      'source_kind',v_global.source_kind,
      'expires_at',v_global.expires_at,
      'entitlement_event_id',v_global.id
    );
  end if;

  if v_specific.id is not null
     and v_specific.event_type='granted'
     and v_specific.expires_at is not null
     and v_specific.expires_at<=now() then
    v_expired := v_specific;
  elsif v_global.id is not null
     and v_global.event_type='granted'
     and v_global.expires_at is not null
     and v_global.expires_at<=now() then
    v_expired := v_global;
  end if;

  if v_expired.id is not null then
    return jsonb_build_object(
      'contract','P5.3-entitlement-v1',
      'request_id',p_request_id,
      'state','expired',
      'can_view_locked_detail',false,
      'can_respond',false,
      'entitlement_key',v_expired.entitlement_key,
      'source_kind',v_expired.source_kind,
      'expires_at',v_expired.expires_at,
      'entitlement_event_id',v_expired.id
    );
  end if;

  return jsonb_build_object(
    'contract','P5.3-entitlement-v1',
    'request_id',p_request_id,
    'state','locked',
    'can_view_locked_detail',false,
    'can_respond',false,
    'entitlement_key',null,
    'source_kind',null,
    'expires_at',null,
    'entitlement_event_id',null
  );
end;
$function$;

revoke all on function private.p5_3_resolve_entitlement_impl(uuid,uuid)
from public,anon,authenticated;

comment on column public.marketplace_entitlement_events.event_sequence is
  'P5.3a monotonic insertion sequence used to deterministically order entitlement events that share a transaction-stable effective_at timestamp.';
