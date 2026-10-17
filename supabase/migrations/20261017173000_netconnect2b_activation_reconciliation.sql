-- NET-CONNECT2B — business activation truth and evidence-only source reconciliation.
-- No profile promotion, automated claim, owner assignment, or personal contact reveal.
-- Provenance links only when canonical and source share a unique website domain
-- AND an exact normalized corporate legal name. Possible registration matches
-- remain suggestions even when identity evidence is strong.

create or replace function private.netconnect2b_domain(p_input text)
returns text language sql immutable set search_path='' as $$
  select nullif(regexp_replace(
    lower(split_part(split_part(regexp_replace(btrim(coalesce(p_input,'')),'^https?://','','i'),'/',1),'?',1)),
    '^www[.]','','i'),'');
$$;
revoke all on function private.netconnect2b_domain(text) from public,anon,authenticated;

create or replace function private.netconnect2b_legal_key(p_input text)
returns text language sql immutable set search_path='' as $$
 select nullif(regexp_replace(lower(btrim(coalesce(p_input,''))),'[^a-z0-9]','','g'),'');
$$;
revoke all on function private.netconnect2b_legal_key(text) from public,anon,authenticated;

create table if not exists private.netconnect2b_canonical_evidence (
 origin text not null check(origin in ('governed_candidate','official_company_research','wikidata_cc0','licensed_structured_feed')),
 source_id uuid not null,
 canonical_company_id uuid not null references public.network_companies(id) on delete restrict,
 domain text not null,
 match_method text not null default 'unique_domain_and_legal_name'
    check (match_method='unique_domain_and_legal_name'),
 recorded_at timestamptz not null default now(),
 primary key(origin,source_id,canonical_company_id)
);
create index if not exists netconnect2b_canonical_evidence_company_idx
 on private.netconnect2b_canonical_evidence(canonical_company_id);
alter table private.netconnect2b_canonical_evidence enable row level security;
revoke all on private.netconnect2b_canonical_evidence from public,anon,authenticated;

create or replace function private.netconnect2b_capture_exact_canonical(p_company_id uuid default null)
returns integer language plpgsql volatile security definer set search_path='' as $$
declare v_inserted integer;
begin
 with sources as (
   select 'governed_candidate'::text origin,c.id source_id,c.canonical_domain domain,c.legal_name company_name
   from public.network_company_discovery_candidates c
   where c.governance_status='approved_company_data'
     and c.personal_data_detected=false and c.review_status<>'rejected'
   union all
   select 'official_company_research',t.id,t.canonical_domain,t.company_name
   from public.network_core_target_leads t
   where t.status in ('needs_review','ready_for_crawler','enqueued_for_crawler')
     and t.evidence_url like 'https://%'
   union all
   select 'wikidata_cc0',w.id,w.domain,w.company_name
   from public.network_netfast2_structured_entities w where w.removed_at is null
   union all
   select 'licensed_structured_feed',e.id,e.domain,e.company_name
   from public.network_netfast3_entities e
   join public.network_discovery_source_registry registry on registry.id=e.source_id
   join public.network_netfast3_feed_grants grant_record on grant_record.source_id=e.source_id
   where e.removed_at is null and registry.governance_status='approved'
     and registry.terms_status in ('allows_reuse','allows_limited_reuse')
     and registry.database_rights_status in ('licensed','low_risk')
     and grant_record.revoked_at is null and grant_record.expires_at>now()
 ),
 exact_matches as (
   select s.origin,s.source_id,c.id canonical_company_id,
          private.netconnect2b_domain(c.website_domain) domain
   from sources s join public.network_companies c
     on c.archived_at is null and c.publication_status='published'
      and (p_company_id is null or c.id=p_company_id)
      and private.netconnect2b_domain(c.website_domain)=private.netconnect2b_domain(s.domain)
      and private.netconnect2b_legal_key(c.legal_name)=private.netconnect2b_legal_key(s.company_name)
   where private.netconnect2b_domain(c.website_domain) ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,}$'
     and private.netconnect2b_legal_key(c.legal_name) is not null
     and (select count(*) from public.network_companies other
          where other.archived_at is null and other.publication_status='published'
            and private.netconnect2b_domain(other.website_domain)=private.netconnect2b_domain(c.website_domain))=1
 )
 insert into private.netconnect2b_canonical_evidence(origin,source_id,canonical_company_id,domain)
 select origin,source_id,canonical_company_id,domain from exact_matches
 on conflict do nothing;
 get diagnostics v_inserted=row_count;
 return v_inserted;
end $$;
revoke all on function private.netconnect2b_capture_exact_canonical(uuid) from public,anon,authenticated;

create or replace function private.netconnect2b_canonical_capture_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.archived_at is null and new.publication_status='published' then
   if tg_op='INSERT' then
     perform private.netconnect2b_capture_exact_canonical(new.id);
   elsif new.website_domain is distinct from old.website_domain
       or new.legal_name is distinct from old.legal_name
       or new.publication_status is distinct from old.publication_status then
     perform private.netconnect2b_capture_exact_canonical(new.id);
   end if;
 end if;
 return new;
