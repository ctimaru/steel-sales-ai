-- NET-IT-VIES1 (founder authorization, 27 nov 2026 15:13): the PA1.5
-- publication guard accepts the VIES1 evidence under the same conditions as
-- first-party v4, exactly as AUTO3 already does. All other guard checks unchanged.
DO $patch$
DECLARE
  v_def text := pg_get_functiondef('private.pa1_5_discovery_publication_guard()'::regprocedure);
  v_new text;
  v_all text := $$('net-it-auto2-firstparty-v1','net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4')$$;
  v_v2 text := $$('net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4')$$;
BEGIN
  IF position('net-it-vies1-v1' IN v_def) > 0 THEN
    RETURN;
  END IF;
  v_new := replace(v_def, v_all, replace(v_all, ')', ',''net-it-vies1-v1'')'));
  v_new := replace(v_new, v_v2, replace(v_v2, ')', ',''net-it-vies1-v1'')'));
  v_new := replace(v_new, $$v_ev.reviewer_version<>'net-it-auto2-firstparty-v4'$$,
                          $$v_ev.reviewer_version NOT IN ('net-it-auto2-firstparty-v4','net-it-vies1-v1')$$);
  IF (length(v_new) - length(replace(v_new, 'net-it-vies1-v1', ''))) / length('net-it-vies1-v1') <> 3 THEN
    RAISE EXCEPTION 'NET-IT-VIES1: PA1.5 guard patch did not match';
  END IF;
  EXECUTE v_new;
END
$patch$;
