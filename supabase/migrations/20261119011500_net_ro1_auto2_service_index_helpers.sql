-- NET-RO1 AUTO2 / OPS2: repair the production service_role write path.
-- Existing public.network_companies BEFORE INSERT domain trigger and
-- expression indexes invoke these three IMMUTABLE pure text normalizers.
-- The RO service-only SECURITY INVOKER publisher could preview but could
-- not INSERT because service_role lacked EXECUTE on the normalizers.
--
-- These narrow grants do NOT expose data, grant table rights, relax RLS,
-- bypass the corporate identity/role/rights gates, or open the publisher
-- to anon or authenticated clients.
--
-- Applied to production independently during the 2026-11-18 guarded
-- canary under migration history:
--   net_ro1_auto2_service_domain_normalizer_grant
--   net_ro1_auto2_service_identifier_normalizer_grant
--   net_ro1_auto2_service_company_name_index_grant
-- Keep all three grants in Git for deterministic local rebuilds.
GRANT EXECUTE ON FUNCTION private.hp4_normalize_domain(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.hp4_normalize_identifier(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.hp4_company_name_key(text) TO service_role;