end $$;
revoke all on function private.netconnect2b_canonical_capture_trigger() from public,anon,authenticated;
drop trigger if exists netconnect2b_capture_published_identity on public.network_companies;
create trigger netconnect2b_capture_published_identity
 after insert or update of publication_status,legal_name,website_domain on public.network_companies
 for each row execute function private.netconnect2b_canonical_capture_trigger();

-- Backfill evidence-only provenance against already published canonical profiles.
-- Never writes to original source records, ownership status or registrations.
select private.netconnect2b_capture_exact_canonical(null);

create or replace view private.netconnect2b_registration_proposals
with (security_barrier=true) as
with possible as (
 select d.id discovery_id,d.origin,d.domain,d.company_name discovered_name,
        a.id application_id,a.legal_name applicant_company,a.application_status,
        a.email_verified_at is not null email_verified,
        private.netconnect2b_domain(split_part(a.applicant_email_snapshot,'@',2))=d.domain corporate_email_domain_match,
        private.netconnect2b_legal_key(a.legal_name)=private.netconnect2b_legal_key(d.company_name) exact_legal_name,
        (select count(*) from public.company_registration_applications other
         where other.application_status not in ('rejected','draft')
           and private.netconnect2b_domain(other.website_url)=d.domain) same_domain_applications,
        (select count(*) from private.netfast_discovered_records other
         where other.domain=d.domain) same_domain_discoveries
 from private.netfast_discovered_records d
 join public.company_registration_applications a
  on private.netconnect2b_domain(a.website_url)=d.domain
 where a.application_status not in ('draft','rejected')
   and a.country_code='IT'
   and d.domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,}$'
)
select discovery_id,origin,domain,discovered_name,application_id,applicant_company,
       application_status,
       case when email_verified and corporate_email_domain_match and exact_legal_name
          and same_domain_applications=1 and same_domain_discoveries=1
         then 'strong_evidence'
         else 'ambiguous_review' end match_state,
       email_verified,corporate_email_domain_match,exact_legal_name,
       same_domain_applications,same_domain_discoveries
from possible;
revoke all on private.netconnect2b_registration_proposals from public,anon,authenticated;

create or replace function private.netconnect2b_activation_overview_impl()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_summary jsonb;v_proposals jsonb;
begin
 if not private.is_platform_superadmin() then
  raise exception 'Platform owner required' using errcode='42501';
 end if;
 select jsonb_build_object(
   'published', (select count(*) from public.network_companies
       where publication_status='published' and archived_at is null),
   'provisional_visible', (select count(*) from private.netfast_discovered_records),
   'registration_applications', (select count(*) from public.company_registration_applications
       where application_status<>'draft'),
   'registrations_activated', (select count(*) from public.company_registration_applications
       where application_status='activated'),
   'claims_pending', (select count(*) from public.network_company_claims
       where status in ('requested','under_review')),
   'claims_approved', (select count(*) from public.network_company_claims
       where status='approved'),
   'companies_linked_and_claim_approved',
      (select count(distinct l.network_company_id)
       from public.organization_network_company_links l
       join public.network_companies c on c.id=l.network_company_id
         and c.publication_status='published' and c.archived_at is null
       join public.network_company_claims cl on cl.network_company_id=c.id
         and cl.organization_id=l.organization_id and cl.status='approved'
       where l.link_status='active'
         and exists(select 1 from public.organization_memberships m
             where m.organization_id=l.organization_id and m.status='active')),
   'connection_requests_sent', (select count(*) from public.network_connection_requests),
   'connections_accepted', (select count(*) from public.network_connection_requests
       where status='accepted'),
   'canonical_evidence_links', (select count(*) from private.netconnect2b_canonical_evidence),
   'registration_strong_matches', (select count(*) from private.netconnect2b_registration_proposals
      where match_state='strong_evidence'),
   'registration_ambiguous_matches', (select count(*) from private.netconnect2b_registration_proposals
      where match_state='ambiguous_review')
 ) into v_summary;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.match_state,t.domain),'[]'::jsonb)
 into v_proposals from (
    select discovery_id,origin,domain,discovered_name,application_id,
           applicant_company,application_status,match_state
    from private.netconnect2b_registration_proposals
    order by match_state desc,domain limit 30
 ) t;
 return jsonb_build_object('contract','netconnect2b-activation-v1',
   'counts',v_summary,'proposals',v_proposals,'snapshot_at',now());
end $$;

create or replace function public.netconnect2b_activation_overview()
returns jsonb language sql stable security definer set search_path='' as $$
 select private.netconnect2b_activation_overview_impl();
$$;
revoke all on function private.netconnect2b_activation_overview_impl() from public,anon,authenticated;
revoke all on function public.netconnect2b_activation_overview() from public,anon;
grant execute on function public.netconnect2b_activation_overview() to authenticated;
