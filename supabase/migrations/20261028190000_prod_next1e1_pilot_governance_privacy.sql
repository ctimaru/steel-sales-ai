-- PROD-NEXT1.E1 — privacy and operator authorization layer for existing P5.6.
-- This is preparation ONLY: no live pilot, no telemetry table, no customer measurements.
-- A later, independently reviewed migration must explicitly authorize the launch.
create table public.pilot_activation_admissions (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  state text not null default 'review' check (state in ('review','verified','approved','suspended','withdrawn')),
  legal_basis_reference text,
  notice_version text,
  terms_version text,
  verified_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  constraint pilot_activation_versions_limit check (
    char_length(coalesce(legal_basis_reference,'')) <= 120
    and char_length(coalesce(notice_version,'')) <= 80
    and char_length(coalesce(terms_version,'')) <= 80
  )
);
create table public.pilot_activation_preferences (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null default 'activation_analytics' check (purpose='activation_analytics'),
  decision text not null check (decision in ('granted','denied')),
  notice_version text not null,
  decided_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,user_id,purpose),
  constraint pilot_activation_preferences_version_limit check (char_length(notice_version) between 1 and 80)
);
-- Private release gate cannot be edited from the app or by any authenticated user.
create table private.pilot_activation_release_gate (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  legal_approved boolean not null default false,
  restore_approved boolean not null default false,
  support_approved boolean not null default false,
  approved_notice_version text,
  approved_at timestamptz
);
insert into private.pilot_activation_release_gate (singleton) values (true);
alter table public.pilot_activation_admissions enable row level security;
alter table public.pilot_activation_preferences enable row level security;
alter table private.pilot_activation_release_gate enable row level security;
revoke all on public.pilot_activation_admissions from public,anon,authenticated;
revoke all on public.pilot_activation_preferences from public,anon,authenticated;
revoke all on private.pilot_activation_release_gate from public,anon,authenticated,service_role;
grant select,insert,update on public.pilot_activation_admissions to postgres,service_role;
grant select,insert,update on public.pilot_activation_preferences to postgres,service_role;

-- Deny the EXISTING activation RPC at the database boundary, not merely the UI.
-- Existing P5.6 local tests can build candidates but must not activate until a
-- separately approved gate is installed. Current release_gate.enabled=false.
create or replace function private.prod_next1e_guard_active_participant()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_gate private.pilot_activation_release_gate%rowtype;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    select * into v_gate from private.pilot_activation_release_gate where singleton=true;
    if not found or not (
      v_gate.enabled and v_gate.legal_approved and v_gate.restore_approved
      and v_gate.support_approved and v_gate.approved_at is not null
      and nullif(btrim(v_gate.approved_notice_version),'') is not null
    ) then
      raise exception 'PROD-NEXT1.E1: real company pilot not authorized'
        using errcode='42501';
    end if;
    if not exists (
      select 1 from public.pilot_activation_admissions a
      where a.organization_id=new.organization_id
        and a.state='approved' and a.approved_by is not null
        and a.notice_version=v_gate.approved_notice_version
        and nullif(btrim(a.legal_basis_reference),'') is not null
        and nullif(btrim(a.terms_version),'') is not null
    ) then
      raise exception 'PROD-NEXT1.E1: company admission not approved'
        using errcode='42501';
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.prod_next1e_guard_active_participant() from public,anon,authenticated;
create trigger prod_next1e_guard_activation
before insert or update of status on public.marketplace_pilot_participants
for each row execute function private.prod_next1e_guard_active_participant();

