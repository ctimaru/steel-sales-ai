-- NET-PUBLIC-ONLY1: public Network never shows unconfirmed/discarded research
-- while AI/internal review still has the original source and evidence.
BEGIN;
DO $net_public_only_test$
DECLARE
  v_rewired integer;
  v_visible integer;
BEGIN
  IF to_regclass('private.netfast_discovered_records') IS NULL OR
     to_regclass('private.netfast_public_visible_records') IS NULL THEN
    RAISE EXCEPTION 'NET-PUBLIC-ONLY1: missing internal/public views';
  END IF;
  IF strpos(pg_get_viewdef('private.netfast_discovered_records'::regclass),
            'network_core_target_leads') = 0 THEN
    RAISE EXCEPTION 'NET-PUBLIC-ONLY1: internal discovery source was destroyed';
  END IF;
  SELECT count(*) INTO v_visible FROM private.netfast_public_visible_records;
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'NET-PUBLIC-ONLY1: % provisional profiles still shown',v_visible;
  END IF;
  IF has_table_privilege('anon','private.netfast_public_visible_records','SELECT')
     OR has_table_privilege('authenticated','private.netfast_public_visible_records','SELECT') THEN
    RAISE EXCEPTION 'NET-PUBLIC-ONLY1: public SQL view leaked to API roles';
  END IF;
  SELECT count(*) INTO v_rewired
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prokind='f'
    AND (n.nspname,p.proname) IN (
      ('private','netconnect2b_activation_overview_impl'),
      ('private','neteima2_region_coverage_impl'),
      ('private','netfast_free_directory_impl'),
      ('private','netfast_free_profile_impl'),
      ('private','netlaunch1_pro_discovery_impl'),
      ('private','netlaunch1_pro_profile_impl'),
      ('private','netlaunch4b_browse_page_impl'),
      ('private','netpro1b_coverage_impl'),
      ('private','netux_map1_country_stats_impl'),
      ('public','netcompact4_geo_overlay'),
      ('public','netdata1b4_steel_relevance_page'),
      ('public','netdata1c_market_discovery_page')
    )
    AND strpos(pg_get_functiondef(p.oid),'private.netfast_public_visible_records')>0
    AND strpos(pg_get_functiondef(p.oid),'private.netfast_discovered_records')=0;
  IF v_rewired<>12 THEN
    RAISE EXCEPTION 'NET-PUBLIC-ONLY1: only %/12 readers use canonical-only policy',v_rewired;
  END IF;
END
$net_public_only_test$;
ROLLBACK;
