-- NET-IT-PIEMONTE3: guard the AUTO2 queue priority contract.
-- No company promotion, evidence mutation or publisher write in this test.
BEGIN;
DO $test$
BEGIN
  IF has_function_privilege('anon','private.net_it_auto2_queue(integer)','EXECUTE')
    OR has_function_privilege('authenticated','private.net_it_auto2_queue(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Private AUTO2 implementation accidentally accessible';
  END IF;
  IF (SELECT pg_get_functiondef(p.oid) FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='private' AND p.proname='net_it_auto2_queue')
     NOT LIKE '%ORDER BY regional_priority,priority,c.created_at,c.id LIMIT p_max%' THEN
    RAISE EXCEPTION 'AUTO2 bounded priority order missing';
  END IF;
END
$test$;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $verify$
DECLARE r jsonb; i jsonb; found_n integer:=0; first_n integer:=0;
BEGIN
  r:=public.net_it_auto2_queue(50);
  IF r->>'contract'<>'net-it-auto2-queue-v1'
    OR coalesce((r->>'count')::integer,101)>50
    OR r->>'publication_authorized'<>'false' THEN
    RAISE EXCEPTION 'Unexpected review-only bounded queue %',r;
  END IF;
  SELECT count(*) INTO found_n FROM jsonb_array_elements(r->'items') i
    WHERE i->>'domain' IN (
      SELECT canonical_domain FROM private.network_web_research_seeds
      WHERE batch_key IN ('NET-IT-PIEMONTE-20261116-07',
                          'NET-IT-PIEMONTE-20261116-08')
    );
  -- The queue is ordered, but can already have processed every eligible
  -- Piemonte candidate by the time CI runs. In that case zero is valid.
  IF found_n>0 THEN
    SELECT count(*) INTO first_n
    FROM (
      SELECT i->>'domain' domain,ord
      FROM jsonb_array_elements(r->'items') WITH ORDINALITY a(i,ord)
      ORDER BY ord LIMIT found_n
    ) p
    WHERE p.domain IN (
      SELECT canonical_domain FROM private.network_web_research_seeds
      WHERE batch_key IN ('NET-IT-PIEMONTE-20261116-07',
                          'NET-IT-PIEMONTE-20261116-08')
    );
    IF first_n<>found_n THEN
      RAISE EXCEPTION 'Piemonte queue entries not prioritized first: % vs %',
        first_n,found_n;
    END IF;
  END IF;
END
$verify$;
ROLLBACK;
