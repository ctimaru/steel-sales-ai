# NET-LAUNCH1 — Visible Discovery in Network for Launch

16 October 2026 | Priority: product launch experience, not more back-office gates.

## Why founder saw no growth
The app has **two independent Network read paths**. Customers with Pro access see `searchNetwork()`, limited to canonical published records. Customers without Pro access but an active organization-to-Network link see NET-FAST Free, which had the 17 discovery profiles. Consequently, the platform owner / premium members did NOT see the new research discoveries. In Free, the huge Italy map came before the company list.

## Shipped behavior
- **Pro and founder**: entitlement-gated `netlaunch1_pro_discovery` and `netlaunch1_pro_profile` RPCs. Read only the existing source-governed provisional database view, with the same business-fact allowlist as Free. The Pro entitlement boundary supports the sole superadmin without requiring a Free organization link, and existing Pro advanced search/follow/save stays intact.
- **Free companies**: top-of-page profile growth counters and six featured discovered companies. All company results appear above the 20-region map.
- **Pro users**: prominent full set of unconfirmed cards before role discovery, old search and map. Their profiles open successfully using the Pro-authorized basic profile reader. A region-filtered browse explicitly says unlocated discoveries are excluded and offers national reset.
- Every provisional record shows **Da confermare**, an uncertain sector and explicit non-verification: never claim it is a steel-tube buyer, supplier, registered network member or customer.
- No new public anonymous directory or personal contacts; the basic data set stays inside authenticated and authorized Network access.

## Real incremental business data
On 16 October, a first-party official-site research cohort of **10 additional industrial equipment / agricultural equipment manufacturers** was inserted as `needs_review` research, with `finished_equipment_only`. These are *not confirmed tube buyers* and not canonical published Network companies. Official company domains: merlo.com, dieci.com, faresin.com, cifa.com, maschiogaspardo.com, scmgroup.com, celli.it, bonfiglioli.com, alpego.com, orsigroup.it. No scraping beyond human official-site research and no copied private information. Duplicates screened via existing NET-COV1 stage.

Verified production readback: 31 canonical published companies; **27** unconfirmed source-governed previews, comprising 20 company-site research + 7 clean governed crawler candidates. Visible directory potential **58**; counts remain separate.

## Release checks
- [ ] P0 Required Gate green (Next tests/typecheck/build, worker, SQL)
- [ ] SQL migration `20261016234500_netlaunch1_pro_discovery_read.sql` applied to production, runtime ACL verified
- [ ] PR #637 merged, Vercel production success
- [ ] Real authenticated premium and Free browser acceptance still pending, do not invent results

## Next launch priorities
1. NET-LAUNCH2: systematic first-party source campaigns and legitimate structured data sources for 100–300 real company discoveries; aim to increase *visible* companies, not candidates buried in queues.
2. NET-LAUNCH3: useful filters and pagination, role-based discovery conversion (follow/claim/contact) without allowing inquiries to unconfirmed companies until authorization.
3. Do not let source adapter perfection, map geolocation or full GDPR QA block basic launch feedback; preserve source rights, isolation and suppression.
