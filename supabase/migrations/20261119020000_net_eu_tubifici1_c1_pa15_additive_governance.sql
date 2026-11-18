-- NET-EU-TUBIFICI1.C1.GOV — PA1.5 explicit European first-party source route.
-- The Italian delegated-agent route is preserved verbatim. This branch accepts
-- ONLY the 2026-11-18 EU tube-factory cohort under strong evidence/ledger checks.
-- No generic PA1.5 exception, reviewer impersonation or human approvals faked.

create or replace function private.net_eu_tubifici1_pa15_accept(
  p_old public.network_company_discovery_candidates,
  p_new public.network_company_discovery_candidates
)
returns boolean
language plpgsql stable security definer set search_path=''
as $$
declare
 v_run public.network_company_discovery_runs%rowtype;
 v_company public.network_companies%rowtype;
 v_count integer;
begin
 -- The existing PA1.5 delegates publication only to postgres maintenance;
 -- do NOT authorize service JWT or a browser session for the new EU path.
 if session_user <> 'postgres' or auth.uid() is not null
    or p_old.id is distinct from p_new.id
    or p_old.review_status<>'pending_review'
    or p_old.publication_actor_type<>'platform'
    or p_old.governance_status<>'unreviewed'
    or p_new.review_status<>'published'
    or p_new.publication_actor_type<>'delegated_agent'
    or p_new.reviewed_by is not null
    or p_new.reviewed_at is null
    or p_new.promoted_company_id is null
    or p_new.governance_status<>'unreviewed'
    or p_new.governance_reviewed_by is not null
    or p_new.governance_reviewed_at is not null
    or p_new.country_code='IT'
    or p_new.country_code is distinct from p_old.country_code
    or p_new.canonical_domain is distinct from p_old.canonical_domain
    or p_new.legal_name is distinct from p_old.legal_name
    or p_new.extraction_version<>'net-eu-tubifici1-bridge-v1'
    or p_new.match_company_id is not null
    or p_new.personal_data_detected
    or cardinality(p_new.personal_data_fields)>0
    or p_new.quality_flags && array['historical_sole_trader_vat_context','group_or_legal_entity_review']::text[]
    or not (p_new.quality_flags <@ array['legal_identity_not_verified','producer_role_not_verified']::text[])
    or not (p_new.role_keys @> array['producer']::text[])
    or p_new.source_url !~* '^https://' or p_new.website_url !~* '^https://'
    or lower(regexp_replace(split_part(split_part(p_new.source_url,'/',3),':',1),'^www[.]',''))
        is distinct from lower(p_new.canonical_domain)
    or lower(regexp_replace(split_part(split_part(p_new.website_url,'/',3),':',1),'^www[.]',''))
        is distinct from lower(p_new.canonical_domain)
    or exists(select 1 from public.network_netfast3_suppressed_domains s
       where lower(s.domain)=lower(p_new.canonical_domain))
 then return false;
 end if;

 select * into v_run from public.network_company_discovery_runs
   where id=p_new.run_id;
 if not found
    or v_run.extraction_version<>'net-eu-tubifici1-bridge-v1'
    or v_run.source_reference<>'net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01'
    or v_run.country_code is distinct from p_new.country_code
    or v_run.governance_status<>'unreviewed'
    or v_run.governance_reviewed_by is not null
    or v_run.terms_status not in ('not_checked','unknown')
    or v_run.database_rights_status not in ('not_assessed','unknown')
    or v_run.personal_data_policy<>'company_data_only'
 then return false;
 end if;

 select * into v_company from public.network_companies
   where id=p_new.promoted_company_id;
 if not found or v_company.legal_name is distinct from p_new.legal_name
    or v_company.country_code is distinct from p_new.country_code
    or lower(v_company.website_domain) is distinct from lower(p_new.canonical_domain)
    or v_company.website_url is distinct from p_new.website_url
    or v_company.publication_status<>'published'
    or v_company.claimed_status<>'unclaimed'
    or v_company.verification_status<>'unverified'
 then return false;
 end if;

 select count(*) into v_count from public.network_companies n
 where n.publication_status<>'archived'
   and (lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))
      =lower(p_new.canonical_domain)
   or (n.country_code=p_new.country_code and lower(regexp_replace(btrim(n.legal_name),'[^[:alnum:]]','','g'))
      =lower(regexp_replace(btrim(p_new.legal_name),'[^[:alnum:]]','','g'))));
 if v_count<>1 then return false; end if;

 -- A live, source-specific public assertion is mandatory. The corpus is
 -- original short factual summaries, not unlicensed PDF/catalog content.
 if not exists (
   select 1
   from private.net_eu_tubifici1_manufacturing_proofs m
   join private.net_eu_tubifici1_identity_evidence e
     on e.id=m.identity_evidence_id
       and e.candidate_id=p_new.id and e.run_id=p_new.run_id
       and e.country_code=p_new.country_code
   join private.net_eu_tubifici1_publication_ledger l
     on l.candidate_id=p_new.id and l.company_id=p_new.promoted_company_id
       and l.identity_evidence_id=e.id and l.source_url=m.source_url
   join public.network_data_assertions a
     on a.entity_type='company' and a.entity_id=p_new.promoted_company_id
       and a.field_path='eu_tube_factory_firstparty_observation'
       and a.source_reference=m.source_url
       and a.source_type='public_web' and a.review_state='accepted'
       and a.ownership_type='platform_curated'
       and a.asserted_value->>'source_level'='first_party_observed'
       and a.asserted_value->>'factory_country'=p_new.country_code
       and a.asserted_value->>'process'=m.process_code
       and a.asserted_value->>'legal_registration_verified'='false'
       and a.asserted_value->>'manufacturer_confirmed'='false'
       and a.asserted_value->>'specific_dimensions_verified'='false'
   join public.network_company_role_assignments cra
     on cra.company_id=p_new.promoted_company_id
       and cra.source_assertion_id=a.id
   join public.network_company_roles cr
     on cr.id=cra.role_id and cr.canonical_key='producer' and cr.status='active'
   join public.network_company_products cp
     on cp.company_id=p_new.promoted_company_id
       and cp.source_assertion_id=a.id and cp.relationship_type='produces'
   join public.network_product_families pf
     on pf.id=cp.product_family_id and pf.canonical_key='tubes_pipes'
       and pf.status='active'
   where m.candidate_id=p_new.id
     and m.proof_status='qualified_firstparty'
     and m.source_kind='first_party_html'
     and m.published_company_id is null and m.published_at is null
     and m.factory_country_code=p_new.country_code
     and m.checked_at>now()-interval '30 days'
     and lower(regexp_replace(split_part(split_part(m.source_url,'/',3),':',1),'^www[.]',''))
        =lower(p_new.canonical_domain)
     and e.verdict='observed_match' and e.name_matched
     and e.observed_name=p_new.legal_name
     and e.observed_domain=lower(p_new.canonical_domain)
     and e.reviewer_version='net-eu-tubifici1-firstparty-v1'
     and e.last_checked_at>now()-interval '3 days'
     and e.confidence>=0.94
     and e.source_rights_state='unknown'
     and e.page_sha256 ~ '^[a-f0-9]{64}$'
 ) then return false; end if;

 -- If a city was source-bound, its one facility must be present and unverified,
 -- just like its canonical company; otherwise do not infer any location.
 if exists(
  select 1 from private.net_eu_tubifici1_manufacturing_proofs m
  where m.candidate_id=p_new.id and m.factory_city is not null
    and not exists(
      select 1 from public.network_facilities f
      where f.company_id=p_new.promoted_company_id
      and f.city=m.factory_city and f.country_code=p_new.country_code
      and f.facility_type='manufacturing' and f.publication_status='published'
      and f.verification_status='unverified')
 ) then return false; end if;

 return true;
