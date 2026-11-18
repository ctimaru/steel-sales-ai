-- NET-EU-TUBIFICI1.D2 — Evidence-backed batch-02 release.
-- No generic bypass: this change preserves the existing C1 publisher and
-- PA1.5 Italian and European checks, adding only the second first-party
-- research batch when provenance, identity, and manufacturing proofs match.
-- A batch-02 candidate that lacks positive first-party evidence is never
-- publishable. Exact technical sizes, company confirmation and legal
-- registration remain unverified.
create or replace function private.net_eu_tubifici1_d2_release_scope(
 p_candidate_id uuid, p_run_id uuid
)
returns boolean language sql stable security invoker set search_path=''
as $d2$
 select exists (
   select 1
   from public.network_company_discovery_candidates c
   join public.network_company_discovery_runs r on r.id=c.run_id
   join private.net_eu_tubifici1_manufacturing_proofs m
     on m.candidate_id=c.id and m.identity_evidence_id is not null
   join private.net_eu_tubifici1_identity_evidence e
     on e.id=m.identity_evidence_id and e.candidate_id=c.id
       and e.run_id=r.id and e.country_code=c.country_code
   where c.id=p_candidate_id and c.run_id=p_run_id
     and c.country_code=r.country_code and c.country_code<>'IT'
     and c.extraction_version='net-eu-tubifici1-bridge-v1'
     and r.extraction_version='net-eu-tubifici1-bridge-v1'
     and r.source_reference='net-eu-tubifici1:NET-EU-TUBIFICI-20261118-02'
     and private.net_eu_tubifici1_seed_matches(
        c.country_code,c.canonical_domain,c.source_url,r.source_reference,
        c.identity_quality->>'seed_id',c.identity_quality->>'research_id')
     and c.identity_quality->>'review_lane'='web_profile_review_pending'
     and c.review_status='pending_review'
     and c.governance_status='unreviewed'
     and c.publication_actor_type='platform'
     and c.match_company_id is null
     and c.role_keys @> array['producer']::text[]
     and c.quality_flags <@ array['legal_identity_not_verified','producer_role_not_verified']::text[]
     and not c.personal_data_detected and cardinality(c.personal_data_fields)=0
     and r.governance_status='unreviewed'
     and r.terms_status in ('not_checked','unknown')
     and r.database_rights_status in ('not_assessed','unknown')
     and r.personal_data_policy='company_data_only'
     and m.proof_status='qualified_firstparty'
     and m.source_kind='first_party_html'
     and m.factory_country_code=c.country_code
     and m.checked_at>now()-interval '30 days'
     and m.source_url ~* '^https://'
     and lower(regexp_replace(
         split_part(split_part(m.source_url,'/',3),':',1),'^www[.]',''))
       =lower(c.canonical_domain)
     and e.verdict='observed_match'
     and e.reviewer_version='net-eu-tubifici1-firstparty-v1'
     and e.name_matched
     and e.observed_name=c.legal_name
     and e.observed_domain=lower(c.canonical_domain)
     and e.confidence>=0.94
     and e.page_sha256 ~ '^[a-f0-9]{64}$'
     and e.source_rights_state='unknown'
     and e.last_checked_at>now()-interval '3 days'
     and not exists(
        select 1 from public.network_netfast3_suppressed_domains s
        where lower(s.domain)=lower(c.canonical_domain)
     )
 );
$d2$;
revoke all on function private.net_eu_tubifici1_d2_release_scope(uuid,uuid)
 from public,anon,authenticated,service_role;
comment on function private.net_eu_tubifici1_d2_release_scope(uuid,uuid) is
 'EU1.D2: batch02 private seed, reviewer, source-bound factory evidence and no PII; not a public API or independent publisher.';

-- Exact, guarded patching keeps the original C1 integrity checks and
-- PA1.5 default branch intact. Refuse if any upstream definition changed.
do $patch$
declare
 v_pub text;
 v_pa text;
 old_pub constant text := 'r.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01''';
 new_pub constant text :=
   '(r.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01'' or (r.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-02'' and private.net_eu_tubifici1_d2_release_scope(c.id,c.run_id)))';
 old_pa constant text := 'v_run.source_reference<>''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01''';
 new_pa constant text :=
   'not (v_run.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01'' or (v_run.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-02'' and private.net_eu_tubifici1_d2_release_scope(p_new.id,p_new.run_id)))';
begin
 select pg_catalog.pg_get_functiondef(p.oid) into v_pub
 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
 on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='net_eu_tubifici1_publish'
   and pg_catalog.pg_get_function_identity_arguments(p.oid)
       ='p_max integer, p_commit boolean';
 select pg_catalog.pg_get_functiondef(p.oid) into v_pa
 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
 on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='net_eu_tubifici1_pa15_accept';
 if v_pub is null or v_pa is null
   or pg_catalog.strpos(v_pub,old_pub)=0
   or pg_catalog.strpos(v_pa,old_pa)=0
   or pg_catalog.strpos(v_pub,'net_eu_tubifici1_d2_release_scope')>0
   or pg_catalog.strpos(v_pa,'net_eu_tubifici1_d2_release_scope')>0
 then
    raise exception 'D2 source implementation changed, refusing ungated publication scope';
 end if;
 execute pg_catalog.replace(v_pub,old_pub,new_pub);
 execute pg_catalog.replace(v_pa,old_pa,new_pa);
end
$patch$;

-- Minimal privileges: do not widen publisher public entrypoint access.
revoke execute on function private.net_eu_tubifici1_publish(integer,boolean)
 from public,anon,authenticated,service_role;
revoke execute on function public.net_eu_tubifici1_publish(integer,boolean)
 from public,anon,authenticated,service_role;
