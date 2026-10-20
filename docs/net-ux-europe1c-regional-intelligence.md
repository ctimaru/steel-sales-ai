# NET-UX EUROPE1C — European Regional Intelligence

## Contract
- **NUTS 2024** versioned registry: 208 statistical regions across EU 27; Germany and Belgium use NUTS1, others NUTS2. Italy's existing 20 administrative regions remain in the compact selection.
- ISO GR corresponds to Eurostat NUTS EL; the code does not establish a company location.
- Nullable facility `eu_nuts2024_code`: no automatic backfill, inferencing, or verification. Matching requires a published facility in the selected country with explicit code or exact official NUTS label.
- Backend RPCs require authenticated org and Free/Pro entitlement. Scope is **published facilities only**, including regional capabilities tied to the matched facility; company-declared products are company-level.
- Counts are distinct companies with published mapped facilities. `coverage_complete:false` means zero mapped does NOT imply zero industrial firms.
- Foreign invalid NUTS code is rejected as an empty invalid-constraint state, never broadened silently.
- Country-only and Italian provenances remain unchanged. No changes to claims, connections, RFQ or commercial memory.
- European region polygons use static Eurostat vectors, lazy-loaded per selected country. The modal region list covers territories not drawn in the European overview.

## Deployment
- Apply `supabase/migrations/20261020110000_net_europe1c_regional_intelligence.sql` to production **before** frontend merge and verify SQL authorization/readback.
- Gate: P0 frontend tests, typecheck, build, UI contrast guard, branch merge.
- Browser authenticated Free/Pro at 390/768/1366px remains a separate acceptance requirement.
- Eurostat Nuts2json 2024, EUPL 1.2.
