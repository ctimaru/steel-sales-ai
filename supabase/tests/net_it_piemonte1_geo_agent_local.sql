-- NET-IT-PIEMONTE1 — transactional contract / idempotency test.
-- Run only in disposable/local database with migration installed.
BEGIN;
DO $test$
DECLARE
  v_preview jsonb;
  v_other jsonb;
  v_first jsonb;
  v_second jsonb;
  v_before bigint;
  v_after bigint;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Run this test as unauthenticated postgres maintenance';
  END IF;
  v_preview := private.net_it_region_geo_auto_publish('Piemonte',25,true);
  IF v_preview->>'contract' IS DISTINCT FROM 'net-it-region-geo-auto-v1'
    OR v_preview->>'status' IS DISTINCT FROM 'preview_only'
    OR (v_preview->>'published')::int <> 0 THEN
    RAISE EXCEPTION 'Preview contract violated: %',v_preview;
  END IF;
  v_other := private.net_it_region_geo_auto_publish('Lombardia',25,true);
  IF v_other->>'status' IS DISTINCT FROM 'region_not_authorized'
    OR (v_other->>'published')::int <> 0 THEN
    RAISE EXCEPTION 'Unapproved region must not publish: %',v_other;
  END IF;
  IF (v_preview->>'ready')::int > 0 THEN
    SELECT count(*) INTO v_before FROM public.network_facilities
    WHERE country_code='IT' AND region='Piemonte'
      AND publication_status='published';
    v_first := private.net_it_region_geo_auto_publish('Piemonte',25,false);
    SELECT count(*) INTO v_after FROM public.network_facilities
    WHERE country_code='IT' AND region='Piemonte'
      AND publication_status='published';
    IF v_after-v_before <> (v_first->>'published')::int THEN
      RAISE EXCEPTION 'Publication count mismatch: % to %, result %',
        v_before,v_after,v_first;
    END IF;
    v_second := private.net_it_region_geo_auto_publish('Piemonte',25,false);
    IF (v_second->>'published')::int <> 0 THEN
      RAISE EXCEPTION 'Repeat invocation not idempotent: %',v_second;
    END IF;
  END IF;
END
$test$;
ROLLBACK;