-- Superadmin-only review. This records a human attestation; it does not verify
-- documents automatically and it cannot change the locked release gate.
create or replace function private.prod_next1e_review_impl(
  p_organization_id uuid, p_action text,
  p_basis_reference text default null, p_notice_version text default null,
  p_terms_version text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := private.p5_6a_require_owner();
  v_before public.pilot_activation_admissions%rowtype;
  v_after public.pilot_activation_admissions%rowtype;
begin
  if p_action not in ('review','verify','approve','suspend','withdraw') then
    raise exception 'Invalid admission action' using errcode='22023';
  end if;
  if not exists (select 1 from public.marketplace_pilot_participants
    where organization_id=p_organization_id and status <> 'removed') then
    raise exception 'No P5.6 candidate organization' using errcode='22023';
  end if;
  select * into v_before from public.pilot_activation_admissions
    where organization_id=p_organization_id for update;
  if p_action='approve' and (
    v_before.state is distinct from 'verified'
    or nullif(btrim(coalesce(v_before.notice_version,'')),'') is null
    or nullif(btrim(coalesce(v_before.terms_version,'')),'') is null
    or nullif(btrim(coalesce(v_before.legal_basis_reference,'')),'') is null
  ) then
    raise exception 'Verified legal documents required before approval' using errcode='22023';
  end if;
  if p_action in ('suspend','withdraw') and exists (
    select 1 from public.marketplace_pilot_participants
    where organization_id=p_organization_id and status='active'
  ) then
    raise exception 'Pause active participant to revoke entitlement before admission change' using errcode='22023';
  end if;
  if p_action='verify' and (
    nullif(btrim(coalesce(p_basis_reference,'')),'') is null
    or nullif(btrim(coalesce(p_notice_version,'')),'') is null
    or nullif(btrim(coalesce(p_terms_version,'')),'') is null
  ) then
    raise exception 'Basis, notice and terms versions are required' using errcode='22023';
  end if;
  insert into public.pilot_activation_admissions (
    organization_id,state,legal_basis_reference,notice_version,terms_version,
    verified_by,approved_by,reviewed_at,updated_at
  ) values (
    p_organization_id,
    case p_action when 'verify' then 'verified' when 'approve' then 'approved'
      when 'suspend' then 'suspended' when 'withdraw' then 'withdrawn' else 'review' end,
    case when p_action='verify' then btrim(p_basis_reference) else null end,
    case when p_action='verify' then btrim(p_notice_version) else null end,
    case when p_action='verify' then btrim(p_terms_version) else null end,
    case when p_action='verify' then v_actor else null end,
    case when p_action='approve' then v_actor else null end,
    clock_timestamp(),clock_timestamp()
  ) on conflict (organization_id) do update set
    state=excluded.state,
    legal_basis_reference=case when p_action='verify' then excluded.legal_basis_reference
      when p_action='approve' then public.pilot_activation_admissions.legal_basis_reference else null end,
    notice_version=case when p_action='verify' then excluded.notice_version
      when p_action='approve' then public.pilot_activation_admissions.notice_version else null end,
    terms_version=case when p_action='verify' then excluded.terms_version
      when p_action='approve' then public.pilot_activation_admissions.terms_version else null end,
    verified_by=case when p_action='approve' then public.pilot_activation_admissions.verified_by
      else excluded.verified_by end,
    approved_by=excluded.approved_by,
    reviewed_at=clock_timestamp(), updated_at=clock_timestamp()
  returning * into v_after;
  perform private.sa2_record_platform_event(
    'platform.console.access','prod_next1e_admission_'||p_action,
    'pilot_activation_admission',p_organization_id::text,p_organization_id,
    case when v_before.organization_id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_after),'PROD-NEXT1.E1 admission review',
    jsonb_build_object('state',v_after.state)
  );
  return jsonb_build_object('state',v_after.state);
