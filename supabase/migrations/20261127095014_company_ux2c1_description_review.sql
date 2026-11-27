-- COMPANY-UX2.C.1: company-admin review of the existing NET-RESEARCH1 summary.
-- The research pipeline and its publication state are unchanged. Human decisions
-- are a separate, private append-only ledger; enrichment review remains separate.

create table private.company_ux2c1_description_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  actor_user_id uuid null references auth.users(id) on delete set null,
  proposal_hash text not null check (proposal_hash ~ '^[a-f0-9]{64}$'),
  summary_hash text not null check (summary_hash ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('accepted','edited','ignored')),
  proposed_description text not null check (char_length(proposed_description) between 80 and 900),
  source_urls text[] not null check (cardinality(source_urls) between 1 and 12),
  extractor_version text,
  observed_at timestamptz,
  before_description text check (before_description is null or char_length(before_description) <= 4000),
  after_description text check (after_description is null or char_length(after_description) <= 4000),
  decided_at timestamptz not null default now(),
  unique (organization_id,network_company_id,summary_hash),
  check (decision <> 'ignored' or before_description is not distinct from after_description)
);
create index company_ux2c1_description_decisions_actor_idx
  on private.company_ux2c1_description_decisions(actor_user_id) where actor_user_id is not null;
alter table private.company_ux2c1_description_decisions enable row level security;
revoke all on private.company_ux2c1_description_decisions from public,anon,authenticated,service_role;

-- Retain the decision if account erasure is later approved, matching the
-- nullable actor retention contract in the P3.7 audit ledger. Only the FK's
-- nested SET NULL after an actual auth-user deletion may anonymize the actor;
-- decisions, sources and every other snapshot field remain immutable.
create function private.company_ux2c1_decision_immutable_guard()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
begin
  if tg_op='UPDATE' and pg_trigger_depth()>1
     and old.actor_user_id is not null and new.actor_user_id is null
     and (to_jsonb(new)-'actor_user_id') is not distinct from (to_jsonb(old)-'actor_user_id')
     and not exists (select 1 from auth.users where id=old.actor_user_id) then
    return new;
  end if;
  raise exception 'company description decisions are immutable' using errcode='55000';
end;
$fn$;
revoke all on function private.company_ux2c1_decision_immutable_guard() from public,anon,authenticated,service_role;
create trigger company_ux2c1_description_decisions_immutable
before update or delete on private.company_ux2c1_description_decisions
for each row execute function private.company_ux2c1_decision_immutable_guard();
comment on table private.company_ux2c1_description_decisions is
  'C.1 immutable owner decisions and exact source snapshots; actor may be anonymized by account erasure. No automatic publication or verification; no direct client access.';

create function private.company_ux2c1_description_hash(p_description text)
returns text language sql immutable security invoker set search_path=''
as $fn$
  select encode(sha256(convert_to(coalesce(p_description,''),'UTF8')),'hex');
$fn$;
revoke all on function private.company_ux2c1_description_hash(text) from public,anon,authenticated,service_role;

-- This is the real M8 company-manager authority, with an explicit organization.
-- Platform superadmin alone is not a substitute for the company's approved claim.
create function private.company_ux2c1_require_owner(p_organization_id uuid,p_network_company_id uuid)
returns uuid language plpgsql stable security definer set search_path=''
as $fn$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;
  if p_organization_id is null or p_network_company_id is null then
    raise exception 'organization and company required' using errcode='22023';
  end if;
  if not private.m7_user_can_manage_network_company(p_network_company_id,v_user)
     or not exists (
       select 1 from public.organization_memberships m
       join public.organization_network_company_links l on l.organization_id=m.organization_id
       join public.network_company_claims cl on cl.organization_id=l.organization_id
         and cl.network_company_id=l.network_company_id
       join public.network_companies c on c.id=l.network_company_id
       where m.organization_id=p_organization_id and m.user_id=v_user
         and m.role='admin' and m.status='active'
         and l.network_company_id=p_network_company_id and l.link_status='active'
         and cl.status='approved' and c.publication_status<>'archived' and c.archived_at is null
     ) then
    raise exception 'approved company claim and active organization admin membership required' using errcode='42501';
  end if;
  return v_user;
end;
$fn$;
revoke all on function private.company_ux2c1_require_owner(uuid,uuid) from public,anon,authenticated,service_role;

