-- NET-IT IDENTITY2D.2: authenticated company-member corrections for Italian discovered profiles.
-- Proposal collection only. No claim, ownership link, merge, entity edit, publication or rights approval.
-- Both ledgers are private and append-only. The public RPC validates the current actor in SQL.

create table private.netit_identity_correction_requests (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null references private.netfast_discovered_records(id),
  organization_id uuid not null references public.organizations(id),
  submitted_by uuid not null references auth.users(id),
  field_key text not null check (field_key in ('company_name','website_domain','location','brand_group')),
  proposed_value text not null check (char_length(proposed_value) between 4 and 180),
  source_url text not null check (char_length(source_url) between 12 and 500 and source_url like 'https://%'),
  source_host text not null check (char_length(source_host) between 4 and 180),
  evidence_note text not null check (char_length(evidence_note) between 30 and 800),
  representation_basis text not null check (representation_basis in ('industry_observer','self_declared_representative')),
  status text not null default 'submitted' check (status='submitted'),
  representation_verified boolean not null default false check (not representation_verified),
  legal_identity_verified boolean not null default false check (not legal_identity_verified),
  rights_assessed text not null default 'not_assessed' check (rights_assessed='not_assessed'),
  claim_granted boolean not null default false check (not claim_granted),
  published boolean not null default false check (not published),
  created_at timestamptz not null default now()
);
create unique index netit_identity2d2_dedup
  on private.netit_identity_correction_requests
  (discovery_id,organization_id,field_key,lower(btrim(proposed_value)));
create index netit_identity2d2_user_rate
  on private.netit_identity_correction_requests(submitted_by,created_at desc);
create index netit_identity2d2_org_rate
  on private.netit_identity_correction_requests(organization_id,created_at desc);
alter table private.netit_identity_correction_requests enable row level security;
revoke all on table private.netit_identity_correction_requests from public,anon,authenticated;
grant select on table private.netit_identity_correction_requests to service_role;

create table private.netit_identity_correction_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references private.netit_identity_correction_requests(id),
  actor_id uuid not null references auth.users(id),
  event_key text not null check (event_key='submitted'),
  created_at timestamptz not null default now(),
  unique(request_id,event_key)
);
alter table private.netit_identity_correction_events enable row level security;
revoke all on table private.netit_identity_correction_events from public,anon,authenticated;
grant select on table private.netit_identity_correction_events to service_role;

create function private.netit_identity2d2_immutable()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  raise exception 'Italian identity submissions and events are append-only' using errcode='42501';
end
$$;
revoke all on function private.netit_identity2d2_immutable() from public,anon,authenticated;
create trigger netit_identity2d2_requests_no_rewrite
  before update or delete on private.netit_identity_correction_requests
  for each row execute function private.netit_identity2d2_immutable();
create trigger netit_identity2d2_events_no_rewrite
  before update or delete on private.netit_identity_correction_events
  for each row execute function private.netit_identity2d2_immutable();

