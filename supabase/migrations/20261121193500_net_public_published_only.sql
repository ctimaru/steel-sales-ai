-- NET-PUBLIC-ONLY1, 2026-11-21: separate research from the published Network.
--
-- Production audit: private.netfast_discovered_records = 208 UNIQUE candidate
-- domains; 161 already have AUTO2 discard decisions (including reuse denied),
-- 47 remain to be evaluated. These are NOT published companies.
--
-- Never delete/suppress the original evidence view. It is used by internal
-- verifier, growth, identity and trader review queues. Its source records
-- remain available internally and no company is upgraded or rejected here.
--
-- For user-facing Free / Pro discovery, country ticker, provisional map,
-- industry and steel relevance surfaces, switch only the read source to a
-- strictly empty public-visible projection. Official published companies use
-- their *existing* canonical reader and remain searchable.
--
-- This is deliberately fail-closed: any new applicant enters the Network only
-- after canonical governance/publication, not merely because a crawler saw
-- a domain or a third-party directory included its name.
CREATE OR REPLACE VIEW private.netfast_public_visible_records
WITH (security_barrier = true)
AS SELECT * FROM private.netfast_discovered_records WHERE false;

REVOKE ALL ON private.netfast_public_visible_records FROM PUBLIC, anon, authenticated;
COMMENT ON VIEW private.netfast_public_visible_records IS
  'Network Free/Pro published-only policy. No provisional profile is public; source research remains in private.netfast_discovered_records.';

DO $net_public_only1$
DECLARE
  rec record;
  old_def text;
  target_count integer := 0;
BEGIN
  FOR rec IN
    SELECT p.oid, n.nspname AS schema_name, p.proname AS function_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'f'
      AND (n.nspname, p.proname) IN (
    ('private', 'netconnect2b_activation_overview_impl'),
    ('private', 'neteima2_region_coverage_impl'),
    ('private', 'netfast_free_directory_impl'),
    ('private', 'netfast_free_profile_impl'),
    ('private', 'netlaunch1_pro_discovery_impl'),
    ('private', 'netlaunch1_pro_profile_impl'),
    ('private', 'netlaunch4b_browse_page_impl'),
    ('private', 'netpro1b_coverage_impl'),
    ('private', 'netux_map1_country_stats_impl'),
    ('public', 'netcompact4_geo_overlay'),
    ('public', 'netdata1b4_steel_relevance_page'),
    ('public', 'netdata1c_market_discovery_page')
      )
    ORDER BY n.nspname, p.proname
  LOOP
    target_count := target_count + 1;
    old_def := pg_get_functiondef(rec.oid);

    IF strpos(old_def, 'private.netfast_public_visible_records') > 0 THEN
      -- Idempotent on rerun, with all original function guards preserved.
      CONTINUE;
    END IF;
    IF strpos(old_def, 'private.netfast_discovered_records') = 0 THEN
      RAISE EXCEPTION
        'NET-PUBLIC-ONLY1: unexpected function body %.%',
        rec.schema_name, rec.function_name;
    END IF;

    -- CREATE OR REPLACE retains each function signature, owner, grants,
    -- SECURITY DEFINER, search_path, authorization and other predicates.
    EXECUTE replace(
      old_def,
      'private.netfast_discovered_records',
      'private.netfast_public_visible_records'
    );
  END LOOP;

  IF target_count <> 12 THEN
    RAISE EXCEPTION 'NET-PUBLIC-ONLY1: expected 12 public-facing readers, found %',
      target_count;
  END IF;

  IF (SELECT count(*) FROM private.netfast_public_visible_records) <> 0 THEN
    RAISE EXCEPTION 'NET-PUBLIC-ONLY1: noncanonical companies remained visible';
  END IF;
END
$net_public_only1$;
