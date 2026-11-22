-- NET-IT-CARP1.E.7.B — DISPOSABLE LOCAL CHROME FIXTURE ONLY.
-- The example.test/.invalid companies are entirely fictional.
-- Never execute against hosted Supabase and never capture real company contacts.
\set ON_ERROR_STOP on
BEGIN;
DO $local_only$
BEGIN
 IF current_setting('request.jwt.claim.sub',true) IS NOT NULL
    OR current_database()<>'postgres'
    OR inet_server_port() NOT IN (54322,5432) THEN
   RAISE EXCEPTION 'Local-only E7B fixture refused';
 END IF;
END $local_only$;

INSERT INTO public.platform_user_roles(user_id,role,status,granted_by,reason)
VALUES (:'netgrowth_auditor_user_id'::uuid,'platform_superadmin','active',
        :'netgrowth_auditor_user_id'::uuid,
        'Disposable synthetic CI only: prove real GoTrue Platform protected cockpit');

-- Local-only registration lifecycle: the current login requires a tenant
-- membership and synthetic legal acceptance before /dashboard, even for an
-- already-authorized Platform superadmin. No real person has consented.
INSERT INTO public.organizations(
 id,name,slug,created_by,industry,country_code,onboarding_status,
 guided_setup_completed_at,onboarding_completed_at
) VALUES (
 '00000000-0000-0000-0000-000000007700',
 'FICTIONAL E7B Metalwork Admin',
 'netit-e7b-local-demo',
 :'netgrowth_auditor_user_id'::uuid,'steel','IT','completed',now(),now()
);
INSERT INTO public.organization_memberships(
 organization_id,user_id,role,business_role,status,is_default
) VALUES (
 '00000000-0000-0000-0000-000000007700',
 :'netgrowth_auditor_user_id'::uuid,'admin','sales_director','active',true
);
INSERT INTO public.user_legal_acceptances(
 user_id,subject_user_ref,privacy_notice_version,privacy_acknowledged_at,
 terms_version,terms_accepted_at,acceptance_source
) VALUES (
 :'netgrowth_auditor_user_id'::uuid,:'netgrowth_auditor_user_id'::uuid,
 '2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'
);

INSERT INTO public.network_company_discovery_runs(
 id,requested_by,country_code,seed_urls,source_reference,label,status,candidate_count,started_at,completed_at
) VALUES (
 '00000000-0000-0000-0000-000000007701',
 :'netgrowth_auditor_user_id'::uuid,
 'IT','["https://carp-qa-001.invalid/"]'::jsonb,'NET-IT-CARP1.D.CI-VISUAL-ONLY',
 'FICTIONAL E7B local visual acceptance, no actual company data',
 'completed',100,now()-interval '1 minute',now()
);

INSERT INTO public.network_company_discovery_candidates(
 run_id,source_url,canonical_domain,website_url,legal_name,country_code,
 role_keys,subtype_keys,product_relations,evidence,source_urls,
 facility_candidates,enrichment_quality,identity_quality,quality_flags,vat_id
)
SELECT
 '00000000-0000-0000-0000-000000007701'::uuid,
 'https://carp-qa-'||lpad(n::text,3,'0')||'.invalid/',
 'carp-qa-'||lpad(n::text,3,'0')||'.invalid',
 'https://carp-qa-'||lpad(n::text,3,'0')||'.invalid/',
 'DEMO Carpenteria '||lpad(n::text,3,'0')||' S.r.l.',
 'IT',
 ARRAY['processor_service_provider'],
 ARRAY['fabricator'],
 '[{"key":"unverified_product_scope","relationship_type":"not_assessed"}]'::jsonb,
 jsonb_build_array(jsonb_build_object(
   'type','synthetic_local_visual_fixture',
   'source_url','https://carp-qa-'||lpad(n::text,3,'0')||'.invalid/',
   'synthetic',true)),
 jsonb_build_array('https://carp-qa-'||lpad(n::text,3,'0')||'.invalid/'),
 jsonb_build_array(jsonb_build_object('region','Lombardia','province_code','MI')),
 jsonb_build_object('official_contact_20261108',jsonb_build_object(
  'email','ufficio-'||lpad(n::text,3,'0')||'@carp-qa-'||lpad(n::text,3,'0')||'.invalid',
  'phone','+39 02 0000'||lpad(n::text,4,'0'),
  'source_url','https://carp-qa-'||lpad(n::text,3,'0')||'.invalid/',
  'source_kind','synthetic_local_visual_fixture',
  'contact_scope','synthetic_nonpersonal',
  'industrial_capabilities_observed',jsonb_build_array('steel_structures','welding')
 )),
 CASE WHEN n=35 THEN
  jsonb_build_object('vat_conflict_status','historical_sole_trader_entity_explained',
                     'manual_identity_review_required',true)
 ELSE '{}'::jsonb END,
 ARRAY['product_scope_not_verified'],
 NULL
FROM generate_series(1,100) AS n;

INSERT INTO private.network_web_research_seeds(
 country_code,canonical_domain,display_name,proposed_role,source_url,
 source_summary,research_id,batch_key
)
SELECT 'IT',
 'carp-qa-'||lpad(n::text,3,'0')||'.invalid',
 'DEMO Carpenteria '||lpad(n::text,3,'0')||
   (CASE WHEN n<=18 THEN ' S.r.l.' ELSE '' END),
 'processor_service_provider',
 'https://carp-qa-'||lpad(n::text,3,'0')||'.invalid/',
 'Fully synthetic source, ephemeral local Chrome acceptance only.',
 'NETIT-E7B-QA-'||lpad(n::text,3,'0'),
 'NET-IT-CARP1.D.CI-VISUAL-ONLY'
FROM generate_series(1,34) n;

UPDATE public.network_company_discovery_candidates c
SET enrichment_quality=c.enrichment_quality ||
jsonb_build_object('identity_link_e7',jsonb_build_object(
 'status','exact_domain_alias_linked',
 'linked_research_seed_id',s.id,
 'research_display_name',s.display_name,
 'candidate_name_snapshot',c.legal_name,
 'match_basis','exact_canonical_domain_both_private_records',
 'identity_verified',false
))
FROM private.network_web_research_seeds s
WHERE s.country_code='IT' AND s.batch_key='NET-IT-CARP1.D.CI-VISUAL-ONLY'
  AND s.canonical_domain=c.canonical_domain
  AND c.run_id='00000000-0000-0000-0000-000000007701'::uuid
  AND s.display_name<>c.legal_name;

DO $assert$
BEGIN
 IF (select count(*) from private.netit_carp1_growth100_bridge)<>100 THEN
  RAISE EXCEPTION 'E7B expected 100 local Growth100 candidates';
 END IF;
 IF (select count(*) from private.netit_carp1_growth100_bridge
     where reconciliation_state='candidate_seed_aligned')<>18 THEN
  RAISE EXCEPTION 'E7B expected 18 exact matches';
 END IF;
 IF (select count(*) from private.netit_carp1_growth100_bridge
     where reconciliation_state='domain_alias_linked')<>16 THEN
  RAISE EXCEPTION 'E7B expected 16 alias-linked names';
 END IF;
 IF (select count(*) from private.netit_carp1_growth100_bridge
     where reconciliation_state='research_seed_missing')<>66 THEN
  RAISE EXCEPTION 'E7B expected 66 candidate-first profiles';
 END IF;
 IF (select count(*) from public.network_companies where
      website_domain like 'carp-qa-%.invalid')<>0 THEN
  RAISE EXCEPTION 'E7B must not publish canonical fake companies';
 END IF;
END $assert$;
COMMIT;
