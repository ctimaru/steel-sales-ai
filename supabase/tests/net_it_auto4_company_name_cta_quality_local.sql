-- NET-IT-AUTO4-NAME3 acceptance: reject CTA copy while admitting company name.
-- Repeatable in disposable/local Supabase.
BEGIN;
DO $quality$
DECLARE
  c_id uuid;
  n text;
BEGIN
  IF private.net_it_legal_name_quality_ok('Chiama ora OFFICINE PIVA S.r.l.') THEN
    RAISE EXCEPTION 'Call-to-action prefix must fail AUTO3 quality gate';
  END IF;
  IF private.net_it_legal_name_quality_ok('Call now OFFICINE PIVA S.r.l.') THEN
    RAISE EXCEPTION 'English call-to-action prefix must fail';
  END IF;
  IF NOT private.net_it_legal_name_quality_ok('Officine Piva S.r.l.') THEN
    RAISE EXCEPTION 'Official source-backed business name must pass';
  END IF;
  IF NOT private.net_it_legal_name_quality_ok('Magliocco S.r.l.') THEN
    RAISE EXCEPTION 'Existing valid manufacturer name must remain publishable';
  END IF;
  SELECT id,legal_name INTO c_id,n
    FROM public.network_companies WHERE website_domain='officinepiva.it'
      AND publication_status='published' LIMIT 1;
  IF c_id IS NOT NULL THEN
    IF n<>'Officine Piva S.r.l.' THEN
      RAISE EXCEPTION 'Published company name not corrected: %',n;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM private.net_it_name_quality_corrections a
      WHERE a.company_id=c_id AND a.old_name='Chiama ora OFFICINE PIVA S.r.l.'
        AND a.corrected_name='Officine Piva S.r.l.'
    ) THEN
      RAISE EXCEPTION 'Name correction is missing from the audit';
    END IF;
  END IF;
END $quality$;
ROLLBACK;