-- A deterministic snapshot. Dates of attempts/publication are deliberately NOT
-- part of either hash. Identical summary text is not proposed again after a
-- decision, even when a later extraction changes its sources/version metadata.
create function private.company_ux2c1_description_candidate(
  p_network_company_id uuid,p_current_website_url text,p_research private.network_company_research
)
returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare
  v_summary text;
  v_sources text[];
  v_domain text;
  v_hash text;
begin
  if p_research.status is distinct from 'published' then
    return jsonb_build_object('availability','no_research','proposal',null);
  end if;
  v_summary := btrim(regexp_replace(coalesce(p_research.summary,''),'[[:space:]]+',' ','g'));
  if char_length(v_summary) not between 80 and 900 then
    return jsonb_build_object('availability','no_summary','proposal',null);
  end if;
  select coalesce(array_agg(u order by u),'{}'::text[]) into v_sources
  from (select distinct btrim(value) as u from unnest(p_research.source_urls) as s(value)) sources;
  v_domain := private.hp4_normalize_domain(p_current_website_url);
  if p_current_website_url is null or p_current_website_url !~* '^https?://'
     or v_domain is null or v_domain !~ '^[a-z0-9.-]+$'
     or cardinality(v_sources) not between 1 and 12
     or exists (
       select 1 from unnest(v_sources) u
       where u is null or char_length(u) not between 10 and 2048
         or u !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#]|$)'
         or (private.hp4_normalize_domain(u) is distinct from v_domain
             and private.hp4_normalize_domain(u) not like '%.' || v_domain)
     ) then
    return jsonb_build_object('availability','source_mismatch','proposal',null);
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'contract','company-ux2c1-description-v1','company_id',p_network_company_id,
    'summary',v_summary,'source_urls',to_jsonb(v_sources),
    'extractor_version',p_research.extractor_version
  )::text,'UTF8')),'hex');
  return jsonb_build_object('availability','available','proposal',jsonb_build_object(
    'hash',v_hash,'summary_hash',private.company_ux2c1_description_hash(v_summary),
    'description',v_summary,'source_urls',to_jsonb(v_sources),
    -- This is when the saved research proposal was published, not a verification.
    -- researched_at can advance on a failed refresh while these contents stay old.
    'observed_at',p_research.published_at,'extractor_version',p_research.extractor_version
  ));
end;
$fn$;
revoke all on function private.company_ux2c1_description_candidate(uuid,text,private.network_company_research)
  from public,anon,authenticated,service_role;

create function private.company_ux2c1_description_review_impl(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_company public.network_companies%rowtype;
  v_research private.network_company_research%rowtype;
  v_decision private.company_ux2c1_description_decisions%rowtype;
  v_candidate jsonb;
  v_proposal jsonb;
  v_availability text;
begin
  perform private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);
  select * into v_company from public.network_companies where id=p_network_company_id;
  select * into v_research from private.network_company_research where company_id=p_network_company_id;
  v_candidate := private.company_ux2c1_description_candidate(p_network_company_id,v_company.website_url,v_research);
  v_proposal := v_candidate->'proposal';
  v_availability := v_candidate->>'availability';
  if v_availability='available' then
    select * into v_decision from private.company_ux2c1_description_decisions
    where organization_id=p_organization_id and network_company_id=p_network_company_id
      and summary_hash=v_proposal->>'summary_hash';
    if found then
      v_availability := 'already_decided';
      -- A decided card shows the exact reviewed snapshot, not newer metadata
      -- from another extraction of the same words. No actor details are exposed.
      v_proposal := jsonb_build_object(
        'hash',v_decision.proposal_hash,'summary_hash',v_decision.summary_hash,
        'description',v_decision.proposed_description,'source_urls',to_jsonb(v_decision.source_urls),
        'observed_at',v_decision.observed_at,'extractor_version',v_decision.extractor_version
      );
    elsif btrim(regexp_replace(coalesce(v_company.description,''),'[[:space:]]+',' ','g'))=v_proposal->>'description' then
      v_availability := 'already_current';
    end if;
  end if;
  return jsonb_build_object(
    'contract','company-ux2c1-description-v1','network_company_id',p_network_company_id,
    'current_description',v_company.description,
    'current_description_hash',private.company_ux2c1_description_hash(v_company.description),
    'availability',v_availability,'proposal',v_proposal,
    'decision',case when v_decision.id is not null then jsonb_build_object(
      'action',v_decision.decision,'decided_at',v_decision.decided_at) else null end
  );
end;
$fn$;
revoke all on function private.company_ux2c1_description_review_impl(uuid,uuid) from public,anon,service_role;
grant execute on function private.company_ux2c1_description_review_impl(uuid,uuid) to authenticated;

