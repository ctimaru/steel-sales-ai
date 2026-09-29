-- P5.3 — Entitlement & Unlock Foundation.
-- Provider-neutral entitlement boundary between the P5.2 free teaser and
-- governed Marketplace locked detail. No response/quote rights are introduced.

create table public.marketplace_entitlement_events (
  id uuid primary key default gen_random_uuid(),
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid null references public.marketplace_requests(id) on delete restrict,
  entitlement_key text not null,
  event_type text not null,
  source_kind text not null,
  source_reference text null,
  idempotency_key text not null,
  effective_at timestamptz not null default now(),
  expires_at timestamptz null,
  actor_user_id uuid null references auth.users(id) on delete restrict,
  actor_authority_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint marketplace_entitlement_events_entitlement_key_check
    check (entitlement_key in ('marketplace_access','opportunity_unlock')),
  constraint marketplace_entitlement_events_scope_check
    check (
      (entitlement_key='marketplace_access' and request_id is null)
      or
      (entitlement_key='opportunity_unlock' and request_id is not null)
    ),
  constraint marketplace_entitlement_events_type_check
    check (event_type in ('granted','revoked')),
  constraint marketplace_entitlement_events_source_check
    check (source_kind in ('subscription','credit','manual','pilot','system')),
  constraint marketplace_entitlement_events_source_reference_check
    check (source_reference is null or char_length(btrim(source_reference)) between 1 and 240),
  constraint marketplace_entitlement_events_idempotency_check
    check (
      char_length(btrim(idempotency_key)) between 8 and 200
      and btrim(idempotency_key) ~ '^[A-Za-z0-9._:-]+$'
    ),
  constraint marketplace_entitlement_events_lifecycle_check
    check (
      (event_type='granted' and (expires_at is null or expires_at>effective_at))
      or
      (event_type='revoked' and expires_at is null)
    ),
  constraint marketplace_entitlement_events_actor_check
    check (actor_authority_type in ('platform_owner','service','system')),
  constraint marketplace_entitlement_events_metadata_check
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=16384)
);

create unique index marketplace_entitlement_events_idempotency_uidx
  on public.marketplace_entitlement_events(idempotency_key);

create index marketplace_entitlement_events_scope_idx
  on public.marketplace_entitlement_events(
    supplier_organization_id,
    entitlement_key,
    request_id,
    effective_at desc,
    created_at desc,
    id desc
  );

alter table public.marketplace_entitlement_events enable row level security;
revoke all on table public.marketplace_entitlement_events from public,anon,authenticated;
grant select,insert on table public.marketplace_entitlement_events to service_role;

create table public.marketplace_unlocks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  entitlement_event_id uuid not null references public.marketplace_entitlement_events(id) on delete restrict,
  entitlement_key text not null,
  source_kind text not null,
  unlocked_by_user_id uuid not null references auth.users(id) on delete restrict,
  unlocked_at timestamptz not null default now(),

  unique(request_id,supplier_organization_id),
  constraint marketplace_unlocks_entitlement_key_check
    check (entitlement_key in ('marketplace_access','opportunity_unlock')),
  constraint marketplace_unlocks_source_check
    check (source_kind in ('subscription','credit','manual','pilot','system'))
);

create index marketplace_unlocks_supplier_idx
  on public.marketplace_unlocks(supplier_organization_id,unlocked_at desc);
create index marketplace_unlocks_request_idx
  on public.marketplace_unlocks(request_id,unlocked_at desc);

alter table public.marketplace_unlocks enable row level security;
revoke all on table public.marketplace_unlocks from public,anon,authenticated;
grant select,insert on table public.marketplace_unlocks to service_role;

create or replace function private.p5_3_append_only_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'P5.3 entitlement and unlock ledgers are append-only'
    using errcode='55000';
end;
$function$;

revoke all on function private.p5_3_append_only_guard()
from public,anon,authenticated;

create trigger marketplace_entitlement_events_append_only
before update or delete on public.marketplace_entitlement_events
for each row execute function private.p5_3_append_only_guard();

create trigger marketplace_unlocks_append_only
before update or delete on public.marketplace_unlocks
for each row execute function private.p5_3_append_only_guard();

