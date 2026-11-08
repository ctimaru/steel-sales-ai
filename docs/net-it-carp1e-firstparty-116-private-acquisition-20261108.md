# NET-IT-CARP1.E — Italian national fabricator discovery expansion, +116 private

Date: 2026-11-08; owner: Smart Steel Sales; issue: https://github.com/ctimaru/steel-sales-ai/issues/1199

## Execution (actual Supabase production readback)

Two source-browsed territorial waves:
- `NET-IT-CARP1-E-SITES-20261108`: **53 new unique private** records from 56 read first-party sites; 3 candidates excluded by database identity/domain preflight.
- `NET-IT-CARP1-E-SITES-W2-20261108`: **63 new unique private** records from 72 read first-party sites; 9 candidates excluded by preflight.
- **Total this intervention +116 private**; cumulative Italian metalworking carpenter candidates **387**, unique 387 domains, each **not_published / unclaimed / web_sourced_unverified**.
- `public.network_companies` IT `published` **278 unchanged**, 0 added by E.
- Website homepages and on-page metalworking/carpentry references observed; no company source licenses approved and legal names, exact site locations and role not fully reconciled. Do not market these as verified businesses, certified steel suppliers, steel-tube buyers or RFQ participants.

## Geography / anti-duplication

Source discovery targeted 43 search province areas this wave. These are query territories, **not verified company addresses**. The accompanying CSV groups research leads by search area and deliberately marks every area `location_verified=false`. Cross-checked against canonical, prior private research, CORE targets, discovery candidates, netfast and suppressions; excluded 12 observations before insert. Check legal identity and alternate brand domains again before public promotion.

## Publication gate independent of growth

- Batch publisher draft [PR #1204](https://github.com/ctimaru/steel-sales-ai/pull/1204) includes a separate `discovery.publish` commit permission and domain leads race lock, but was **not deployed** to production in this intervention.
- Publication requires a real logged-in Platform reviewer with source-rights decisions and legally reconciled company identity; never simulate `auth.uid()`, reviews or authorization in administrative SQL.
- From [PR #1210](https://github.com/ctimaru/steel-sales-ai/pull/1210), the pilot C17 and shortlist C5 remain operator-review-only. Continue this publication work separately, while each new 100–250 acquisition batch increases geographic coverage.
- No further decorative UI work; preserve "Claim business → Enrich profile → Verify".