create function public.company_ux2c1_description_review(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $fn$
  select private.company_ux2c1_description_review_impl(p_organization_id,p_network_company_id);
$fn$;
revoke all on function public.company_ux2c1_description_review(uuid,uuid) from public,anon,service_role;
grant execute on function public.company_ux2c1_description_review(uuid,uuid) to authenticated;

create function private.company_ux2c1_decide_description_impl(
  p_organization_id uuid,p_network_company_id uuid,p_expected_proposal_hash text,
  p_expected_description_hash text,p_action text,p_description text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_user uuid;
  v_company public.network_companies%rowtype;
  v_after public.network_companies%rowtype;
  v_research private.network_company_research%rowtype;
  v_existing private.company_ux2c1_description_decisions%rowtype;
  v_candidate jsonb;
  v_proposal jsonb;
  v_action text;
  v_description text;
  v_sources text[];
  v_decision_id uuid;
  v_assertion_id uuid;
begin
  v_user := private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);
  if p_expected_proposal_hash is null or p_expected_proposal_hash !~ '^[a-f0-9]{64}$'
     or p_expected_description_hash is null or p_expected_description_hash !~ '^[a-f0-9]{64}$'
     or p_action is null or p_action not in ('accept','edit','ignore')
     or (p_action='edit' and (p_description is null or char_length(btrim(p_description))=0 or char_length(p_description)>4000))
     or (p_action<>'edit' and p_description is not null) then
    raise exception 'invalid description review input' using errcode='22023';
  end if;
  v_action := case p_action when 'accept' then 'accepted' when 'edit' then 'edited' else 'ignored' end;
  select * into v_company from public.network_companies where id=p_network_company_id for update;
  perform private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);

  -- A retry of a completed exact request is a no-op, even after the first apply
  -- changed description. A different decision must never overwrite that result.
  select * into v_existing from private.company_ux2c1_description_decisions
  where organization_id=p_organization_id and network_company_id=p_network_company_id
    and proposal_hash=p_expected_proposal_hash;
  if found then
    if v_existing.decision<>v_action or (p_action='edit' and v_existing.after_description is distinct from btrim(p_description)) then
      raise exception 'company_ux2c1_already_decided' using errcode='40001';
    end if;
    return jsonb_build_object('contract','company-ux2c1-description-v1',
      'decision',v_existing.decision,'decision_id',v_existing.id,
      'description',v_company.description,'description_hash',private.company_ux2c1_description_hash(v_company.description),
      'changed',false,'idempotent',true);
  end if;

  -- Lock order matches research queue: company, then research. Keeping the
  -- source row stable prevents an extraction from changing between check/apply.
  select * into v_research from private.network_company_research
  where company_id=p_network_company_id for share;
  v_candidate := private.company_ux2c1_description_candidate(p_network_company_id,v_company.website_url,v_research);
  v_proposal := v_candidate->'proposal';
  if v_candidate->>'availability'<>'available' or (v_proposal->>'hash') is distinct from p_expected_proposal_hash then
    raise exception 'company_ux2c1_proposal_changed' using errcode='40001';
  end if;
  if private.company_ux2c1_description_hash(v_company.description) is distinct from p_expected_description_hash then
    raise exception 'company_ux2c1_description_changed' using errcode='40001';
  end if;
  if exists (select 1 from private.company_ux2c1_description_decisions
    where organization_id=p_organization_id and network_company_id=p_network_company_id
      and summary_hash=v_proposal->>'summary_hash') then
    raise exception 'company_ux2c1_already_decided' using errcode='40001';
  end if;
  v_description := case p_action when 'accept' then v_proposal->>'description'
    when 'edit' then btrim(p_description) else v_company.description end;

  if p_action<>'ignore' then
    perform private.m8_update_managed_network_company_impl(
      p_network_company_id,v_company.trading_name,v_company.website_url,v_description);
    select * into v_after from public.network_companies where id=p_network_company_id;
    -- C.1 may change description only. A legacy row requiring normalization or
    -- an unexpected trigger side effect must roll back instead of changing scope.
    if v_after.trading_name is distinct from v_company.trading_name
       or v_after.website_url is distinct from v_company.website_url
       or v_after.website_domain is distinct from v_company.website_domain
       or v_after.publication_status is distinct from v_company.publication_status
       or v_after.verification_status is distinct from v_company.verification_status
       or v_after.claimed_status is distinct from v_company.claimed_status then
      raise exception 'company_ux2c1_overview_requires_review' using errcode='40001';
    end if;
    -- Explicit confirmation is a company declaration even if its text already
    -- matches. M8 only creates assertions for changed values.
    if v_after.description is not distinct from v_company.description then
      v_assertion_id := private.p3_7b_create_assertion(
        p_network_company_id,'company',p_network_company_id,'description',to_jsonb(v_description));
      perform private.p3_7_record_profile_event_impl(
        p_network_company_id,'update_overview','company',p_network_company_id,'description',
        to_jsonb(v_company.description),to_jsonb(v_description),v_assertion_id);
    end if;
  end if;
  select array_agg(value order by ordinality) into v_sources
  from jsonb_array_elements_text(v_proposal->'source_urls') with ordinality;
  insert into private.company_ux2c1_description_decisions(
    organization_id,network_company_id,actor_user_id,proposal_hash,summary_hash,decision,
    proposed_description,source_urls,extractor_version,observed_at,before_description,after_description
  ) values (
    p_organization_id,p_network_company_id,v_user,v_proposal->>'hash',v_proposal->>'summary_hash',v_action,
    v_proposal->>'description',v_sources,v_research.extractor_version,v_research.published_at,v_company.description,v_description
  ) returning id into v_decision_id;
  return jsonb_build_object('contract','company-ux2c1-description-v1',
    'decision',v_action,'decision_id',v_decision_id,'description',v_description,
    'description_hash',private.company_ux2c1_description_hash(v_description),
    'changed',v_description is distinct from v_company.description,'idempotent',false);