end
$$;

revoke all on function private.net_eu_tubifici1_pa15_accept(
  public.network_company_discovery_candidates,
  public.network_company_discovery_candidates
) from public,anon,authenticated,service_role;

-- Replace only a literal known prefix of the existing trigger body rather
-- than redefining the Italian rules. Fail closed if the signature changes.
do $patch$
declare
  v_definition text;
  v_anchor text := E'BEGIN\n  IF OLD.review_status=''pending_review''';
  v_insertion text := E'BEGIN\n  -- NET-EU-TUBIFICI1.C1: disjoint evidence-authenticated EU publisher.\n  IF OLD.review_status=''pending_review''\n     AND NEW.review_status=''published''\n     AND NEW.country_code<>''IT''\n     AND NEW.extraction_version=''net-eu-tubifici1-bridge-v1''\n     AND private.net_eu_tubifici1_pa15_accept(OLD,NEW) THEN\n    RETURN NEW;\n  END IF;\n  IF OLD.review_status=''pending_review''';
begin
 select pg_catalog.pg_get_functiondef(p.oid) into v_definition
 from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='pa1_5_discovery_publication_guard';
 if v_definition is null then
   raise exception 'Missing PA1.5 trigger; refuse EU release';
 end if;
 if pg_catalog.strpos(v_definition,'net_eu_tubifici1_pa15_accept(OLD,NEW)')>0 then
   raise exception 'EU PA1.5 branch already installed; refuse double patch';
 end if;
 if pg_catalog.strpos(v_definition,v_anchor)=0 then
   raise exception 'PA1.5 trigger prefix changed; refuse unsafe replacement';
 end if;
 execute pg_catalog.replace(v_definition,v_anchor,v_insertion);
end
$patch$;

-- The original EU publisher was service-callable but PA1.5 only admits
-- postgres maintenance. Make the intended scope explicit at the API ACL too.
revoke execute on function public.net_eu_tubifici1_publish(integer,boolean)
 from service_role;
revoke execute on function private.net_eu_tubifici1_publish(integer,boolean)
 from service_role;

comment on function private.net_eu_tubifici1_pa15_accept(
  public.network_company_discovery_candidates,
  public.network_company_discovery_candidates
) is 'Bounded EU factory-evidence check used solely by the PA1.5 publication trigger; no Italian rule changed.';