end; $$;
revoke all on function private.prod_next1e_review_impl(uuid,text,text,text,text) from public,anon;
grant execute on function private.prod_next1e_review_impl(uuid,text,text,text,text) to authenticated;
create or replace function public.prod_next1e_review_admission(
  p_organization_id uuid,p_action text,
  p_basis_reference text default null,p_notice_version text default null,
  p_terms_version text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select private.prod_next1e_review_impl(p_organization_id,p_action,p_basis_reference,p_notice_version,p_terms_version);
$$;
revoke all on function public.prod_next1e_review_admission(uuid,text,text,text,text) from public,anon;
grant execute on function public.prod_next1e_review_admission(uuid,text,text,text,text) to authenticated;

-- A person may withdraw analytics permission even after loss of membership.
-- Granting is impossible while the launch gate is closed.
create or replace function private.prod_next1e_preference_impl(
  p_organization_id uuid, p_decision text, p_notice_version text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_gate private.pilot_activation_release_gate%rowtype;
  v_member boolean;
begin
  if v_actor is null or p_decision not in ('granted','denied') then
    raise exception 'Invalid preference actor or decision' using errcode='42501';
  end if;
  select exists(select 1 from public.organization_memberships m
    where m.organization_id=p_organization_id and m.user_id=v_actor and m.status='active')
    into v_member;
  if not v_member and not exists(select 1 from public.pilot_activation_preferences
    where organization_id=p_organization_id and user_id=v_actor and purpose='activation_analytics') then
    raise exception 'Not an eligible organization member' using errcode='42501';
  end if;
  select * into v_gate from private.pilot_activation_release_gate where singleton=true;
  if p_decision='granted' and not (
    v_member and coalesce(v_gate.enabled,false) and coalesce(v_gate.legal_approved,false)
    and coalesce(v_gate.restore_approved,false) and coalesce(v_gate.support_approved,false)
    and v_gate.approved_at is not null
    and p_notice_version=v_gate.approved_notice_version
    and exists(select 1 from public.pilot_activation_admissions
      where organization_id=p_organization_id and state='approved'
        and notice_version=p_notice_version)
    and exists(select 1 from public.marketplace_pilot_participants
      where organization_id=p_organization_id and status='active')
  ) then
    raise exception 'Analytics collection is not authorized for this cohort' using errcode='42501';
  end if;
  if p_decision='denied' and not v_member
     and not exists(select 1 from public.pilot_activation_preferences
       where organization_id=p_organization_id and user_id=v_actor) then
    raise exception 'Not eligible for withdrawal' using errcode='42501';
  end if;
  insert into public.pilot_activation_preferences(organization_id,user_id,decision,notice_version)
  values(p_organization_id,v_actor,p_decision,
    case when p_decision='denied' then 'withdrawn' else p_notice_version end)
  on conflict (organization_id,user_id,purpose) do update set
    decision=excluded.decision,notice_version=excluded.notice_version,decided_at=clock_timestamp();
  return jsonb_build_object('decision',p_decision);
end; $$;
revoke all on function private.prod_next1e_preference_impl(uuid,text,text) from public,anon;
grant execute on function private.prod_next1e_preference_impl(uuid,text,text) to authenticated;
create or replace function public.prod_next1e_set_analytics_preference(
  p_organization_id uuid,p_decision text,p_notice_version text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.prod_next1e_preference_impl(p_organization_id,p_decision,p_notice_version);
$$;
revoke all on function public.prod_next1e_set_analytics_preference(uuid,text,text) from public,anon;
grant execute on function public.prod_next1e_set_analytics_preference(uuid,text,text) to authenticated;

-- Console read: no user preferences or commercial payloads returned.
create or replace function private.prod_next1e_governance_impl()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owner uuid := private.p5_6a_require_owner();
begin
  return jsonb_build_object(
    'gate','NO-GO',
    'telemetry_enabled',false,
    'admissions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'organization_id',a.organization_id,'state',a.state,
        'legal_basis_reference',a.legal_basis_reference,
        'notice_version',a.notice_version,'terms_version',a.terms_version,
        'reviewed_at',a.reviewed_at
      ) order by a.updated_at desc)
      from public.pilot_activation_admissions a
    ),'[]'::jsonb)
  );
end; $$;
revoke all on function private.prod_next1e_governance_impl() from public,anon;
grant execute on function private.prod_next1e_governance_impl() to authenticated;
create or replace function public.prod_next1e_governance()
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.prod_next1e_governance_impl();
$$;
revoke all on function public.prod_next1e_governance() from public,anon;
grant execute on function public.prod_next1e_governance() to authenticated;

-- No SQL insert/telemetry RPC exists in this foundation; all five KPIs remain UNKNOWN.
