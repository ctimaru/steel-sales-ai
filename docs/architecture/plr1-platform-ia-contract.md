# PLR1 — Platform IA & Contract v1

Status: **contract agreed / implementation pending**. Date: 2026-10-10. Scope: \`/platform\` control plane only. Baseline main: \`8a83e9fbb59b03efad97c6b780f8525a5b78e51e\`.

## Objective

Convert the Platform Home from a directory of cards into a **role-aware operational control center**, distinct from tenant Workspace. The order is: **actionable alerts → reliable status → operational tools → strategy**. Owner is the only Platform Owner; staff remains explicitly delegated. No new permission, user, database field or private-data shortcut is granted by this contract.

## Verified inventory and permission map

\`apps/web/lib/platform-ia-contract.ts\` inventories **29** \`page.tsx\` routes under \`apps/web/app/(platform)/platform\` and assigns each to one of 17 module identities. A route is the existing canonical path; **do not move or delete route segments** during PLR2–PLR5. Keep URLs stable for bookmarks, notifications, server actions and audit links.

| IA area | Navigation modules | Intended audience |
| --- | --- | --- |
| Centro di controllo | Home; Notifications (utility via bell) | Anyone with Platform Console access |
| Aziende e accessi | Registrazioni & attivazioni; Persone & deleghe | \`registrations.read\`; owner only for People |
| Network e fiducia | Company Discovery, Company Claims, Network Trust | \`discovery.read\`, \`claims.read\`, \`network_trust.read\` separately |
| Contenuti e laboratorio | Knowledge; Steel Pulse editoriale; Private Lab | \`knowledge.read_drafts\`; owner only for Steel Pulse; Private Lab **on hold pending guard audit** |
| Analytics e attivazione | Product Analytics; Pilot | Owner only |
| Strategia e investitori | Business Plan, Marketing, Investor Access, Fundraising, Investor KPI | Owner only |

Navigation must have **six compact grouped areas**, a visible current location (\`aria-current=page\`), progressive disclosure on mobile, and context switch back to Workspace for authorized accounts. Notifications live in the utility header, not duplicated in the primary menu. Secondary modules appear within their owning group, never as an unrelated top-level link. Owner-only links must not be emitted for staff; server-side guards remain mandatory regardless of link visibility.

All 29 page routes are represented, including deep registration detail, Knowledge editor, discovery governance, private list explorer, investor artifacts and Demo Room. \`/platform/steel-pulse\` and \`/platform/notifications\` exist but are not in today's sidebar. The existing permission contract also mentions \`/platform/audit\` but no corresponding page exists: **no invented Audit link**.

## Found discrepancies and closure gates

### G1 — Private Lab audience / authorization (critical before PLR2)

Today \`platform-navigation.tsx\` sets Novità \`permission: platform.console.access\` and \`staffEnabled: true\`. \`platform/page.tsx\` also emits an unconditional \`/platform/novita\` link inside the modules panel. Its server page calls \`listPriceListsForRequest(true)\` and the nested version page uses dedicated private-lab RPCs without its own role-specific UI guard; the shared \`(platform)/platform/layout.tsx\` verifies Platform Console access. Therefore staff *may reach the surface*. This audit does **not** prove the price-list RPC will return sensitive data to that staff role: verify RPC grants, backend predicate and anonymous/non-owner behavior before asserting exposure. Private Lab contains Padana material subject to source/usage restrictions, so PLR2 must make it owner-only with defense-in-depth checks (route, RPC, action/data), preserve existing private owner access, and run owner/staff/tenant/anonymous acceptance **before** adding it to the redesigned menu.

### G2 — Registration Home totals (PLR3 prerequisite)

\`platform/page.tsx\` currently derives \`pending_review\`, \`needs_information\` and \`approved\` counts from \`getRegistrationQueue().applications\`. \`getRegistrationQueue\` requests a maximum 200 rows, so homepage global totals may be incomplete. It also treats every \`approved\` row as activation pending. Use the server aggregate \`hp6_registration_operations_queue.summary.pending_review\`, \`.ready_activation\`, \`.identity_conflicts\` after checking scope. Never present a list count as global total, nor report zero if the RPC failed/unavailable. Do not count \`needs_information\` as a task for staff when awaiting applicant response unless an actionable follow-up exists.

### G3 — Unscoped Home links (PLR2 prerequisite)

The Home currently renders the Novità link without a module permission gate, even for roles that have no other modules. Remove the unconditional link after G1 is closed. Every Home quick action, card, queue row, notification CTA and submenu must use the same access resolver; never infer access solely from \`platform.console.access\` for operational domains.

### G4 — Information architecture / visual density

Existing Platform Navigation: 15 visible definitions organized in 6 groups, plus missing deep-link routes, independent Notifications utility and Steel Pulse. Today's Home repeats a subset of these links, many with descriptions and metadata, competing with the task queue. PLR2 should unify shell/header/sidebar/mobile and replace generic “Platform Home / Moduli” with “Centro di controllo / Aree di gestione”. The owner strategy menu is a single compact group, not five equally weighted items on the Home. No additional client library or full-page fetch waterfall.

### G5 — Permission-versus-owner distinction

\`People & Access\` uses \`context.is_platform_owner\` despite a \`platform.staff.read\` capability (including Auditor). This is **intentionally owner-only in the current UI** until a separately reviewed delegation design exists. Product Analytics, Pilot and Strategy routes use superadmin/owner checks; they remain owner-only. The sidebar \`permissions\` is only a presentation filter. Delegation never grants tenant Commercial Memory access, and no employee receives root powers. All mutating actions continue to require capability gates and audit.

## Operational cockpit contract (PLR3)

Above the fold: only genuinely actionable items and reliable counts, ordered by impact: identity conflict, activation, registration review, claim proof, discovery review, Network identity review, Knowledge review. Every action has its correct owning route and permission. Each signal must retain its source, definition and verification state; no fabricated statistics or anonymous cross-tenant aggregation. The aggregate/validation status for seven candidate signals is in \`PLATFORM_IA_COCKPIT_SIGNALS\`.

- Zero is shown only when a successful scoped query returned zero; otherwise “Dato da verificare”.
- Capped/filtered list values are never treated as population totals.
- “Nessuna attività in questa vista” is not proof that other authorized queues are empty.
- Public Network coverage, verified registrations and RFQ activation are **strategy KPI candidates**, not production-ready Platform Home metrics until their lineage and access rules are audited in PLR5.
- Empty state for staff with \`platform.console.access\` but no domain access must link to \`/staff/access\`, not expose owner cards.

## Cutover contract / acceptance

PLR1 is **read-only specification + types + tests**. It does not update the live UI or authorization.

- **PLR2 — Navigation & Shell:** resolve G1/G3 before menu cutover; implement six areas from \`PLATFORM_IA_AREAS\`; preserve every URL, cross-context switch and mobile dismissal; verify owner, each staff role, anonymous user and tenant member.
- **PLR3 — Operational Cockpit:** resolve G2, use aggregates, create ordered actionable list, explicit data freshness/errors and empty states; avoid extra RPCs for ungranted domains.
- **PLR4 — Governance Workspaces:** consistent headers, action grouping, filters, responsive tables across registrations/claims/discovery/trust/knowledge; no changes to mutation or approvals without isolated tests.
- **PLR5 — Strategy & Growth Hub:** compact owner-only grouping, real KPI lineage, clarity on investor scope, owner-only steel pulse/private lab.
- **PLR6 — Security, Mobile & Production Acceptance:** Chrome multi-account, 320/390/768/1440, WCAG axe, reduced motion/keyboard, no public/private context union, SEO noindex for private pages, read-only smoke, one main Vercel deployment after green gates.

## Invariants

1. Single owner; registration requires review; Platform Staff never activates themselves.
2. Page/UI visibility is not authorization. Server guards + permission-checked RPC/RLS are source of truth.
3. Tenant-private emails, RFQs, prices, offers and orders remain inaccessible to Platform Staff by default.
4. No mutation, email delivery, database migration or new user creation in PLR1.
5. No preview deployment or cost-bearing visual analytics as an artifact of the contract.
6. Preserve the existing \`/platform\` URLs and \`/dashboard\` context switch.
