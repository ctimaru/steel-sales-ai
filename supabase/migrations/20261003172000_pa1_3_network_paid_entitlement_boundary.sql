-- PA1.3 — Network Paid Access & Entitlement Boundary.
--
-- The Network is a private monetizable product after registration.
-- Company claim and management of the organization's own profile remain separate
-- from paid Network browsing.

create table public.organization_product_entitlement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_key text not null,
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

  constraint organization_product_entitlement_events_product_key_check
    check (char_length(btrim(product_key)) between 3 and 80 and product_key ~ '^[a-z0-9_]+$'),
  constraint organization_product_entitlement_events_type_check
    check (event_type in ('granted','revoked')),
  constraint organization_product_entitlement_events_source_check
    check (source_kind in ('subscription','bundle','trial','pilot','manual','system')),
  constraint organization_product_entitlement_events_source_reference_check
    check (source_reference is null or char_length(btrim(source_reference)) between 1 and 240),
  constraint organization_product_entitlement_events_idempotency_check
    check (
      char_length(btrim(idempotency_key)) between 8 and 200
      and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    ),
  constraint organization_product_entitlement_events_lifecycle_check
    check (
      (event_type='granted' and (expires_at is null or expires_at>effective_at))
      or
      (event_type='revoked' and expires_at is null)
    ),
  constraint organization_product_entitlement_events_actor_check
    check (actor_authority_type in ('platform_owner','service','system')),
  constraint organization_product_entitlement_events_metadata_check
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=16384)
);

create unique index organization_product_entitlement_events_idempotency_uidx
  on public.organization_product_entitlement_events(idempotency_key);

create index organization_product_entitlement_events_resolution_idx
  on public.organization_product_entitlement_events(
    organization_id,
    product_key,
    effective_at desc,
    created_at desc,
    id desc
  );

alter table public.organization_product_entitlement_events enable row level security;
revoke all on table public.organization_product_entitlement_events
  from public,anon,authenticated;
grant select,insert on table public.organization_product_entitlement_events
  to service_role;

create or replace function private.pa1_3_entitlement_append_only_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'PA1.3 product entitlement ledger is append-only'
    using errcode='55000';
end;
$function$;

revoke all on function private.pa1_3_entitlement_append_only_guard()
from public,anon,authenticated;

create trigger organization_product_entitlement_events_append_only
before update or delete on public.organization_product_entitlement_events
for each row execute function private.pa1_3_entitlement_append_only_guard();

create or replace function private.pa1_3_current_organization_id()
returns uuid
language sql
stable
security definer
set search_path=''
as $function$
  select om.organization_id
  from public.organization_memberships om
  where om.user_id=(select auth.uid())
    and om.status='active'
  order by om.is_default desc,om.created_at,om.organization_id
  limit 1;
$function$;

revoke all on function private.pa1_3_current_organization_id()
from public,anon;
grant execute on function private.pa1_3_current_organization_id()
to authenticated,service_role;

