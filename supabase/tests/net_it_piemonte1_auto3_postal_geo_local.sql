-- NET-IT-PIEMONTE1 AUTO3 postal source-only acceptance.
-- Execute in a disposable/local DB after migrations. Entire transaction rolls back.
BEGIN;
DO $test$
DECLARE
  preview jsonb;
  unavailable jsonb;
  applied jsonb;
  repeated jsonb;
  before_count bigint;
  after_count bigint;
BEGIN
  IF session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance-only local acceptance';
  END IF;
  SELECT count(*) INTO before_count FROM public.network_facilities
    WHERE country_code='IT' AND region='Piemonte'
      AND publication_status='published' AND archived_at IS NULL;

  preview := private.net_it_region_auto3_postal_publish('Piemonte',25,true);
  IF preview->>'contract'<>'net-it-region-auto3-postal-v1'
     OR preview->>'status'<>'preview_only'
     OR (preview->>'published')::integer<>0 THEN
    RAISE EXCEPTION 'Preview contract violation: %',preview;
  END IF;
  SELECT count(*) INTO after_count FROM public.network_facilities
    WHERE country_code='IT' AND region='Piemonte'
      AND publication_status='published' AND archived_at IS NULL;
  IF before_count<>after_count THEN
    RAISE EXCEPTION 'Preview wrote a facility';
  END IF;

  unavailable := private.net_it_region_auto3_postal_publish('Lombardia',25,false);
  IF unavailable->>'status'<>'region_not_authorized'
     OR (unavailable->>'published')::integer<>0 THEN
    RAISE EXCEPTION 'Unapproved region cannot publish';
  END IF;

  IF (preview->>'ready')::integer>0 THEN
    applied := private.net_it_region_auto3_postal_publish('Piemonte',25,false);
    SELECT count(*) INTO after_count FROM public.network_facilities
      WHERE country_code='IT' AND region='Piemonte'
        AND publication_status='published' AND archived_at IS NULL;
    IF after_count-before_count<>(applied->>'published')::integer THEN
      RAISE EXCEPTION 'Published count mismatch: %',applied;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.network_facilities f
      JOIN jsonb_array_elements(applied->'items') a ON (a->>'company_id')::uuid=f.company_id
      WHERE f.verification_status<>'unverified'
        OR f.publication_status<>'published'
    ) THEN
      RAISE EXCEPTION 'Published source-locality must remain unverified';
    END IF;
    repeated := private.net_it_region_auto3_postal_publish('Piemonte',25,false);
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(applied->'items') a
      JOIN jsonb_array_elements(repeated->'items') b
        ON a->>'company_id'=b->>'company_id'
    ) THEN
      RAISE EXCEPTION 'Repeated batch published the same company again';
    END IF;
  END IF;
END
$test$;
ROLLBACK;
