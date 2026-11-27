-- NET-IT-GROWTH13 / 2026-11-23
-- Read-only preflight of five same-name candidate/canonical pairs.
-- Execute with authorized privileged SQL editor role. This script performs NO writes.
-- Values are research leads, NOT proof of ownership, rights or authority to publish.
-- For each VAT, validate source and freshness before authorized maintenance.
-- Existing GROWTH13 protection remains the only path to recognize distinct VAT.
WITH targets(candidate_domain,existing_domain,candidate_vat,existing_vat,
             candidate_source_url,existing_source_url,scope) AS (
 VALUES
 ('clmsrl.net','clmmeccanica.it','02262820265','01151140264',
  'https://www.clmsrl.net/index.php/chi-siamo','https://www.clmmeccanica.it/en/privacy/','vat_sources_checked'),
 ('meccanicaomg.it','omgsteel.it','00122340938','02304000694',
  'https://www.aziende.it/omg-srl-PN','https://www.omgsteel.it/contatti-omg/','registry_source_checked'),
 ('metalworkingitalia.it','metalworkingweb.com','05511410010','02064370220',
  'https://metalworkingitalia.it/','https://metalworkingweb.com/','vat_sources_checked'),
 ('metalfer.eu','carpenteriametalfer.com','05435270011','02353140136',
  'https://metalfer.eu/it/','https://www.carpenteriametalfer.com/','hold_rights_review'),
 ('steelsiderurgica.it','steelsrl.it','02404310928',NULL,
  'https://www.steelsiderurgica.it/',NULL,'hold_unresolved_canonical_identity')
)
SELECT
 t.candidate_domain,
 t.existing_domain,
 c.id AS candidate_id,
 n.id AS existing_company_id,
 t.candidate_vat AS expected_candidate_vat,
 c.vat_id AS recorded_candidate_vat,
 t.existing_vat AS expected_existing_vat,
 n.vat_id AS recorded_existing_vat,
 t.candidate_source_url,
 t.existing_source_url,
 t.scope,
 c.review_status,
 c.governance_status,
 c.personal_data_detected,
 n.claimed_status,
 n.verification_status,
 CASE
  WHEN c.id IS NULL OR n.id IS NULL THEN 'HOLD_PAIR_NOT_FOUND'
  WHEN c.country_code <> 'IT' OR n.country_code <> 'IT'
     OR n.publication_status <> 'published' OR n.archived_at IS NOT NULL
     THEN 'HOLD_COMPANY_STATE'
  WHEN c.review_status <> 'pending_review' OR c.governance_status <> 'unreviewed'
     OR coalesce(c.personal_data_detected,true)
     OR cardinality(coalesce(c.personal_data_fields,ARRAY[]::text[])) <> 0
     THEN 'HOLD_CANDIDATE_STATE_OR_PII'
  WHEN t.scope LIKE 'hold_%' THEN upper(t.scope)
  WHEN c.vat_id IS DISTINCT FROM t.candidate_vat THEN 'HOLD_CANDIDATE_VAT_CONFLICT'
  WHEN n.vat_id IS NULL THEN 'NEEDS_AUTHORIZED_CANONICAL_VAT_BACKFILL'
  WHEN n.vat_id IS DISTINCT FROM t.existing_vat THEN 'HOLD_CANONICAL_VAT_CONFLICT'
  WHEN NOT EXISTS (
     SELECT 1 FROM private.net_it_growth13_vat_proofs p
     WHERE p.candidate_id=c.id AND p.existing_company_id=n.id
       AND p.candidate_vat=t.candidate_vat AND p.existing_vat=t.existing_vat
  ) THEN 'NEEDS_GOVERNED_VAT_PROOF'
  WHEN private.net_it_growth13_distinct_vat(c.id,n.id)
     THEN 'DISTINCT_VAT_PROOF_VALID_WAIT_NEW_AUTO2'
  ELSE 'HOLD_OTHER_GROWTH13_GUARDS'
 END AS result,
 (SELECT count(*) FROM public.network_companies x
  WHERE x.country_code='IT' AND x.archived_at IS NULL
    AND x.vat_id=t.existing_vat AND t.existing_vat IS NOT NULL)
     AS existing_vat_matches,
 (SELECT count(*) FROM public.network_companies x
  WHERE x.country_code='IT' AND x.archived_at IS NULL
    AND x.vat_id=t.candidate_vat)
     AS candidate_vat_matches,
 EXISTS(SELECT 1 FROM private.net_it_growth13_vat_proofs p
        WHERE p.candidate_id=c.id AND p.existing_company_id=n.id)
     AS has_proof_record
FROM targets t
LEFT JOIN public.network_company_discovery_candidates c
       ON lower(c.canonical_domain)=t.candidate_domain
LEFT JOIN public.network_companies n
       ON lower(n.website_domain)=t.existing_domain
      AND n.country_code='IT' AND n.archived_at IS NULL
ORDER BY t.candidate_domain;

-- Required follow-up (not performed by this script):
-- 1. Authorized maintainer validates source URL + legal identity + VAT;
--    separately checks no duplicate VAT, no owner-claimed or verified profile.
-- 2. Authorized governed path enriches existing canonical VAT with provenance,
--    records the two-source GROWTH13 proof, and verifies helper=true.
-- 3. Wait for real first-party AUTO2 re-review; don't change historical verdict.
-- 4. AUTO3 dry_run: release only genuinely ready candidates with current owner
--    delegation, rights, hashes, PII and exact domain/VAT checks intact.
