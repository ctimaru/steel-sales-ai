-- NET-GROWTH3.G.3: reviewed source-to-canonical reconciliation, never automatic claim.
-- Applied only after protected CI/DB sign-off. The existing 836 directory profile
-- count and all current company records are untouched by deploying this migration.

create table if not exists private.netgrowth3g3_reconciliation_requests (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null,
  source_origin text not null,
  source_domain text not null,
  source_name text not null,
  source_url text not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  request_note text,
  status text not null default 'requested'
    check (status in ('requested','under_review','ready_for_claim','rejected')),
  canonical_company_id uuid references public.network_companies(id) on delete restrict,
  registration_application_id uuid references public.company_registration_applications(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint netgrowth3g3_review_identity_check check (
    (status='ready_for_claim' and canonical_company_id is not null and
      registration_application_id is not null and reviewed_by is not null and reviewed_at is not null)
    or (status<>'ready_for_claim' and canonical_company_id is null)
  )
);
create unique index if not exists netgrowth3g3_active_org_discovery_uidx
  on private.netgrowth3g3_reconciliation_requests (organization_id,discovery_id)
  where status in ('requested','under_review','ready_for_claim');
create index if not exists netgrowth3g3_review_queue_idx
  on private.netgrowth3g3_reconciliation_requests (status,requested_at);
alter table private.netgrowth3g3_reconciliation_requests enable row level security;
revoke all on private.netgrowth3g3_reconciliation_requests from public,anon,authenticated;

-- Reuse the established organization-admin check. Never trust a submitted organization ID.
create or replace function private.netgrowth3g3_require_org_admin(p_organization_id uuid)
returns uuid language plpgsql stable security definer set search_path='' as $body$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or p_organization_id is null or
     not exists (
       select 1 from public.organization_memberships m
       where m.organization_id=p_organization_id and m.user_id=v_actor
         and m.status='active' and m.role='admin'
     ) then
    raise exception 'active organization admin membership required' using errcode='42501';
  end if;
  return v_actor;
end;
$body$;

create or replace function private.netgrowth3g3_request_impl(
  p_discovery_id uuid, p_organization_id uuid, p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_actor uuid;
        v_discovery record;
        v_request private.netgrowth3g3_reconciliation_requests%rowtype;
        v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  v_actor := private.netgrowth3g3_require_org_admin(p_organization_id);
  if p_discovery_id is null then
    raise exception 'discovery id required' using errcode='22023';
  end if;
  if v_note is not null and char_length(v_note)>1000 then
    raise exception 'request note too long' using errcode='22023';
  end if;
  select d.id,d.origin,d.domain,d.company_name,d.source_url,d.role_key
    into v_discovery
  from private.netfast_discovered_records d where d.id=p_discovery_id;
  if not found then
    -- A source may already have been canonically published since the page loaded.
    select * into v_request from private.netgrowth3g3_reconciliation_requests r
    where r.discovery_id=p_discovery_id and r.organization_id=p_organization_id
      and r.status='ready_for_claim' order by r.requested_at desc limit 1;
    if found then
      return jsonb_build_object('contract','netgrowth3g3-claim-v1',
        'request_id',v_request.id,'status',v_request.status,
        'canonical_company_id',v_request.canonical_company_id,
        'verified_supplier',false,'ownership_granted',false);
    end if;
    raise exception 'provisional company not available' using errcode='P0002';
  end if;
  if v_discovery.domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
     or v_discovery.source_url not like 'https://%'
     or private.netconnect2b_domain(v_discovery.source_url)<>v_discovery.domain
     or v_discovery.role_key not in ('trader_distributor','producer','processor_service_provider','end_user')
  then
    raise exception 'invalid sourced company identity' using errcode='22023';
  end if;
  if exists (
    select 1 from public.organization_network_company_links l
    where l.organization_id=p_organization_id and l.link_status='active'
  ) then
    raise exception 'organization already manages a canonical Network profile'
      using errcode='23505';
  end if;
  if exists (
    select 1 from public.network_netfast3_suppressed_domains x
    where x.domain=v_discovery.domain
  ) then
    raise exception 'source opted out of discovery' using errcode='23514';
  end if;
  select * into v_request
  from private.netgrowth3g3_reconciliation_requests r
  where r.organization_id=p_organization_id and r.discovery_id=p_discovery_id
    and r.status in ('requested','under_review','ready_for_claim')
  order by r.requested_at desc limit 1;
  if found then
    return jsonb_build_object('contract','netgrowth3g3-claim-v1',
      'request_id',v_request.id,'status',v_request.status,
      'canonical_company_id',v_request.canonical_company_id,
      'verified_supplier',false,'ownership_granted',false,'idempotent_replay',true);
  end if;
  insert into private.netgrowth3g3_reconciliation_requests(
    discovery_id,source_origin,source_domain,source_name,source_url,
    organization_id,requested_by,request_note
  ) values (
    v_discovery.id,v_discovery.origin,v_discovery.domain,v_discovery.company_name,
    v_discovery.source_url,p_organization_id,v_actor,v_note
  ) returning * into v_request;
  return jsonb_build_object('contract','netgrowth3g3-claim-v1',
    'request_id',v_request.id,'status','requested','canonical_company_id',null,
    'verified_supplier',false,'ownership_granted',false,'requires_platform_review',true);
end;
$body$;

create or replace function private.netgrowth3g3_my_request_impl(
  p_discovery_id uuid,p_organization_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $body$
declare v_actor uuid;v_request private.netgrowth3g3_reconciliation_requests%rowtype;
begin
  v_actor := private.netgrowth3g3_require_org_admin(p_organization_id);
  select * into v_request
  from private.netgrowth3g3_reconciliation_requests r
  where r.discovery_id=p_discovery_id and r.organization_id=p_organization_id
  order by r.requested_at desc limit 1;
  return jsonb_build_object('contract','netgrowth3g3-claim-v1',
    'status',case when found then v_request.status else 'not_requested' end,
    'request_id',v_request.id,
    'canonical_company_id',v_request.canonical_company_id,
    'review_note',case when v_request.status='rejected' then v_request.review_note else null end,
    'ownership_granted',false,'verified_supplier',false);
end;
$body$;

create or replace function private.netgrowth3g3_review_queue_impl(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $body$
declare v_items jsonb;
begin
  perform private.require_platform_permission('claims.read');
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'invalid limit' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at),'[]'::jsonb)
  into v_items from (
    select r.id request_id,r.discovery_id,r.source_domain,r.source_name,r.source_url,
      r.organization_id,o.name organization_name,r.status,r.request_note,
      r.requested_at,r.canonical_company_id,
      exists (
        select 1 from private.netconnect2b_registration_proposals p
        join public.company_registration_applications a on a.id=p.application_id
        where p.discovery_id=r.discovery_id and p.match_state='strong_evidence'
          and a.application_status='activated'
          and a.activated_organization_id=r.organization_id
      ) as has_activated_strong_match
    from private.netgrowth3g3_reconciliation_requests r
    join public.organizations o on o.id=r.organization_id
    order by (r.status in ('requested','under_review')) desc,r.requested_at
    limit p_limit
  ) x;
  return jsonb_build_object('contract','netgrowth3g3-platform-v1',
    'items',v_items,'total_pending',(
      select count(*) from private.netgrowth3g3_reconciliation_requests
      where status in ('requested','under_review')
    ));
end;
$body$;

create or replace function private.netgrowth3g3_review_impl(
  p_request_id uuid,p_decision text,p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_actor uuid := (select auth.uid());
        v_request private.netgrowth3g3_reconciliation_requests%rowtype;
        v_app public.company_registration_applications%rowtype;
        v_source record;v_company public.network_companies%rowtype;
        v_domain_count integer;v_canonical_id uuid;
        v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  if p_decision not in ('under_review','rejected','ready_for_claim') then
    raise exception 'invalid decision' using errcode='22023';
  end if;
  if v_actor is null then
    raise exception 'authenticated reviewer required' using errcode='42501';
  end if;
  if p_decision='ready_for_claim' then
    perform private.require_platform_permission('claims.approve');
  elsif p_decision='rejected' then
    perform private.require_platform_permission('claims.reject');
  else
    perform private.require_platform_permission('claims.review_proof');
  end if;
  if v_note is null or char_length(v_note) < 10 or char_length(v_note)>2000 then
    raise exception 'documented reviewer rationale required (10-2000 characters)'
      using errcode='22023';
  end if;
  select * into v_request
  from private.netgrowth3g3_reconciliation_requests
  where id=p_request_id for update;
  if not found then
    raise exception 'request not found' using errcode='P0002';
  end if;
  if v_request.status not in ('requested','under_review') then
    raise exception 'only pending requests can be reviewed' using errcode='22023';
  end if;
  if p_decision<>'ready_for_claim' then
    update private.netgrowth3g3_reconciliation_requests
    set status=p_decision,reviewed_by=v_actor,reviewed_at=now(),
        review_note=v_note,updated_at=now()
    where id=v_request.id;
    return jsonb_build_object('contract','netgrowth3g3-review-v1',
      'request_id',v_request.id,'status',p_decision,'ownership_granted',false);
  end if;

  -- No approval by name/domain alone. Require an activated registration with
  -- independently confirmed applicant email and exact unique corporate identity.
  select a.* into v_app
  from private.netconnect2b_registration_proposals p
  join public.company_registration_applications a on a.id=p.application_id
  where p.discovery_id=v_request.discovery_id and p.match_state='strong_evidence'
    and a.application_status='activated'
    and a.activated_organization_id=v_request.organization_id
    and a.email_verified_at is not null
  limit 1;
  if not found then
    raise exception 'activated registration with strong ownership evidence required'
      using errcode='23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request.source_domain,0));
  select d.id,d.domain,d.company_name,d.source_url into v_source
  from private.netfast_discovered_records d where d.id=v_request.discovery_id;
  if not found or v_source.domain<>v_request.source_domain or
     v_source.company_name<>v_request.source_name or
     v_source.source_url<>v_request.source_url then
    raise exception 'provisional source changed: restart review' using errcode='23514';
  end if;
  if private.netconnect2b_legal_key(v_source.company_name) is distinct from
     private.netconnect2b_legal_key(v_app.legal_name)
     or private.netconnect2b_domain(v_app.website_url)<>v_source.domain
     or v_app.country_code<>'IT' then
    raise exception 'registered identity is not an exact source match' using errcode='23514';
  end if;
  if (select count(*) from private.netfast_discovered_records d
      where d.domain=v_request.source_domain)<>1 then
    raise exception 'shared domain: manual identity remediation required' using errcode='23505';
  end if;
  if exists (select 1 from private.netgrowth3g3_reconciliation_requests r
    where r.discovery_id=v_request.discovery_id and r.id<>v_request.id
      and r.status='ready_for_claim' and r.organization_id<>v_request.organization_id) then
    raise exception 'another organization reconciled this source' using errcode='23505';
  end if;
  if exists (select 1 from public.organization_network_company_links l
    where l.organization_id=v_request.organization_id and l.link_status='active') then
    raise exception 'organization already manages another company' using errcode='23505';
  end if;
  select count(*) into v_domain_count from public.network_companies c
  where c.archived_at is null
    and private.netconnect2b_domain(c.website_domain)=v_request.source_domain;
  if v_domain_count>1 then
    raise exception 'multiple canonical companies use this domain' using errcode='23505';
  end if;
  if v_domain_count=1 then
    select * into v_company from public.network_companies c
      where c.archived_at is null and private.netconnect2b_domain(c.website_domain)=v_request.source_domain
      for update;
    if v_company.publication_status<>'published' or
       private.netconnect2b_legal_key(v_company.legal_name) is distinct from
         private.netconnect2b_legal_key(v_app.legal_name) then
      raise exception 'existing canonical identity requires separate review'
        using errcode='23514';
    end if;
    if v_company.claimed_status='claimed' or
       exists (select 1 from public.network_company_claims cl
          where cl.network_company_id=v_company.id and cl.status='approved') then
      raise exception 'canonical identity already claimed' using errcode='23505';
    end if;
    v_canonical_id:=v_company.id;
  else
    -- Deliberate platform approval only: this publishes the factual company
    -- identity, with no validated role, certification, stock, claim or link.
    insert into public.network_companies (
      legal_name,country_code,website_url,website_domain,
      publication_status,claimed_status,verification_status
    ) values (
      btrim(v_app.legal_name),'IT','https://'||v_source.domain||'/',
      v_source.domain,'published','unclaimed','unverified'
    ) returning id into v_canonical_id;
  end if;
  update private.netgrowth3g3_reconciliation_requests
  set status='ready_for_claim',canonical_company_id=v_canonical_id,
      registration_application_id=v_app.id,reviewed_by=v_actor,
      reviewed_at=now(),review_note=v_note,updated_at=now()
  where id=v_request.id;

  -- No INSERT into network_company_claims or organization_network_company_links.
  -- The owner must still request the canonical claim, pass proof and be approved.
  return jsonb_build_object('contract','netgrowth3g3-review-v1',
    'request_id',v_request.id,'status','ready_for_claim',
    'canonical_company_id',v_canonical_id,
    'ownership_granted',false,'supplier_verified',false,
    'next_step','canonical_claim_requires_separate_approval');
end;
$body$;

-- Public RPCs are SECURITY INVOKER; privileged data operations are private
-- with in-function membership/permission checks and a locked search_path.
create or replace function public.netgrowth3g3_request_reconciliation(
  p_discovery_id uuid,p_organization_id uuid,p_note text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select private.netgrowth3g3_request_impl(p_discovery_id,p_organization_id,p_note);
$$;
create or replace function public.netgrowth3g3_my_reconciliation(
  p_discovery_id uuid,p_organization_id uuid
) returns jsonb language sql stable security invoker set search_path='' as $$
  select private.netgrowth3g3_my_request_impl(p_discovery_id,p_organization_id);
$$;
create or replace function public.netgrowth3g3_review_queue(
  p_limit integer default 50
) returns jsonb language sql stable security invoker set search_path='' as $$
  select private.netgrowth3g3_review_queue_impl(p_limit);
$$;
create or replace function public.netgrowth3g3_review_reconciliation(
  p_request_id uuid,p_decision text,p_note text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select private.netgrowth3g3_review_impl(p_request_id,p_decision,p_note);
$$;

revoke all on function private.netgrowth3g3_require_org_admin(uuid) from public,anon,authenticated;
revoke all on function private.netgrowth3g3_request_impl(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.netgrowth3g3_my_request_impl(uuid,uuid) from public,anon,authenticated;
revoke all on function private.netgrowth3g3_review_queue_impl(integer) from public,anon,authenticated;
revoke all on function private.netgrowth3g3_review_impl(uuid,text,text) from public,anon,authenticated;
revoke all on function public.netgrowth3g3_request_reconciliation(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.netgrowth3g3_my_reconciliation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.netgrowth3g3_review_queue(integer) from public,anon,authenticated;
revoke all on function public.netgrowth3g3_review_reconciliation(uuid,text,text) from public,anon,authenticated;
grant execute on function private.netgrowth3g3_require_org_admin(uuid) to authenticated;
grant execute on function private.netgrowth3g3_request_impl(uuid,uuid,text) to authenticated;
grant execute on function private.netgrowth3g3_my_request_impl(uuid,uuid) to authenticated;
grant execute on function private.netgrowth3g3_review_queue_impl(integer) to authenticated;
grant execute on function private.netgrowth3g3_review_impl(uuid,text,text) to authenticated;
grant execute on function public.netgrowth3g3_request_reconciliation(uuid,uuid,text) to authenticated;
grant execute on function public.netgrowth3g3_my_reconciliation(uuid,uuid) to authenticated;
grant execute on function public.netgrowth3g3_review_queue(integer) to authenticated;
grant execute on function public.netgrowth3g3_review_reconciliation(uuid,text,text) to authenticated;
