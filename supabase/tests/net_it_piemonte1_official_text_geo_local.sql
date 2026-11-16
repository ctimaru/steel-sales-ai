-- Execute only on disposable/local Supabase with Piemonte observation migration.
BEGIN;
DO $checks$
DECLARE preview jsonb; actual jsonb; repeat_run jsonb; disallowed jsonb;
  before_n bigint; after_n bigint;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Test must run as non-user postgres maintenance';
  END IF;
  SELECT count(*) INTO before_n FROM public.network_facilities
    WHERE region='Piemonte' AND publication_status='published' AND archived_at IS NULL;
  preview:=private.net_it_region_official_text_geo_publish('Piemonte',25,true);
  IF preview->>'contract'<>'net-it-region-official-text-v1'
    OR preview->>'status'<>'preview_only'
    OR (preview->>'published')::integer<>0 THEN
    RAISE EXCEPTION 'Invalid preview %',preview;
  END IF;
  SELECT count(*) INTO after_n FROM public.network_facilities
    WHERE region='Piemonte' AND publication_status='published' AND archived_at IS NULL;
  IF before_n<>after_n THEN RAISE EXCEPTION 'Preview wrote geographic data'; END IF;
  disallowed:=private.net_it_region_official_text_geo_publish('Lombardia',25,false);
  IF disallowed->>'status'<>'region_not_authorized' OR (disallowed->>'published')::integer<>0 THEN
    RAISE EXCEPTION 'Unauthorized region published %',disallowed;
  END IF;
  IF (preview->>'ready')::integer > 0 THEN
    actual:=private.net_it_region_official_text_geo_publish('Piemonte',25,false);
    SELECT count(*) INTO after_n FROM public.network_facilities
      WHERE region='Piemonte' AND publication_status='published' AND archived_at IS NULL;
    IF after_n-before_n <> (actual->>'published')::integer THEN
      RAISE EXCEPTION 'Result mismatch %',actual;
    END IF;
    IF EXISTS(
      SELECT 1 FROM jsonb_array_elements(actual->'items') x
      JOIN public.network_facilities f ON f.company_id=(x->>'company_id')::uuid
      WHERE f.verification_status<>'unverified' OR f.publication_status<>'published'
    ) THEN RAISE EXCEPTION 'Must remain unverified'; END IF;
    repeat_run:=private.net_it_region_official_text_geo_publish('Piemonte',25,false);
    IF EXISTS(
      SELECT 1 FROM jsonb_array_elements(actual->'items') a
      JOIN jsonb_array_elements(repeat_run->'items') b
      ON a->>'company_id'=b->>'company_id'
    ) THEN RAISE EXCEPTION 'Duplicate published'; END IF;
  END IF;
END
$checks$;
ROLLBACK;
