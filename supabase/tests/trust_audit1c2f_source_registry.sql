-- TRUST-AUDIT1C.2F: existing source registry rights gate; synthetic and rolled back.
BEGIN;
DO $trust$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.network_discovery_source_registry(
      source_name,source_url,source_type,country_code,governance_status,
      terms_status,database_rights_status,personal_data_policy,enabled_for_discovery
    ) VALUES(
      'Synthetic source rights gate','https://source.test.invalid/fixture',
      'curated_public_source','IT','unreviewed','not_checked',
      'not_assessed','not_assessed',true
    );
  EXCEPTION WHEN CHECK_VIOLATION THEN
    blocked:=true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'TRUST-C2F: discovery enabled despite missing source-rights review';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.network_discovery_source_registry r
    WHERE r.enabled_for_discovery
      AND NOT (
        r.governance_status='approved'
        AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
        AND r.database_rights_status IN('low_risk','licensed')
        AND r.personal_data_policy IN('company_data_only','exclude_personal_data')
        AND r.reviewed_by IS NOT NULL
        AND r.reviewed_at IS NOT NULL
        AND NULLIF(btrim(coalesce(r.review_note,'')),'') IS NOT NULL
        AND NULLIF(btrim(coalesce(r.rights_evidence_url,'')),'') IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'TRUST-C2F: enabled source violates governance admission';
  END IF;
END $trust$;
SELECT count(*) AS enabled_governed_sources FROM public.network_discovery_source_registry WHERE enabled_for_discovery;
ROLLBACK;