create or replace function private.p5_3_validate_unlock_basis()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if not exists (
    select 1
    from public.marketplace_entitlement_events e
    where e.id=new.entitlement_event_id
      and e.supplier_organization_id=new.supplier_organization_id
      and e.event_type='granted'
      and e.entitlement_key=new.entitlement_key
      and e.source_kind=new.source_kind
      and (
        (e.entitlement_key='marketplace_access' and e.request_id is null)
        or
        (e.entitlement_key='opportunity_unlock' and e.request_id=new.request_id)
      )
  ) then
    raise exception 'invalid Marketplace unlock entitlement basis'
      using errcode='23514';
  end if;

  if exists (
    select 1
    from public.marketplace_requests r
    where r.id=new.request_id
      and r.organization_id=new.supplier_organization_id
  ) then
    raise exception 'buyer organization cannot unlock its own Marketplace request'
      using errcode='23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.p5_3_validate_unlock_basis()
from public,anon,authenticated;

create trigger marketplace_unlocks_basis_guard
before insert on public.marketplace_unlocks
for each row execute function private.p5_3_validate_unlock_basis();

create or replace function private.p5_3_require_entitlement_authority()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_role text := coalesce((select auth.jwt()->>'role'),'');
begin
  if v_role='service_role' then
    return jsonb_build_object(
      'actor_user_id',v_user,
      'actor_authority_type','service'
    );
  end if;

  if v_user is not null and private.is_platform_superadmin() then
    return jsonb_build_object(
      'actor_user_id',v_user,
      'actor_authority_type','platform_owner'
    );
  end if;

  raise exception 'Marketplace entitlement authority required'
    using errcode='42501';
end;
$function$;

revoke all on function private.p5_3_require_entitlement_authority()
from public,anon;
grant execute on function private.p5_3_require_entitlement_authority()
to authenticated,service_role;

