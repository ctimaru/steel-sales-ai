-- NET-IT-GROWTH3 — SEED1 index sources can declare how their profile pages look.
--
-- Large trade-fair catalogues (e.g. MECSPE) list exhibitors through profile
-- URLs that carry a query string (/portale/it/acme-srl?slug=acme-srl) and sit
-- beside, not below, the index page. The worker's generic heuristic skips them.
-- An optional per-source regular expression, matched against the profile's
-- path plus query, tells the two-level harvest exactly which links to follow.
-- NULL keeps today's heuristic. Nothing else about SEED1 changes: the policy,
-- daily cap, deduplication and the "pointers only" rule are untouched.

ALTER TABLE private.net_it_seed1_index_sources
  ADD COLUMN IF NOT EXISTS profile_path_pattern text
  CHECK (profile_path_pattern IS NULL
         OR char_length(profile_path_pattern) BETWEEN 3 AND 200);

COMMENT ON COLUMN private.net_it_seed1_index_sources.profile_path_pattern IS
  'Optional regex (Python re syntax) matched against path?query of same-site profile links for the two-level harvest; NULL = generic heuristic.';

CREATE OR REPLACE FUNCTION private.net_it_seed1_claim_sources_impl(p_max integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $claim$
DECLARE v_rows jsonb;
BEGIN
 IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 20 THEN
  RAISE EXCEPTION 'Bounded source batch required' USING ERRCODE='22023';
 END IF;
 IF NOT private.net_it_seed1_policy_active() THEN
  RETURN jsonb_build_object('contract','net-it-seed1-sources-v1',
   'status','policy_disabled','items','[]'::jsonb);
 END IF;
 WITH due AS (
  SELECT s.id FROM private.net_it_seed1_index_sources s
  WHERE s.enabled
    AND (s.last_harvested_at IS NULL
      OR s.last_harvested_at<=now()-make_interval(hours=>s.min_interval_hours))
  ORDER BY s.last_harvested_at NULLS FIRST,s.created_at,s.id
  LIMIT p_max FOR UPDATE SKIP LOCKED
 ), upd AS (
  UPDATE private.net_it_seed1_index_sources s SET last_harvested_at=now()
  FROM due WHERE s.id=due.id
  RETURNING s.id,s.source_url,s.source_kind,s.max_links,s.profile_path_pattern
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'url',source_url,
   'kind',source_kind,'max_links',max_links,
   'profile_pattern',profile_path_pattern)),'[]'::jsonb) INTO v_rows FROM upd;
 RETURN jsonb_build_object('contract','net-it-seed1-sources-v1',
  'status','ok','items',v_rows);
END
$claim$;
REVOKE ALL ON FUNCTION private.net_it_seed1_claim_sources_impl(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_claim_sources_impl(integer) TO service_role;