create or replace function private.pa1_3_network_access_allowed_for(
  p_organization_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_event public.organization_product_entitlement_events%rowtype;
begin
  if v_user is null then
    return false;
  end if;

  if private.is_platform_superadmin() then
    return true;
  end if;

  if not exists(
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user
      and om.status='active'
  ) then
    return false;
  end if;

  select *
  into v_event
  from public.organization_product_entitlement_events e
  where e.organization_id=p_organization_id
    and e.product_key='network_access'
    and e.effective_at<=now()
  order by e.effective_at desc,e.created_at desc,e.id desc
  limit 1;

  return found
    and v_event.event_type='granted'
    and (v_event.expires_at is null or v_event.expires_at>now());
end;
$function$;

revoke all on function private.pa1_3_network_access_allowed_for(uuid)
from public,anon;
grant execute on function private.pa1_3_network_access_allowed_for(uuid)
to authenticated,service_role;

create or replace function private.pa1_3_current_network_access_allowed()
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(
    private.pa1_3_network_access_allowed_for(
      private.pa1_3_current_organization_id()
    ),
    false
  );
$function$;

revoke all on function private.pa1_3_current_network_access_allowed()
from public,anon;
grant execute on function private.pa1_3_current_network_access_allowed()
to authenticated,service_role;

create or replace function private.pa1_3_require_network_access(
  p_organization_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $function$
begin
  if not private.pa1_3_network_access_allowed_for(p_organization_id) then
    raise exception 'Network entitlement required'
      using errcode='42501';
  end if;
end;
$function$;

revoke all on function private.pa1_3_require_network_access(uuid)
from public,anon;
grant execute on function private.pa1_3_require_network_access(uuid)
to authenticated,service_role;

create or replace function private.pa1_3_require_current_network_access()
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_organization_id uuid;
begin
  v_organization_id:=private.pa1_3_current_organization_id();

  if v_organization_id is null then
    raise exception 'active organization membership required'
      using errcode='42501';
  end if;

  perform private.pa1_3_require_network_access(v_organization_id);
  return v_organization_id;
end;
$function$;

revoke all on function private.pa1_3_require_current_network_access()
from public,anon;
grant execute on function private.pa1_3_require_current_network_access()
to authenticated,service_role;

create or replace function private.pa1_3_network_access_state_impl(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_event public.organization_product_entitlement_events%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if private.is_platform_superadmin() then
    return jsonb_build_object(
      'contract','PA1.3-network-access-v1',
      'organization_id',p_organization_id,
      'product_key','network_access',
      'state','entitled',
      'can_access_network',true,
      'source_kind','platform_owner',
      'source_reference',null,
      'expires_at',null
    );
  end if;

  if not exists(
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user
      and om.status='active'
  ) then
    raise exception 'active organization membership required'
      using errcode='42501';
  end if;

  select *
  into v_event
  from public.organization_product_entitlement_events e
  where e.organization_id=p_organization_id
    and e.product_key='network_access'
    and e.effective_at<=now()
  order by e.effective_at desc,e.created_at desc,e.id desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'contract','PA1.3-network-access-v1',
      'organization_id',p_organization_id,
      'product_key','network_access',
      'state','locked',
      'can_access_network',false,
      'source_kind',null,
      'source_reference',null,
      'expires_at',null
    );
  end if;

  if v_event.event_type='revoked' then
    return jsonb_build_object(
      'contract','PA1.3-network-access-v1',
      'organization_id',p_organization_id,
      'product_key','network_access',
      'state','revoked',
      'can_access_network',false,
      'source_kind',v_event.source_kind,
      'source_reference',v_event.source_reference,
      'expires_at',null
    );
  end if;

  if v_event.expires_at is not null and v_event.expires_at<=now() then
    return jsonb_build_object(
      'contract','PA1.3-network-access-v1',
      'organization_id',p_organization_id,
      'product_key','network_access',
      'state','expired',
      'can_access_network',false,
      'source_kind',v_event.source_kind,
      'source_reference',v_event.source_reference,
      'expires_at',v_event.expires_at
    );
  end if;

  return jsonb_build_object(
    'contract','PA1.3-network-access-v1',
    'organization_id',p_organization_id,
    'product_key','network_access',
    'state','entitled',
    'can_access_network',true,
    'source_kind',v_event.source_kind,
    'source_reference',v_event.source_reference,
    'expires_at',v_event.expires_at
  );
end;
$function$;

revoke all on function private.pa1_3_network_access_state_impl(uuid)
from public,anon;
grant execute on function private.pa1_3_network_access_state_impl(uuid)
to authenticated,service_role;

create or replace function public.pa1_3_network_access_state(
  p_organization_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_3_network_access_state_impl(p_organization_id);
$function$;

revoke all on function public.pa1_3_network_access_state(uuid)
from public,anon;
grant execute on function public.pa1_3_network_access_state(uuid)
to authenticated,service_role;

create or replace function private.pa1_3_require_entitlement_authority()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_role text := coalesce(
    (select auth.jwt()->>'role'),
    nullif(current_setting('request.jwt.claim.role',true),''),
    ''
  );
begin
  if v_role='service_role' then
    return jsonb_build_object(
      'actor_user_id',null,
      'actor_authority_type','service'
    );
  end if;

  if v_user is not null and private.is_platform_superadmin() then
    return jsonb_build_object(
      'actor_user_id',v_user,
      'actor_authority_type','platform_owner'
    );
  end if;

  raise exception 'Network entitlement authority required'
    using errcode='42501';
end;
$function$;

revoke all on function private.pa1_3_require_entitlement_authority()
from public,anon;
grant execute on function private.pa1_3_require_entitlement_authority()
to authenticated,service_role;

create or replace function private.pa1_3_grant_network_access_impl(
  p_organization_id uuid,
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
  v_event public.organization_product_entitlement_events%rowtype;
  v_source text := lower(btrim(coalesce(p_source_kind,'')));
  v_reference text := nullif(btrim(coalesce(p_source_reference,'')),'');
  v_idempotency text := btrim(coalesce(p_idempotency_key,''));
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  v_authority:=private.pa1_3_require_entitlement_authority();

  if not exists(
    select 1 from public.organizations o where o.id=p_organization_id
  ) then
    raise exception 'organization not found' using errcode='P0002';
  end if;

  if v_source not in ('subscription','bundle','trial','pilot','manual','system') then
    raise exception 'unsupported Network entitlement source'
      using errcode='22023';
  end if;

  if v_source in ('subscription','bundle') and v_reference is null then
    raise exception 'subscription/bundle Network entitlement requires source_reference'
      using errcode='22023';
  end if;

  if char_length(v_idempotency) not between 8 and 200
     or v_idempotency !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid Network entitlement idempotency key'
      using errcode='22023';
  end if;

  if jsonb_typeof(v_metadata)<>'object' or pg_column_size(v_metadata)>16384 then
    raise exception 'Network entitlement metadata must be a JSON object <= 16KB'
      using errcode='22023';
  end if;

  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'Network entitlement expiry must be in the future'
      using errcode='22023';
  end if;

  select * into v_event
  from public.organization_product_entitlement_events e
  where e.idempotency_key=v_idempotency;

  if found then
    if v_event.organization_id=p_organization_id
       and v_event.product_key='network_access'
       and v_event.event_type='granted'
       and v_event.source_kind=v_source
       and v_event.source_reference is not distinct from v_reference
       and v_event.expires_at is not distinct from p_expires_at
       and v_event.metadata=v_metadata then
      return jsonb_build_object(
        'event_id',v_event.id,
        'organization_id',v_event.organization_id,
        'product_key','network_access',
        'event_type','granted',
        'source_kind',v_event.source_kind,
        'expires_at',v_event.expires_at,
        'idempotent',true
      );
    end if;

    raise exception 'Network entitlement idempotency key conflict'
      using errcode='23505';
  end if;

  insert into public.organization_product_entitlement_events(
    organization_id,product_key,event_type,source_kind,source_reference,
    idempotency_key,effective_at,expires_at,actor_user_id,actor_authority_type,metadata
  )
  values(
    p_organization_id,'network_access','granted',v_source,v_reference,
    v_idempotency,now(),p_expires_at,
    nullif(v_authority->>'actor_user_id','')::uuid,
    v_authority->>'actor_authority_type',
    v_metadata
  )
  returning * into v_event;

  return jsonb_build_object(
    'event_id',v_event.id,
    'organization_id',v_event.organization_id,
    'product_key','network_access',
    'event_type','granted',
    'source_kind',v_event.source_kind,
    'expires_at',v_event.expires_at,
    'idempotent',false
  );
end;
$function$;

revoke all on function private.pa1_3_grant_network_access_impl(uuid,text,text,timestamptz,text,jsonb)
from public,anon;
grant execute on function private.pa1_3_grant_network_access_impl(uuid,text,text,timestamptz,text,jsonb)
to authenticated,service_role;

create or replace function public.pa1_3_grant_network_access(
  p_organization_id uuid,
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
  select private.pa1_3_grant_network_access_impl(
    p_organization_id,p_source_kind,p_source_reference,p_expires_at,
    p_idempotency_key,p_metadata
  );
$function$;

revoke all on function public.pa1_3_grant_network_access(uuid,text,text,timestamptz,text,jsonb)
from public,anon;
grant execute on function public.pa1_3_grant_network_access(uuid,text,text,timestamptz,text,jsonb)
to authenticated,service_role;

create or replace function private.pa1_3_revoke_network_access_impl(
  p_organization_id uuid,
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
  v_event public.organization_product_entitlement_events%rowtype;
  v_source text := lower(btrim(coalesce(p_source_kind,'')));
  v_reference text := nullif(btrim(coalesce(p_source_reference,'')),'');
  v_idempotency text := btrim(coalesce(p_idempotency_key,''));
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  v_authority:=private.pa1_3_require_entitlement_authority();

  if v_source not in ('subscription','bundle','trial','pilot','manual','system') then
    raise exception 'unsupported Network entitlement source'
      using errcode='22023';
  end if;

  if char_length(v_idempotency) not between 8 and 200
     or v_idempotency !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid Network entitlement idempotency key'
      using errcode='22023';
  end if;

  if jsonb_typeof(v_metadata)<>'object' or pg_column_size(v_metadata)>16384 then
    raise exception 'Network entitlement metadata must be a JSON object <= 16KB'
      using errcode='22023';
  end if;

  select * into v_event
  from public.organization_product_entitlement_events e
  where e.idempotency_key=v_idempotency;

  if found then
    if v_event.organization_id=p_organization_id
       and v_event.product_key='network_access'
       and v_event.event_type='revoked'
       and v_event.source_kind=v_source
       and v_event.source_reference is not distinct from v_reference
       and v_event.metadata=v_metadata then
      return jsonb_build_object(
        'event_id',v_event.id,
        'organization_id',v_event.organization_id,
        'product_key','network_access',
        'event_type','revoked',
        'source_kind',v_event.source_kind,
        'idempotent',true
      );
    end if;

    raise exception 'Network entitlement idempotency key conflict'
      using errcode='23505';
  end if;

  if not exists(
    select 1
    from public.organization_product_entitlement_events e
    where e.organization_id=p_organization_id
      and e.product_key='network_access'
      and e.event_type='granted'
  ) then
    raise exception 'cannot revoke Network entitlement without grant history'
      using errcode='22023';
  end if;

  insert into public.organization_product_entitlement_events(
    organization_id,product_key,event_type,source_kind,source_reference,
    idempotency_key,effective_at,expires_at,actor_user_id,actor_authority_type,metadata
  )
  values(
    p_organization_id,'network_access','revoked',v_source,v_reference,
    v_idempotency,now(),null,
    nullif(v_authority->>'actor_user_id','')::uuid,
    v_authority->>'actor_authority_type',
    v_metadata
  )
  returning * into v_event;

  return jsonb_build_object(
    'event_id',v_event.id,
    'organization_id',v_event.organization_id,
    'product_key','network_access',
    'event_type','revoked',
    'source_kind',v_event.source_kind,
    'idempotent',false
  );
end;
$function$;

revoke all on function private.pa1_3_revoke_network_access_impl(uuid,text,text,text,jsonb)
from public,anon;
grant execute on function private.pa1_3_revoke_network_access_impl(uuid,text,text,text,jsonb)
to authenticated,service_role;

create or replace function public.pa1_3_revoke_network_access(
  p_organization_id uuid,
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
  select private.pa1_3_revoke_network_access_impl(
    p_organization_id,p_source_kind,p_source_reference,p_idempotency_key,p_metadata
  );
$function$;

revoke all on function public.pa1_3_revoke_network_access(uuid,text,text,text,jsonb)
from public,anon;
grant execute on function public.pa1_3_revoke_network_access(uuid,text,text,text,jsonb)
to authenticated,service_role;

-- Restrictive RLS: existing publication/ownership policies still apply, but
-- authenticated Network reads now additionally require the active workspace's
-- Network entitlement.
do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'network_company_roles',
    'network_company_subtypes',
    'network_capabilities',
    'network_product_families',
    'network_markets',
    'network_certification_types',
    'network_companies',
    'network_facilities',
    'network_contacts',
    'network_company_role_assignments',
    'network_company_subtype_assignments',
    'network_company_products',
    'network_company_markets',
    'network_facility_capabilities',
    'network_company_certifications'
  ]
  loop
    execute format(
      'create policy pa1_3_network_entitlement_read on public.%I as restrictive for select to authenticated using (private.pa1_3_current_network_access_allowed())',
      v_table
    );
  end loop;
end;
$block$;

create policy pa1_3_network_saved_entitlement
on public.network_saved_companies
as restrictive
for all
to authenticated
using (private.pa1_3_current_network_access_allowed())
with check (private.pa1_3_current_network_access_allowed());

-- Public profile RPCs use privileged private helpers, so they need an explicit
-- entitlement assertion in addition to table RLS.
create or replace function public.p3_7c_public_company_profile(p_company_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
begin
  perform private.pa1_3_require_current_network_access();
  return private.p3_7c_public_company_profile_impl(p_company_id);
end;
$function$;

create or replace function public.p3_7d_public_identity_contacts(p_network_company_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
begin
  perform private.pa1_3_require_current_network_access();
  return private.p3_7d_public_identity_contacts_impl(p_network_company_id);
end;
$function$;

create or replace function public.p3_7e_public_product_scope(p_network_company_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
begin
  perform private.pa1_3_require_current_network_access();
  return private.p3_7e_public_product_scope_impl(p_network_company_id);
end;
$function$;

-- Network interaction RPCs call privileged helpers and therefore assert the
-- entitlement explicitly using their organization actor.
create or replace function public.p4_follow_company(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_7_follow_company_impl(p_organization_id,p_network_company_id);
end;$function$;

create or replace function public.p4_unfollow_company(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_7_unfollow_company_impl(p_organization_id,p_network_company_id);
end;$function$;

create or replace function public.p4_follow_state(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_7_follow_state_impl(p_organization_id,p_network_company_id);
end;$function$;

create or replace function public.p4_list_followed_companies(
  p_organization_id uuid,p_limit integer default 50,p_offset integer default 0
)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_7_list_followed_companies_impl(p_organization_id,p_limit,p_offset);
end;$function$;

create or replace function public.p4_list_activity_feed(
  p_organization_id uuid,p_unread_only boolean default false,
  p_limit integer default 50,p_offset integer default 0
)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_7_activity_feed_impl(p_organization_id,p_unread_only,p_limit,p_offset);
end;$function$;

create or replace function public.p4_mark_activity_read(
  p_organization_id uuid,p_activity_event_id uuid
)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_7_mark_activity_read_impl(p_organization_id,p_activity_event_id);
end;$function$;

create or replace function public.p4_mark_all_activity_read(p_organization_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_7_mark_all_activity_read_impl(p_organization_id);
end;$function$;

create or replace function public.p4_inquiry_eligibility(
  p_sender_organization_id uuid,p_recipient_network_company_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_sender_organization_id);
  return private.p4_inquiry_eligibility_impl(
    p_sender_organization_id,p_recipient_network_company_id
  );
end;$function$;

create or replace function public.p4_submit_inquiry(
  p_sender_organization_id uuid,p_recipient_network_company_id uuid,
  p_subject text,p_body text
)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_sender_organization_id);
  return private.p4_submit_inquiry_impl(
    p_sender_organization_id,p_recipient_network_company_id,p_subject,p_body
  );
end;$function$;

create or replace function public.p4_list_inquiries(
  p_organization_id uuid,p_box text default 'received',
  p_limit integer default 50,p_offset integer default 0
)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_list_inquiries_impl(p_organization_id,p_box,p_limit,p_offset);
end;$function$;

create or replace function public.p4_transition_inquiry(
  p_inquiry_id uuid,p_actor_organization_id uuid,p_new_status text
)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_actor_organization_id);
  return private.p4_transition_inquiry_impl(p_inquiry_id,p_actor_organization_id,p_new_status);
end;$function$;

create or replace function public.p4_report_inquiry(
  p_inquiry_id uuid,p_reporter_organization_id uuid,p_reason text,p_details text default null
)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_reporter_organization_id);
  return private.p4_report_inquiry_impl(
    p_inquiry_id,p_reporter_organization_id,p_reason,p_details
  );
end;$function$;

create or replace function public.p4_get_inquiry_preferences(p_organization_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_get_inquiry_preferences_impl(p_organization_id);
end;$function$;

create or replace function public.p4_set_inquiry_preferences(
  p_organization_id uuid,p_inquiries_enabled boolean
)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_set_inquiry_preferences_impl(p_organization_id,p_inquiries_enabled);
end;$function$;

create or replace function public.p4_block_organization(
  p_blocking_organization_id uuid,p_blocked_organization_id uuid
)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_blocking_organization_id);
  return private.p4_block_organization_impl(
    p_blocking_organization_id,p_blocked_organization_id
  );
end;$function$;

create or replace function public.p4_unblock_organization(
  p_blocking_organization_id uuid,p_blocked_organization_id uuid
)
returns jsonb language plpgsql security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_blocking_organization_id);
  return private.p4_unblock_organization_impl(
    p_blocking_organization_id,p_blocked_organization_id
  );
end;$function$;

create or replace function public.p4_active_interaction_pilot(p_organization_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_active_interaction_pilot_impl(p_organization_id);
end;$function$;

create or replace function public.p4_interaction_pilot_summary(p_organization_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  return private.p4_interaction_pilot_summary_impl(p_organization_id);
end;$function$;

-- Explicit ACLs: no anonymous Network product access; authenticated users can
-- call only through the entitlement-aware wrappers.
revoke all on function public.p3_7c_public_company_profile(uuid) from public,anon;
revoke all on function public.p3_7d_public_identity_contacts(uuid) from public,anon;
revoke all on function public.p3_7e_public_product_scope(uuid) from public,anon;
grant execute on function public.p3_7c_public_company_profile(uuid) to authenticated,service_role;
grant execute on function public.p3_7d_public_identity_contacts(uuid) to authenticated,service_role;
grant execute on function public.p3_7e_public_product_scope(uuid) to authenticated,service_role;

comment on table public.organization_product_entitlement_events is
  'PA1.3 append-only provider-neutral organization product entitlement ledger. Initial product key is network_access; future module keys may reuse the same contract.';
comment on function public.pa1_3_network_access_state(uuid) is
  'PA1.3 active-organization Network product access state. Platform Owner receives operational override.';
comment on function public.pa1_3_grant_network_access(uuid,text,text,timestamptz,text,jsonb) is
  'PA1.3 Platform Owner/service grant for Network product access. Provider-neutral source supports future billing integration.';
comment on function public.pa1_3_revoke_network_access(uuid,text,text,text,jsonb) is
  'PA1.3 Platform Owner/service append-only Network product access revocation.';
