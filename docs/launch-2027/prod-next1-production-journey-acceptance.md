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