create or replace function private.p5_3_validate_entitlement_target(
  p_supplier_organization_id uuid,
  p_entitlement_key text,
  p_request_id uuid,
  p_require_open boolean default true
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
begin
  if not exists (
    select 1
    from public.organizations o
    where o.id=p_supplier_organization_id
  ) then
    raise exception 'supplier organization not found' using errcode='P0002';
  end if;

  if p_entitlement_key='marketplace_access' then
    if p_request_id is not null then
      raise exception 'marketplace_access entitlement must be organization-wide'
        using errcode='22023';
    end if;
    return;
  end if;

  if p_entitlement_key<>'opportunity_unlock' then
    raise exception 'unsupported Marketplace entitlement key'
      using errcode='22023';
  end if;

  if p_request_id is null then
    raise exception 'opportunity_unlock requires request_id'
      using errcode='22023';
  end if;

  select * into v_request
  from public.marketplace_requests r
  where r.id=p_request_id;

  if not found then
    raise exception 'Marketplace request not found' using errcode='P0002';
  end if;

  if v_request.organization_id=p_supplier_organization_id then
    raise exception 'buyer organization cannot receive entitlement for its own request'
      using errcode='22023';
  end if;

  if p_require_open
     and (
       v_request.status<>'published'
       or v_request.opens_at>now()
       or v_request.closes_at<=now()
     ) then
    raise exception 'opportunity_unlock requires an open published Marketplace request'
      using errcode='22023';
  end if;
end;
$function$;

revoke all on function private.p5_3_validate_entitlement_target(uuid,text,uuid,boolean)
from public,anon,authenticated;

create or replace function private.p5_3_grant_entitlement_impl(
  p_supplier_organization_id uuid,
  p_entitlement_key text,
  p_request_id uuid,
  p_source_kind text,
  p_source_reference text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_authority jsonb;
  v_event public.marketplace_entitlement_events%rowtype;
  v_key text := lower(btrim(coalesce(p_entitlement_key,'')));
  v_source text := lower(btrim(coalesce(p_source_kind,'')));
  v_source_reference text := nullif(btrim(coalesce(p_source_reference,'')),'');
  v_idempotency text := btrim(coalesce(p_idempotency_key,''));
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  v_authority := private.p5_3_require_entitlement_authority();

  if v_source not in ('subscription','credit','manual','pilot','system') then
    raise exception 'unsupported Marketplace entitlement source'
      using errcode='22023';
  end if;

  if v_source in ('subscription','credit') and v_source_reference is null then
    raise exception 'subscription/credit entitlement requires source_reference'
      using errcode='22023';
  end if;

  if char_length(v_idempotency) not between 8 and 200
     or v_idempotency !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid Marketplace entitlement idempotency key'
      using errcode='22023';
  end if;

  if jsonb_typeof(v_metadata)<>'object' or pg_column_size(v_metadata)>16384 then
    raise exception 'Marketplace entitlement metadata must be a JSON object <= 16KB'
      using errcode='22023';
  end if;

  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'Marketplace entitlement expiry must be in the future'
      using errcode='22023';
  end if;

  perform private.p5_3_validate_entitlement_target(
    p_supplier_organization_id,v_key,p_request_id,true
  );

  select * into v_event
  from public.marketplace_entitlement_events e
  where e.idempotency_key=v_idempotency;

  if found then
    if v_event.supplier_organization_id=p_supplier_organization_id
       and v_event.request_id is not distinct from p_request_id
       and v_event.entitlement_key=v_key
       and v_event.event_type='granted'
       and v_event.source_kind=v_source
       and v_event.source_reference is not distinct from v_source_reference
       and v_event.expires_at is not distinct from p_expires_at
       and v_event.metadata=v_metadata then
      return jsonb_build_object(
        'event_id',v_event.id,
        'event_type',v_event.event_type,
        'entitlement_key',v_event.entitlement_key,
        'supplier_organization_id',v_event.supplier_organization_id,
        'request_id',v_event.request_id,
        'source_kind',v_event.source_kind,
        'expires_at',v_event.expires_at,
        'idempotent',true
      );
    end if;

    raise exception 'Marketplace entitlement idempotency key conflict'
      using errcode='23505';
  end if;

  insert into public.marketplace_entitlement_events(
    supplier_organization_id,
    request_id,
    entitlement_key,
    event_type,
    source_kind,
    source_reference,
    idempotency_key,
    effective_at,
    expires_at,
    actor_user_id,
    actor_authority_type,
    metadata
  )
  values(
    p_supplier_organization_id,
    p_request_id,
    v_key,
    'granted',
    v_source,
    v_source_reference,
    v_idempotency,
    now(),
    p_expires_at,
    nullif(v_authority->>'actor_user_id','')::uuid,
    v_authority->>'actor_authority_type',
    v_metadata
  )
  returning * into v_event;

  return jsonb_build_object(
    'event_id',v_event.id,
    'event_type','granted',
    'entitlement_key',v_event.entitlement_key,
    'supplier_organization_id',v_event.supplier_organization_id,
    'request_id',v_event.request_id,
    'source_kind',v_event.source_kind,
    'expires_at',v_event.expires_at,
    'idempotent',false
  );
end;
$function$;

revoke all on function private.p5_3_grant_entitlement_impl(uuid,text,uuid,text,text,timestamptz,text,jsonb)
from public,anon;
grant execute on function private.p5_3_grant_entitlement_impl(uuid,text,uuid,text,text,timestamptz,text,jsonb)
to authenticated,service_role;

create or replace function public.p5_3_grant_entitlement(
  p_supplier_organization_id uuid,
  p_entitlement_key text,
  p_request_id uuid default null,
  p_source_kind text default 'manual',
  p_source_reference text default null,
  p_expires_at timestamptz default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_3_grant_entitlement_impl(
    p_supplier_organization_id,
    p_entitlement_key,
    p_request_id,
    p_source_kind,
    p_source_reference,
    p_expires_at,
    p_idempotency_key,
    p_metadata
  );
$function$;

revoke all on function public.p5_3_grant_entitlement(uuid,text,uuid,text,text,timestamptz,text,jsonb)
from public,anon;
grant execute on function public.p5_3_grant_entitlement(uuid,text,uuid,text,text,timestamptz,text,jsonb)
to authenticated,service_role;

create or replace function private.p5_3_revoke_entitlement_impl(
  p_supplier_organization_id uuid,
  p_entitlement_key text,
  p_request_id uuid,
  p_source_kind text,
  p_source_reference text,
  p_idempotency_key text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_authority jsonb;
  v_event public.marketplace_entitlement_events%rowtype;
  v_key text := lower(btrim(coalesce(p_entitlement_key,'')));
  v_source text := lower(btrim(coalesce(p_source_kind,'')));
  v_source_reference text := nullif(btrim(coalesce(p_source_reference,'')),'');
  v_idempotency text := btrim(coalesce(p_idempotency_key,''));
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  v_authority := private.p5_3_require_entitlement_authority();

  if v_source not in ('subscription','credit','manual','pilot','system') then
    raise exception 'unsupported Marketplace entitlement source'
      using errcode='22023';
  end if;

  if char_length(v_idempotency) not between 8 and 200
     or v_idempotency !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid Marketplace entitlement idempotency key'
      using errcode='22023';
  end if;

  if jsonb_typeof(v_metadata)<>'object' or pg_column_size(v_metadata)>16384 then
    raise exception 'Marketplace entitlement metadata must be a JSON object <= 16KB'
      using errcode='22023';
  end if;

  perform private.p5_3_validate_entitlement_target(
    p_supplier_organization_id,v_key,p_request_id,false
  );

  select * into v_event
  from public.marketplace_entitlement_events e
  where e.idempotency_key=v_idempotency;

  if found then
    if v_event.supplier_organization_id=p_supplier_organization_id
       and v_event.request_id is not distinct from p_request_id
       and v_event.entitlement_key=v_key
       and v_event.event_type='revoked'
       and v_event.source_kind=v_source
       and v_event.source_reference is not distinct from v_source_reference
       and v_event.metadata=v_metadata then
      return jsonb_build_object(
        'event_id',v_event.id,
        'event_type',v_event.event_type,
        'entitlement_key',v_event.entitlement_key,
        'supplier_organization_id',v_event.supplier_organization_id,
        'request_id',v_event.request_id,
        'source_kind',v_event.source_kind,
        'idempotent',true
      );
    end if;

    raise exception 'Marketplace entitlement idempotency key conflict'
      using errcode='23505';
  end if;

  if not exists (
    select 1
    from public.marketplace_entitlement_events e
    where e.supplier_organization_id=p_supplier_organization_id
      and e.entitlement_key=v_key
      and e.request_id is not distinct from p_request_id
      and e.event_type='granted'
  ) then
    raise exception 'cannot revoke Marketplace entitlement without grant history'
      using errcode='22023';
  end if;

  insert into public.marketplace_entitlement_events(
    supplier_organization_id,
    request_id,
    entitlement_key,
    event_type,
    source_kind,
    source_reference,
    idempotency_key,
    effective_at,
    expires_at,
    actor_user_id,
    actor_authority_type,
    metadata
  )
  values(
    p_supplier_organization_id,
    p_request_id,
    v_key,
    'revoked',
    v_source,
    v_source_reference,
    v_idempotency,
    now(),
    null,
    nullif(v_authority->>'actor_user_id','')::uuid,
    v_authority->>'actor_authority_type',
    v_metadata
  )
  returning * into v_event;

  return jsonb_build_object(
    'event_id',v_event.id,
    'event_type','revoked',
    'entitlement_key',v_event.entitlement_key,
    'supplier_organization_id',v_event.supplier_organization_id,
    'request_id',v_event.request_id,
    'source_kind',v_event.source_kind,
    'idempotent',false
  );
end;
$function$;

revoke all on function private.p5_3_revoke_entitlement_impl(uuid,text,uuid,text,text,text,jsonb)
from public,anon;
grant execute on function private.p5_3_revoke_entitlement_impl(uuid,text,uuid,text,text,text,jsonb)
to authenticated,service_role;

create or replace function public.p5_3_revoke_entitlement(
  p_supplier_organization_id uuid,
  p_entitlement_key text,
  p_request_id uuid default null,
  p_source_kind text default 'manual',
  p_source_reference text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_3_revoke_entitlement_impl(
    p_supplier_organization_id,
    p_entitlement_key,
    p_request_id,
    p_source_kind,
    p_source_reference,
    p_idempotency_key,
    p_metadata
  );
$function$;

revoke all on function public.p5_3_revoke_entitlement(uuid,text,uuid,text,text,text,jsonb)
from public,anon;
grant execute on function public.p5_3_revoke_entitlement(uuid,text,uuid,text,text,text,jsonb)
to authenticated,service_role;

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
  order by e.effective_at desc,e.created_at desc,e.id desc
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
  order by e.effective_at desc,e.created_at desc,e.id desc
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

create or replace function private.p5_3_entitlement_state_impl(
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
  v_state jsonb;
begin
  perform private.p5_2_require_feed_actor(p_supplier_organization_id);
  v_state := private.p5_3_resolve_entitlement_impl(
    p_supplier_organization_id,p_request_id
  );

  if v_state is null then
    return null;
  end if;

  return v_state - 'entitlement_event_id';
end;
$function$;

revoke all on function private.p5_3_entitlement_state_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_3_entitlement_state_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_3_entitlement_state(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_3_entitlement_state_impl(
    p_supplier_organization_id,p_request_id
  );
$function$;

revoke all on function public.p5_3_entitlement_state(uuid,uuid)
from public,anon;
grant execute on function public.p5_3_entitlement_state(uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_3_marketplace_detail_impl(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_state jsonb;
  v_teaser jsonb;
  v_request public.marketplace_requests%rowtype;
  v_lines jsonb;
begin
  v_user := private.p5_2_require_feed_actor(p_supplier_organization_id);
  v_state := private.p5_3_resolve_entitlement_impl(
    p_supplier_organization_id,p_request_id
  );

  if v_state is null then
    return null;
  end if;

  if v_state->>'state'<>'entitled' then
    raise exception 'Marketplace entitlement required'
      using errcode='42501';
  end if;

  select * into v_request
  from public.marketplace_requests
  where id=p_request_id;

  v_teaser := private.p5_2_teaser_item_impl(p_request_id);

  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'line_number',l.line_number,
      'product_family_key',pf.canonical_key,
      'product_family_name',pf.display_name,
      'standard_code',s.code,
      'standard_title',s.title,
      'grade_designation',mg.designation,
      'material_number',mg.material_number,
      'manufacturing_process',l.manufacturing_process,
      'outer_diameter_mm',l.outer_diameter_mm,
      'width_mm',l.width_mm,
      'height_mm',l.height_mm,
      'thickness_mm',l.thickness_mm,
      'length_mm',l.length_mm,
      'quantity',l.quantity,
      'quantity_unit',l.quantity_unit,
      'certification',l.certification,
      'delivery_country_code',l.delivery_country_code,
      'delivery_region',l.delivery_region,
      'requested_delivery_date',l.requested_delivery_date,
      'notes',case when v_request.visibility_mode='named' then l.notes else null end,
      'notes_withheld_for_anonymity',v_request.visibility_mode='anonymous'
    ))
    order by l.line_number
  ),'[]'::jsonb)
  into v_lines
  from public.marketplace_request_lines l
  join public.network_product_families pf on pf.id=l.product_family_id
  left join public.steel_standards s on s.id=l.standard_id
  left join public.steel_material_grades mg on mg.id=l.material_grade_id
  where l.request_id=p_request_id;

  insert into public.marketplace_unlocks(
    request_id,
    supplier_organization_id,
    entitlement_event_id,
    entitlement_key,
    source_kind,
    unlocked_by_user_id
  )
  values(
    p_request_id,
    p_supplier_organization_id,
    (v_state->>'entitlement_event_id')::uuid,
    v_state->>'entitlement_key',
    v_state->>'source_kind',
    v_user
  )
  on conflict(request_id,supplier_organization_id) do nothing;

  return jsonb_build_object(
    'contract','P5.3-detail-v1',
    'request',jsonb_build_object(
      'request_id',v_request.id,
      'visibility_mode',v_request.visibility_mode,
      'effective_status',case
        when v_request.closes_at<=now()+interval '24 hours' then 'closing_soon'
        else 'open'
      end,
      'opens_at',v_request.opens_at,
      'closes_at',v_request.closes_at,
      'seconds_remaining',greatest(
        floor(extract(epoch from (v_request.closes_at-now())))::bigint,0
      )
    ),
    'buyer',v_teaser->'buyer',
    'entitlement',(v_state - 'entitlement_event_id'),
    'lines',v_lines,
    'can_respond',false
  );
end;
$function$;

revoke all on function private.p5_3_marketplace_detail_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_3_marketplace_detail_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_3_marketplace_detail(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_3_marketplace_detail_impl(
    p_supplier_organization_id,p_request_id
  );
$function$;

revoke all on function public.p5_3_marketplace_detail(uuid,uuid)
from public,anon;
grant execute on function public.p5_3_marketplace_detail(uuid,uuid)
to authenticated,service_role;

comment on table public.marketplace_entitlement_events is
  'P5.3 append-only provider-neutral Marketplace entitlement lifecycle ledger. Grant/revoke state is server-resolved; expiry is time-derived.';
comment on table public.marketplace_unlocks is
  'P5.3 append-only audit of the first successful locked-detail access for a supplier organization and Marketplace request.';
comment on function public.p5_3_grant_entitlement(uuid,text,uuid,text,text,timestamptz,text,jsonb) is
  'P5.3 Platform Owner/service integration entitlement grant. Suppliers cannot self-grant.';
comment on function public.p5_3_revoke_entitlement(uuid,text,uuid,text,text,text,jsonb) is
  'P5.3 Platform Owner/service integration entitlement revoke. Append-only event; does not delete history.';
comment on function public.p5_3_entitlement_state(uuid,uuid) is
  'P5.3 supplier-organization entitlement read model for an open foreign Marketplace request.';
comment on function public.p5_3_marketplace_detail(uuid,uuid) is
  'P5.3 entitlement-gated Marketplace locked detail. Anonymous buyer identity and free-text notes remain withheld; no response rights are granted.';
