# PROD-NEXT1 — Production Journey & Commercial Activation

**Owner**: Founder / Platform Superadmin · **Status**: Active · **Launch gate**: Must-have before pilot · **Date**: 2026-10-28

**Canonical tracking**: [GitHub #1021](https://github.com/ctimaru/steel-sales-ai/issues/1021) · [Notion PROD-NEXT1](https://app.notion.com/p/407f059cecb5811e8abfc399f4a29b3d) · [Launch 2027](https://app.notion.com/p/3eaf059cecb581c49f15eedfc020fa63)

## Intent and safety boundary

Validate the **deployed** public-to-private commercial journey after COMM-CINE #1012, not just Next builds. Production checks use **anonymous GET/HEAD only**; no login, registration, mail, RFQ send, offer submission, network publication, or DB write. Full buyer/supplier transaction acceptance must use the existing **local Next + disposable Supabase** CI fixture, with synthetic identities and rollback/cleanup. A passed synthetic workflow is *not* proof of real-customer activation.

## Starting baseline (not fresh live pilot evidence)

- PR #1012 squash merge `984e3d9`, five GitHub gates green, Vercel production READY; authenticated live-production journey **not yet evidenced**.
- Open [#1016](https://github.com/ctimaru/steel-sales-ai/issues/1016) historic intermittent supplier draft/quote submission; last full synthetic E2E passed after hydration and draft-price safeguards. Monitor further.
- Open [#1017](https://github.com/ctimaru/steel-sales-ai/issues/1017) public English calculator standard selection: old browser test looked for a button, shared current UI renders native `select aria-label="Standard"`. Repro in read-only browser before resolving issue.
- [L27.5 pilot](https://app.notion.com/p/3eaf059cecb5810fb2a9cfc1adc97b83): real-company pilot remains NO-GO pending legal terms, DPA, backup/restore evidence, support and approved cohort.

## Acceptance matrix / evidence ledger

| Stage | Environment | Action | Gate | Status |
| --- | --- | --- | --- | --- |
| A1 Home/School/Network/Calculator/Distinta | Production GET/HEAD | Check 200/canonical/copy/first viewport; no write | `demotest2-4-production-smoke.yml` | HTTP checks passed in run 40721314462; Chrome follow-up rerunning |
| A2 Anonymous Commerciale | Production GET/HEAD | `/commercial` must redirect to `/login` without exposing workspace; exclude from sitemap | `demotest24-production-http.mjs`, `demotest24-production-chrome.mjs` | Added to checks; CI pending |
| B1 English EN norm selection | Production anonymous Chrome | Change real select EN 10219 → EN 10210 → EN 10219; confirm options and receipt | `i18n4-production-seo-chrome.mjs` | Updated stale test; run pending |
| B2 Calculator → Distinta (no RFQ send) | Production anonymous Chrome | Confirm weight results and explicit bill CTA | Existing production smoke | Run pending |
| C Synthetic buyer and supplier | Disposable Supabase | Login, prepare RFQ, send supplier quote, order; roles/tenants protected | `demotest2-3-chrome-auth.yml` | Previously passed, reconfirm per head |
| D Observability/activation | Production read-only / privacy-safe analytics | Classify API failures, latency, first complete draft RFQ; don't count clicks as conversions | Follow-on evidence report | Not started |
| E Real company pilot | Live only when separately authorized | Legal+trust+support+onboarding cohort | L27.5 gate | NO-GO |

## Changes in first PR

1. Align English production Chrome expectation with the **native standards select** and actively exercise both EN normative modes; do not alter calculator formulas.
2. Explicitly test anonymous `/commercial` denial on HTTP **and** Chrome, and protect private sitemap boundary.
3. Add source-contract regression tests so old button selectors and unguarded production writes cannot return.
4. Reuse existing no-write production smoke workflow; no new client analytics, credentials, tokens, or expensive crawler.

## Acceptance and rollback policy

- File a blocker with exact workflow run, environment, viewport, path (without tokens), status and reproducible steps.
- Fix app only when a current product defect is evidenced; do **not** mark tests green by suppressing errors or removing the check.
- Merge protected PR only after required CI and requested public read-only browser acceptance; if tests fail, leave PR unmerged and record blocker.
- Do not execute the real pilot or send a live RFQ. Product journey GO and real-company pilot GO are **separate decisions**.

## Next execution

After first GitHub CI: run the manual production read-only workflow on the deployed commit and capture screenshots, then resolve/reclassify #1017 based on true select interaction. In parallel audit the synthetic post-submit price retention #1016; report evidence to Notion and #1021. Only then prioritize COMM-INTELLIGENCE1.

## Execution evidence — 2026-10-28

- [Production read-only run 40721314462](https://github.com/ctimaru/steel-sales-ai/actions/runs/40721314462): `I18N4 HTTP`, `CALC-INT3E.5 HTTP`, `DEMOTEST2.4 HTTP` all **PASS**. Chrome reached `/en/knowledge/tubes` and the native standard selector checks, then stopped on an old assertion requiring a visible `Copy result` action while its parent native disclosure was closed. **Overall workflow FAIL**; do not classify complete.
- Fix: targeted Chrome check now opens the actual `<details>` with `button.tube-calculator-copy-action`, waits for visible/enabled action, and still does not click the button or write to production. English standards are exercised through the real combobox `en10210` / `en10219`.
- Latest production read-only Chrome and P0 CI are pending; update the status here and in #1021 after the rerun. Do not call issue #1017 fixed until browser completes across desktop and mobile.

## PROD-NEXT1.C — Authenticated Commercial Journey evidence contract

The existing **DEMOTEST2.3** workflow uses five genuine but synthetic local GoTrue identities in four isolated companies, a disposable Supabase database and local Next.js only. It executes the real screens; it does **not** contact production or send RFQ/PO email. The phase runs, in order:

1. **Commercial auth & RLS:** viewer forbidden to compose or read buyer-private RFQs; buyers/traders/producers blocked from unrelated private tenants.
2. **Calculator → Distinta → draft RFQ:** two structural norms (EN 10219 + EN 10210) in a private 72 m bill, persisted RFQ, two selected suppliers, reviewed but not externally dispatched; 390 and 1440 px repeated twice.
3. **Quote:** buyer receives producer's local-only quote; source unit prices 735/755 retained before and after draft save, normalized submission accepted; competing trader does not see producer prices.
4. **PO:** independent buyer organization member approves issuance, owner cannot self-approve, immutable PO version issued, supplier confirms version through isolated capability, buyer sees confirmed result; SQL proof of no provider messages.

**New evidence:** each browser script records only approved milestone keys with synthetic step durations through `prod-next1c-synthetic-evidence.mjs`. The final `prod-next1c-summarize-journey.mjs` fails closed unless *all* expected milestones exist, then uploads an artifact `prod-next1c-synthetic-journey` with stage counts and median synthetic step durations only. It must run after immutable PO SQL assertions. No credentials, business names, raw labels, tokenized URLs, quote content or customer telemetry appear in that artifact.

**Activation metric definitions for future consented real pilot** (not yet observed):
- `first_valid_bill`: user has at least one technically valid line; not a calculator page view.
- `first_private_rfq_draft`: authenticated campaign persisted with valid Distinta; not a CTA click.
- `supplier_match_reviewed`: selected recipients reviewed; no actual dispatch implied.
- `first_qualified_quote`: normalized quote successfully submitted for an authorized RFQ; not an unsaved price entry.
- `first_po_confirmation`: authorized supplier confirms immutable PO version; not just PO preview.

**Current data classification:** synthetic QA only, no customer observations; **real activation/retention baselines not available**. Consent, workspace boundaries and legal pilot gate must be evaluated before any real-customer collection.

## PROD-NEXT1.D — One continuous RFQ identity: IMPLEMENTED / CI ACCEPTANCE PENDING

**Runbook:** `.github/workflows/demotest2-3-chrome-auth.yml` executes the linked journey after its existing four-tenant/PO tests, against **one RFQ created by real BD15 Chrome** (`BD15 E2E LOCAL 1440`). It does not seed a replacement RFQ or borrow the unrelated RFQH14.2 fixture.

1. Buyer creates mixed EN10219/EN10210 two-line private Distinta via Chrome and persists RFQ with two selected suppliers. At this point the original viewer, still a `viewer`, is denied access to **that just-created RFQ**; screenshots, URLs, session cookies and credentials are not exported.
2. Local SQL verifies the exact stored campaign + Distinta source and 2 selected supplier organizations. Existing `rfqh3_launch_campaign` RPC queues two ephemeral token hashes; no external provider configuration, no email/Marketplace publish.
3. Producer accepts only his own local supplier invitation; real Chrome saves quote prices EUR/t 735 and 755, verifies they survive save, submits. Buyer sees the quote on **same RFQ**; trader cannot see competing quote; authenticated trader cannot see buyer private campaign.
4. Existing business RPCs, with synthetic buyer's authenticated Postgres claim, prepare award against the **same** RFQ and require an independent approver. **Important scope:** the award/PO terms/approval request are prepared through real application RPCs from local SQL, not manual Chrome form entry.
5. Browser signs in independent approver, records approval, owner issues immutable version 1 PO, supplier confirms the exact version, owner sees confirmed status — all on the same RFQ from Step 1.
6. Read-only SQL transaction fails unless Distinta source, two norms, quote line prices and normalization, separate-person approval, one PO v1 and supplier response all share **one RFQ identifier**; both RFQ/PO external provider messages must be zero.

A successful run will upload `prod-next1d-single-rfq-qa`, containing only explicitly authored milestone names and disposable CI timings; no RFQ UUID, capability token, mail address, price content, identity or secret. Until the linked Chrome and SQL gates pass, label this **implemented, not accepted**.

### Real-activation measurement: PILOT-GATED, NOT ENABLED

We will not instrument production commercial contents or treat synthetic CI as customer traction. Before any live pilot metrics can be turned on, all of these must be independently approved and recorded against L27.5:

- Documented pilot agreement, privacy notice/lawful basis, applicable DPA, data-retention/erasure and consent mechanism aligned with existing Consent Mode v2. No undisclosed monitoring.
- Explicit founder/superadmin GO for named pilot cohort, verified organization membership/role, support channel, backup/restore validation, and an opt-out/kill switch.
- Use a minimal, allow-listed **event vocabulary** only: `valid_bill_created`, `private_rfq_draft_saved`, `supplier_selection_reviewed`, `qualified_quote_submitted`, `po_confirmed`. Server-confirmed state change is required — never count a click or page view as conversion.
- Absolutely no emails, names, prices, material descriptions, RFQ identifiers, supplier contact data, prompt text, quote bodies, capability URLs, JWTs or IP addresses in event properties. Where authorization and consent are missing, **record nothing**.
- Report separate denominators: eligible pilot organizations/users who opted in, valid-bill creators, private RFQ creators, qualified quote receivers and confirmed POs; segment by permission only in privacy-safe aggregates with small-group suppression.
- Real activation dashboard must clearly label **real opt-in pilot** versus **synthetic test** counts. Do not backfill synthetic events as live conversions.

**Pilot metrics GO/NO-GO remains NO-GO**. This work only creates the acceptance fixture and metric governance contract; it does not enable new live customer tracking.
