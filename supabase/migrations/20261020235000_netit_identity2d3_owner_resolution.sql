-- NET-IT IDENTITY2D.3: owner-attributed resolution and safe canonical claim bridge.
-- Depends on 20261020234000 (IDENTITY2D.2); no discovery edits, merge or automatic legal verification.
-- Owner attestation is evidence, not publication and not a claim for a discovered UUID.

create table private.netit_identity_correction_resolutions (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references private.netit_identity_correction_requests(id),
 canonical_company_id uuid not null references public.network_companies(id),
 organization_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id),
 decision_key text not null check (decision_key in ('owner_supported','owner_disputed')),
 decision_note text not null check (char_length(decision_note) between 12 and 600),
 legal_identity_verified boolean not null default false check (not legal_identity_verified),
 automatic_publication boolean not null default false check (not automatic_publication),
 merge_performed boolean not null default false check (not merge_performed),
 created_at timestamptz not null default now()
);
create index netit_identity2d3_org_decisions on private.netit_identity_correction_resolutions(organization_id,created_at desc);
alter table private.netit_identity_correction_resolutions enable row level security;
revoke all on table private.netit_identity_correction_resolutions from public,anon,authenticated;
grant select on table private.netit_identity_correction_resolutions to service_role;
create trigger netit_identity2d3_resolution_immutable
 before update or delete on private.netit_identity_correction_resolutions
 for each row execute function private.netit_identity2d2_immutable();
comment on table private.netit_identity_correction_resolutions is
 'Append-only company-owner attestations of source-backed suggestions. Never changes discovered identity, legal verification, claim status, rights or publication.';

-- Only use a unique discovered-domain -> unique published canonical match
-- together with a CURRENT active org link and approved canonical claim.
-- A shared group domain or a possible brand alias cannot pass.
create function private.netit_identity2d3_owner_company(
 p_organization_id uuid, p_discovery_id uuid
) returns uuid
language plpgsql stable security definer set search_path=''
as $$
declare
 v_domain text;
 v_canonical uuid;
begin
 select private.hp4_normalize_domain(d.domain)
   into v_domain from private.netfast_discovered_records d where d.id=p_discovery_id;
 if v_domain is null or char_length(v_domain)<4 then return null; end if;
 if (select count(*) from private.netfast_discovered_records d
      where private.hp4_normalize_domain(d.domain)=v_domain)<>1 then return null; end if;
 if (select count(*) from public.network_companies c
      where c.publication_status='published' and c.country_code='IT'
       and c.archived_at is null
       and private.hp4_normalize_domain(c.website_domain)=v_domain)<>1 then return null; end if;
 select c.id into v_canonical from public.network_companies c
 join public.organization_network_company_links l
    on l.network_company_id=c.id and l.organization_id=p_organization_id
   and l.link_status='active'
 join public.network_company_claims cl
    on cl.network_company_id=c.id and cl.organization_id=p_organization_id
   and cl.status='approved'
 where c.publication_status='published' and c.country_code='IT' and c.archived_at is null
   and private.hp4_normalize_domain(c.website_domain)=v_domain
 limit 1;
 return v_canonical;
