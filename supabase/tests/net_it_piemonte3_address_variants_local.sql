-- NET-IT-PIEMONTE3 / First-party official extended postal formats.
-- Source literal must never be rewritten to forge a province code.
-- Keep test transaction read-only and environment-agnostic.
BEGIN;
DO $test$
DECLARE
  p jsonb;
  company_n bigint;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Test requires maintenance postgres with no user';
  END IF;

  -- Isolated province abbreviations, not substrings inside a larger word.
  IF NOT (
    lower('Contatti Corso Trieste 3 - 28100 NOVARA - NO') ~
      '(^|[^[:alpha:]])no([^[:alpha:]]|$)'
    AND lower('S.P. 593 MONCRIVELLO VC 13040') ~
      '(^|[^[:alpha:]])vc([^[:alpha:]]|$)'
    AND lower('Strada Valgera 51 – 14100 Asti – AT') ~
      '(^|[^[:alpha:]])at([^[:alpha:]]|$)'
  ) THEN RAISE EXCEPTION 'Explicit bare province codes were rejected'; END IF;
  IF lower('NOVARONE 28100') ~ '(^|[^[:alpha:]])no([^[:alpha:]]|$)' THEN
    RAISE EXCEPTION 'Part of a word must not satisfy province gate';
  END IF;

  -- Province as a full name after distinct municipality (not circular
  -- evidence where city and province have identical names).
  IF NOT (
    position('novara' IN substring(
      lower('Sede Operativa Via Sant Eufemia 28040 Paruzzaro, Novara')
      FROM position('paruzzaro' IN
        lower('Sede Operativa Via Sant Eufemia 28040 Paruzzaro, Novara'))
      FOR 100)) > 0
    AND position('verbano-cusio-ossola' IN substring(
      lower('Via Sesia 51 28891 Brolo di Nonio – Verbano-Cusio-Ossola')
      FROM position('nonio' IN
        lower('Via Sesia 51 28891 Brolo di Nonio – Verbano-Cusio-Ossola'))
      FOR 100))>0
  ) THEN RAISE EXCEPTION 'Extended province proximity was rejected'; END IF;

  IF replace(lower('San Benigno Canavese'),' canavese',' c.se')
      <> 'san benigno c.se' THEN
    RAISE EXCEPTION 'TO Canavese alias must remain exact';
  END IF;

  SELECT count(*) INTO company_n FROM public.network_facilities
    WHERE region='Piemonte' AND publication_status='published'
      AND archived_at IS NULL;
  p:=private.net_it_region_official_text_geo_publish('Piemonte',25,true);
  IF p->>'status' NOT IN ('preview_only','region_not_authorized')
     OR coalesce((p->>'published')::integer,-1)<>0 THEN
    RAISE EXCEPTION 'Dry run must not publish %',p;
  END IF;
  IF company_n<>(SELECT count(*) FROM public.network_facilities
    WHERE region='Piemonte' AND publication_status='published'
      AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Dry run wrote a facility';
  END IF;
  p:=private.net_it_region_official_text_geo_publish('Lombardia',25,false);
  IF p->>'status'<>'region_not_authorized' THEN
    RAISE EXCEPTION 'Unauthorized region published';
  END IF;
END
$test$;
ROLLBACK;
