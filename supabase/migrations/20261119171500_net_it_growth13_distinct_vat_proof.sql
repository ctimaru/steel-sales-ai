-- GROWTH13: archived or unknown corporate VATs NEVER override name dedup.
-- Only independent 11-digit VAT identities with first-party/corporate proofs
-- are eligible for a later exact-name duplicate exception.
CREATE TABLE IF NOT EXISTS private.net_it_growth13_vat_proofs (
 candidate_id uuid PRIMARY KEY REFERENCES public.network_company_discovery_candidates(id),
 existing_company_id uuid NOT NULL REFERENCES public.network_companies(id),
 candidate_vat text NOT NULL CHECK (candidate_vat ~ '^[0-9]{11}$'),
 existing_vat text NOT NULL CHECK (existing_vat ~ '^[0-9]{11}$'),
 candidate_source_url text NOT NULL CHECK (candidate_source_url LIKE 'https://%'),
 existing_source_url text NOT NULL CHECK (existing_source_url LIKE 'https://%'),
 documented_at timestamptz NOT NULL DEFAULT now(),
 CHECK(candidate_vat<>existing_vat)
);
ALTER TABLE private.net_it_growth13_vat_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_growth13_vat_proofs FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION private.net_it_growth13_distinct_vat(p_candidate uuid,p_existing uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $proof$
 SELECT EXISTS(SELECT 1
 FROM private.net_it_growth13_vat_proofs p
 JOIN public.network_company_discovery_candidates c ON c.id=p.candidate_id
 JOIN public.network_companies n ON n.id=p.existing_company_id
 WHERE p.candidate_id=p_candidate AND p.existing_company_id=p_existing
 AND c.country_code='IT' AND n.country_code='IT'
 AND c.review_status='pending_review' AND c.governance_status='unreviewed'
 AND n.publication_status='published' AND n.archived_at IS NULL
 AND c.vat_id=p.candidate_vat AND n.vat_id=p.existing_vat
 AND p.candidate_vat<>p.existing_vat
 AND c.personal_data_detected=false AND cardinality(c.personal_data_fields)=0
 AND private.net_it_legal_name_quality_ok(c.legal_name)
 AND lower(btrim(c.legal_name))=lower(btrim(n.legal_name))
 AND lower(btrim(c.canonical_domain))<>lower(btrim(n.website_domain))
 AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_discards d WHERE d.candidate_id=c.id)
 AND (SELECT count(*) FROM public.network_companies x WHERE x.country_code='IT'
      AND x.archived_at IS NULL AND x.vat_id=c.vat_id)=0
 AND (SELECT count(*) FROM public.network_companies x WHERE x.country_code='IT'
      AND x.archived_at IS NULL AND lower(btrim(x.legal_name))=lower(btrim(c.legal_name)))=1);
$proof$;
REVOKE ALL ON FUNCTION private.net_it_growth13_distinct_vat(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_it_growth13_distinct_vat(uuid,uuid) TO service_role;