end;
$fn$;
revoke all on function private.company_ux2c1_decide_description_impl(uuid,uuid,text,text,text,text) from public,anon,service_role;
grant execute on function private.company_ux2c1_decide_description_impl(uuid,uuid,text,text,text,text) to authenticated;

create function public.company_ux2c1_decide_description(
  p_organization_id uuid,p_network_company_id uuid,p_expected_proposal_hash text,
  p_expected_description_hash text,p_action text,p_description text default null
)
returns jsonb language sql security invoker set search_path=''
as $fn$
  select private.company_ux2c1_decide_description_impl(
    p_organization_id,p_network_company_id,p_expected_proposal_hash,p_expected_description_hash,p_action,p_description);
$fn$;
revoke all on function public.company_ux2c1_decide_description(uuid,uuid,text,text,text,text) from public,anon,service_role;
grant execute on function public.company_ux2c1_decide_description(uuid,uuid,text,text,text,text) to authenticated;

-- Existing manual editing uses the same description CAS. The legacy M8
-- signature remains intact for compatibility; the web action uses this wrapper.
create function private.company_ux2c1_update_overview_impl(
  p_organization_id uuid,p_network_company_id uuid,p_expected_description_hash text,
  p_trading_name text default null,p_website_url text default null,p_description text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_company public.network_companies%rowtype; v_result jsonb;
begin
  perform private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);
  if p_expected_description_hash is null or p_expected_description_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'description version required' using errcode='22023';
  end if;
  select * into v_company from public.network_companies where id=p_network_company_id for update;
  perform private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);
  if private.company_ux2c1_description_hash(v_company.description) is distinct from p_expected_description_hash then
    raise exception 'company_ux2c1_description_changed' using errcode='40001';
  end if;
  v_result := private.m8_update_managed_network_company_impl(
    p_network_company_id,p_trading_name,p_website_url,p_description);
  return v_result || jsonb_build_object('description_hash',private.company_ux2c1_description_hash(v_result->>'description'));
end;
$fn$;
revoke all on function private.company_ux2c1_update_overview_impl(uuid,uuid,text,text,text,text) from public,anon,service_role;
grant execute on function private.company_ux2c1_update_overview_impl(uuid,uuid,text,text,text,text) to authenticated;

create function public.company_ux2c1_update_overview(
  p_organization_id uuid,p_network_company_id uuid,p_expected_description_hash text,
  p_trading_name text default null,p_website_url text default null,p_description text default null
)
returns jsonb language sql security invoker set search_path=''
as $fn$
  select private.company_ux2c1_update_overview_impl(
    p_organization_id,p_network_company_id,p_expected_description_hash,p_trading_name,p_website_url,p_description);
$fn$;
revoke all on function public.company_ux2c1_update_overview(uuid,uuid,text,text,text,text) from public,anon,service_role;
grant execute on function public.company_ux2c1_update_overview(uuid,uuid,text,text,text,text) to authenticated;
