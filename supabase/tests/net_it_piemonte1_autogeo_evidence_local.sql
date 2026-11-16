-- NET-IT-PIEMONTE1 / AUTO-GEO3 local transactional acceptance.
-- Run after migrations in disposable Supabase, rollback every write.
BEGIN;
DO $tests$
DECLARE
  preview jsonb;
  forbidden jsonb;
  first_run jsonb;
  second_run jsonb;
  before_count bigint;
  after_count bigint;
BEGIN
  IF session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Run source-only locality acceptance as postgres maintenance';
  END IF;

  SELECT count(*) INTO before_count FROM public.network_facilities
    WHERE region='Piemonte' AND country_code='IT'
      AND publication_status='published' AND archived_at IS NULL;
  preview:=private.net_it_region_auto3_evidence_geo_publish('Piemonte',25,true);
  IF preview->>'contract'<>'net-it-region-auto3-evidence-v1'
    OR preview->>'status'<>'preview_only'
    OR (preview->>'published')::integer<>0 THEN
    RAISE EXCEPTION 'Dry-run leaked writes or violated contract: %',preview;
  END IF;
  SELECT count(*) INTO after_count FROM public.network_facilities
    WHERE region='Piemonte' AND country_code='IT'
      AND publication_status='published' AND archived_at IS NULL;
  IF before_count<>after_count THEN
    RAISE EXCEPTION 'Dry-run wrote a facility';
  END IF;

  forbidden:=private.net_it_region_auto3_evidence_geo_publish('Lombardia',25,false);
  IF forbidden->>'status'<>'region_not_authorized'
    OR (forbidden->>'published')::integer<>0 THEN
    RAISE EXCEPTION 'Unapproved region publishing must be denied';
  END IF;

  IF (preview->>'ready')::integer>0 THEN
    first_run:=private.net_it_region_auto3_evidence_geo_publish('Piemonte',25,false);
    SELECT count(*) INTO after_count FROM public.network_facilities
      WHERE region='Piemonte' AND country_code='IT'
        AND publication_status='published' AND archived_at IS NULL;
    IF after_count-before_count<>(first_run->>'published')::integer THEN
      RAISE EXCEPTION 'Published counts do not agree: %',first_run;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.network_facilities f
      JOIN jsonb_array_elements(first_run->'items') j
        ON f.company_id=(j->>'company_id')::uuid
      WHERE f.publication_status<>'published'
         OR f.verification_status<>'unverified'
    ) THEN
      RAISE EXCEPTION 'An automatically published locality must remain unverified';
    END IF;
    second_run:=private.net_it_region_auto3_evidence_geo_publish('Piemonte',25,false);
    IF EXISTS(
      SELECT 1 FROM jsonb_array_elements(first_run->'items') a
      JOIN jsonb_array_elements(second_run->'items') b
        ON a->>'company_id'=b->>'company_id'
    ) THEN RAISE EXCEPTION 'Duplicate company site published'; END IF;
  END IF;
END
$tests$;
ROLLBACK;