end
$$;
revoke all on function private.netit_identity2d3_owner_company(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.netit_identity2d3_owner_company(uuid,uuid) to service_role;

-- Authenticated admin can inspect their own company's submissions; a canonical
-- approved-claim owner can inspect submissions about that uniquely matched company.
-- Never return submitter identity, other organization IDs, or private correspondence.
create function public.netit_identity2d3_correction_queue(
 p_organization_id uuid, p_discovery_id uuid, p_limit integer default 15
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
 v_actor uuid := (select auth.uid());
 v_owner_company uuid;
 v_bridge_company uuid;
 v_domain text;
 v_result jsonb;
begin
 if v_actor is null or coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) then
   raise exception 'Authenticated company admin required' using errcode='42501';
 end if;
 if p_organization_id is null or p_discovery_id is null
   or p_limit is null or p_limit not between 1 and 20 then
   raise exception 'Invalid bounded correction queue request' using errcode='22023';
 end if;
 if not exists(select 1 from public.organization_memberships m
   where m.organization_id=p_organization_id and m.user_id=v_actor
   and m.status='active' and m.role='admin') then
   raise exception 'Active company administrator required' using errcode='42501';
 end if;
 perform private.netux11_require_active_company(p_organization_id);
 select private.hp4_normalize_domain(d.domain)
   into v_domain from private.netfast_discovered_records d where d.id=p_discovery_id;
 if v_domain is null then
   raise exception 'Italian discovered record not found' using errcode='P0002';
 end if;
 v_owner_company:=private.netit_identity2d3_owner_company(p_organization_id,p_discovery_id);
 -- The bridge is a suggestion to enter the EXISTING canonical HP5 claim journey;
 -- only use the ID for a unique published and currently unclaimed profile.
 if (select count(*) from private.netfast_discovered_records d
      where private.hp4_normalize_domain(d.domain)=v_domain)=1
   and (select count(*) from public.network_companies c
      where c.publication_status='published' and c.country_code='IT'
       and c.archived_at is null
       and private.hp4_normalize_domain(c.website_domain)=v_domain)=1 then
   select c.id into v_bridge_company from public.network_companies c
   where c.publication_status='published' and c.country_code='IT'
     and c.archived_at is null and c.claimed_status<>'claimed'
     and private.hp4_normalize_domain(c.website_domain)=v_domain
     and not exists(select 1 from public.network_company_claims cl
       where cl.network_company_id=c.id and cl.status='approved')
   limit 1;
 end if;
 with visible as(
   select r.id,r.field_key,r.proposed_value,
     case when r.organization_id=p_organization_id then r.source_url
       else split_part(split_part(r.source_url,'?',1),'#',1) end as source_url,
     case when r.organization_id=p_organization_id then r.evidence_note
       else null::text end as evidence_note,
     r.created_at,r.organization_id=p_organization_id as is_my_organization,
     d.decision_key,d.created_at as decided_at
   from private.netit_identity_correction_requests r
   left join private.netit_identity_correction_resolutions d on d.request_id=r.id
   where r.discovery_id=p_discovery_id
     and (r.organization_id=p_organization_id or v_owner_company is not null)
   order by r.created_at desc,r.id desc
   limit p_limit
 )
 select jsonb_build_object(
   'contract','netit-identity2d3-v1',
   'owner_attestation_eligible',v_owner_company is not null,
   'claim_target_company_id',v_bridge_company,
   'total_visible',(
     select count(*) from private.netit_identity_correction_requests r
     where r.discovery_id=p_discovery_id
       and (r.organization_id=p_organization_id or v_owner_company is not null)
   ),
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'id',id,'field_key',field_key,'proposed_value',proposed_value,
     'source_url',source_url,'evidence_note',evidence_note,
     'created_at',created_at,'is_my_organization',is_my_organization,
     'resolution',coalesce(decision_key,'awaiting_owner'),
     'decided_at',decided_at,
     'can_attest',v_owner_company is not null and decision_key is null
   ) order by created_at desc,id desc) from visible),'[]'::jsonb),
   'changes_published',0,'legal_identity_verifications',0,'new_claims',0
 ) into v_result;
 return v_result;
end
$$;
revoke all on function public.netit_identity2d3_correction_queue(uuid,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.netit_identity2d3_correction_queue(uuid,uuid,integer)
 to authenticated;

create function public.netit_identity2d3_owner_attest(
 p_request_id uuid, p_organization_id uuid, p_decision text, p_note text
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
 v_actor uuid := (select auth.uid());
 v_request private.netit_identity_correction_requests%rowtype;
 v_owner uuid;
 v_id uuid;
begin
 if v_actor is null or coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) then
   raise exception 'Authenticated company admin required' using errcode='42501';
 end if;
 if p_request_id is null or p_organization_id is null
   or p_decision is null or p_decision not in ('owner_supported','owner_disputed')
   or p_note is null or char_length(btrim(p_note)) not between 12 and 600 then
   raise exception 'Invalid company attestation' using errcode='22023';
 end if;
 if not exists(select 1 from public.organization_memberships m
   where m.organization_id=p_organization_id and m.user_id=v_actor
   and m.status='active' and m.role='admin') then
   raise exception 'Active company administrator required' using errcode='42501';
 end if;
 perform private.netux11_require_active_company(p_organization_id);
 if not exists(select 1 from auth.users u where u.id=v_actor
   and u.email_confirmed_at is not null) then
   raise exception 'Confirmed email required' using errcode='42501';
 end if;
 select * into v_request from private.netit_identity_correction_requests
   where id=p_request_id;
 if not found then raise exception 'Correction not found' using errcode='P0002'; end if;
 v_owner:=private.netit_identity2d3_owner_company(p_organization_id,v_request.discovery_id);
 if v_owner is null then
   raise exception 'Approved canonical company claim required' using errcode='42501';
 end if;
 insert into private.netit_identity_correction_resolutions(
   request_id,canonical_company_id,organization_id,actor_id,decision_key,decision_note
 ) values(p_request_id,v_owner,p_organization_id,v_actor,p_decision,btrim(p_note))
 returning id into v_id;
 return jsonb_build_object('contract','netit-identity2d3-attestation-v1',
   'event_id',v_id,'resolution',p_decision,'claim_created',false,
   'legal_identity_verified',false,'published',false,'merge_performed',false);
end
$$;
revoke all on function public.netit_identity2d3_owner_attest(uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.netit_identity2d3_owner_attest(uuid,uuid,text,text)
 to authenticated;

comment on function public.netit_identity2d3_correction_queue(uuid,uuid,integer)
 is 'Admin-bounded own submissions or unique exact-domain approved-claim owner submissions; sanitized, read-only, no legal verification or claim creation.';
comment on function public.netit_identity2d3_owner_attest(uuid,uuid,text,text)
 is 'Append-only statement by an approved canonical company owner; source proposal is NOT promoted or merged; no verified legal identity inferred.';