create function public.netit_identity2d2_submit_correction(
 p_discovery_id uuid,
 p_organization_id uuid,
 p_field text,
 p_proposed_value text,
 p_source_url text,
 p_evidence_note text,
 p_representation text default 'industry_observer'
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
 v_actor uuid := (select auth.uid());
 v_company private.netfast_discovered_records%rowtype;
 v_email_confirmed timestamptz;
 v_value text := nullif(btrim(p_proposed_value),'');
 v_note text := nullif(btrim(p_evidence_note),'');
 v_url text := nullif(btrim(p_source_url),'');
 v_host text;
 v_profile_domain text;
 v_proposed_domain text;
 v_match boolean := false;
 v_id uuid;
begin
 if v_actor is null or coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) then
   raise exception 'Verified account required' using errcode='42501';
 end if;
 if p_discovery_id is null or p_organization_id is null then
   raise exception 'Missing target or organization' using errcode='22023';
 end if;
 -- Valid membership is checked here, never from a client-supplied organization ID alone.
 if not exists (
  select 1 from public.organization_memberships m
  where m.user_id=v_actor and m.organization_id=p_organization_id
    and m.status='active' and m.role='admin'
 ) then
   raise exception 'Active organization admin required' using errcode='42501';
 end if;
 perform private.netux11_require_active_company(p_organization_id);
 select email_confirmed_at into v_email_confirmed from auth.users where id=v_actor;
 if v_email_confirmed is null then
   raise exception 'Confirmed email required' using errcode='42501';
 end if;
 select * into v_company from private.netfast_discovered_records where id=p_discovery_id;
 if not found or v_company.domain is null then
   raise exception 'Discovered company not found' using errcode='P0002';
 end if;
 if p_field is null or p_field not in ('company_name','website_domain','location','brand_group')
    or v_value is null or char_length(v_value) not between 4 and 180
    or v_note is null or char_length(v_note) not between 30 and 800
    or p_representation not in ('industry_observer','self_declared_representative') or p_representation is null then
   raise exception 'Invalid bounded correction' using errcode='22023';
 end if;
 if v_url is null or char_length(v_url) not between 12 and 500
    or v_url !~ '^https://[a-zA-Z0-9.-]+(/|[?]|[#]|$)'
    or v_url ~ '[[:space:]<>]' then
   raise exception 'An official HTTPS source URL is required' using errcode='22023';
 end if;
 v_host:=lower(split_part(split_part(split_part(v_url,'/',3),'?',1),'#',1));
 if char_length(v_host)>180 or v_host !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    or v_host ~ '[.][.]' or v_host ~ '[.]-|-[.]' then
   raise exception 'Invalid official source host' using errcode='22023';
 end if;
 v_profile_domain:=lower(regexp_replace(v_company.domain,'^www[.]',''));
 v_proposed_domain:=lower(regexp_replace(v_value,'^www[.]',''));
 if p_field='website_domain' and
    (v_proposed_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
     or v_proposed_domain ~ '[.][.]' or v_proposed_domain ~ '[.]-|-[.]') then
   raise exception 'Proposed domain must be a hostname, not a URL' using errcode='22023';
 end if;
 -- First-party references only: exact company domain or its subdomains.
 -- A changed-domain proposal may cite the proposed domain, but is NEVER proof of ownership.
 v_match := v_host=v_profile_domain
   or right(v_host,char_length(v_profile_domain)+1)='.'||v_profile_domain;
 if p_field='website_domain' then
   v_match := v_match or v_host=v_proposed_domain
      or right(v_host,char_length(v_proposed_domain)+1)='.'||v_proposed_domain;
 end if;
 if not v_match then
   raise exception 'Source must be hosted on the company or proposed domain' using errcode='22023';
 end if;
 -- Serialize per organization to close count-limit races for repeated parallel submissions.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('netit2d2:'||p_organization_id::text,0));
 if (select count(*) from private.netit_identity_correction_requests r
     where r.submitted_by=v_actor and r.created_at>now()-interval '24 hours')>=5
    or (select count(*) from private.netit_identity_correction_requests r
     where r.organization_id=p_organization_id and r.created_at>now()-interval '24 hours')>=12
    or exists(select 1 from private.netit_identity_correction_requests r
     where r.submitted_by=v_actor and r.created_at>now()-interval '60 seconds') then
   raise exception 'Correction request rate limit exceeded' using errcode='22023';
 end if;
 insert into private.netit_identity_correction_requests(
   discovery_id,organization_id,submitted_by,field_key,proposed_value,
   source_url,source_host,evidence_note,representation_basis)
 values(p_discovery_id,p_organization_id,v_actor,p_field,v_value,
   v_url,v_host,v_note,p_representation)
 returning id into v_id;
 insert into private.netit_identity_correction_events(request_id,actor_id,event_key)
 values(v_id,v_actor,'submitted');
 return jsonb_build_object('contract','netit-identity2d2-v1',
    'request_id',v_id,'status','submitted','representation_verified',false,
    'legal_identity_verified',false,'claim_granted',false,'published',false);
end
$$;
revoke all on function public.netit_identity2d2_submit_correction(uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.netit_identity2d2_submit_correction(uuid,uuid,text,text,text,text,text)
  to authenticated;
comment on function public.netit_identity2d2_submit_correction(uuid,uuid,text,text,text,text,text)
 is 'Authenticated active organization admin only, verified email, bounded first-party documented proposals. Self-declaration is never ownership or legal verification. No automatic publication.';
