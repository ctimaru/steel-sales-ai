-- TRUST-AUDIT1C.2D — schema/RPC acceptance in transaction, no source content.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.assert_c2d(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'TRUST C2D failed: %', msg; END IF; END $$;
SELECT pg_temp.assert_c2d((SELECT count(*)=5 FROM pg_policy WHERE polname LIKE 'trust_c2d_active_%_read' AND NOT polpermissive AND polcmd='r'),'5 restrictive policies');
SELECT pg_temp.assert_c2d((SELECT count(*)=4 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname IN ('pl1_price_list_catalog','pl1_price_list_explorer_items') AND pg_get_functiondef(p.oid) LIKE '%pl.status%active%') OR (n.nspname='pl1_private' AND p.proname='version_visible_to' AND pg_get_functiondef(p.oid) LIKE '%pl.status%active%') OR (n.nspname='pl1_private' AND p.proname='trust_c2d_active_source' AND p.prosecdef)),'guards in RPCs and helper');
SELECT pg_temp.assert_c2d((SELECT count(*)=0 FROM public.pl1_price_list_catalog(true) WHERE price_list_id IN(SELECT id FROM public.price_lists WHERE status='inactive')),'inactive catalog blocked');
SELECT pg_temp.assert_c2d((SELECT count(*)=0 FROM public.pl1_price_list_explorer_items((SELECT v.id FROM public.price_list_versions v JOIN public.price_lists l ON l.id=v.price_list_id WHERE l.status='inactive' LIMIT 1),true)),'inactive item RPC blocked');
SELECT pg_temp.assert_c2d((SELECT count(*)=0 FROM public.pl1_price_list_explorer_version((SELECT v.id FROM public.price_list_versions v JOIN public.price_lists l ON l.id=v.price_list_id WHERE l.status='inactive' LIMIT 1),true)),'inactive version RPC blocked');
ROLLBACK;
