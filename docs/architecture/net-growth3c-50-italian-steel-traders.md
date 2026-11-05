# NET-GROWTH3.C — 50 Italian Tube & Steel Traders Acquisition

Date: 2026-11-05. **Scope: increase real unique company database coverage; absolutely no UI, RFQ, CRM, login or canonical publishing changes.**

## Independently measured starting point
- Network production: **278 canonical published + 257 provisional discoverable = 535** company cards. Core target leads: 459. NET-FAST3 redistributable feed grants: **0**.
- The previous tranche NET-GROWTH3.B added exactly **25 new** first-party, unconfirmed trader records, via the existing service-only `netdensity3_seed_first_party`. This cohort must never be imported again.
- Candidate preflight found **9 already-registered domains**, so those companies were eliminated instead of padding the source list with duplicates. Do not treat a supplier name discovered from a directory as evidence for legal display rights.

## The batch delivered
- `services/worker/data/netgrowth3c_italian_traders_20261105.json`: **50 distinct proposed traders**, each with `name`, official company domain, precise HTTPS first-party source page, independently authored short steel-tube commercial assertion and provisional `trader_distributor` role.
- **42** records are currently past the preliminary first-party triage; **8** remain `review_hold_domains` because their direct company source, legal company-vs-brand identity or documented steel-tube trade is not sufficiently reliable for unsupervised import.
- **Held identities:** `cil-inox.com`, `ispraviareggio.it`, `sudferro.net`, `rizzasnc.it`, `comfer.it`, `ftlrossi.it`, `siderimport3.it`, `sicomsas.it`. These are NOT verified and are NOT to be published, even as provisional, until authoritative company-owned source evidence is reconfirmed or replaced with newly verified company candidates. The manifest and hold list must be reviewed together, and any edit requires fresh CI and full dedup readback.
- Further corporate attribution checks before acceptance: `gruppocsb.com` is the group domain but company name must be **CSB Commerciale Siderurgica Bresciana S.p.A.**, not its distinct service-centre sibling; `profiltubi.com` is a Rome distributor, not `profiltubi.it` manufacturer; `macentroinossidabili.it` is a distinct entity in Vender; the various Bertolini subsidiaries require company-by-company identity proof; no brand/division should be double counted.
- All company information is original factual summarization of company-owned pages; never import associated directories, exhibition lists, other marketplaces or personal contacts wholesale.

## Controlled technical workflow
- Python module `services/worker/app/netgrowth3c_firstparty_batch.py` reuses the strict input validation, identity/domain preflight across six existing production tables and legacy `www` adaptation from NET-GROWTH3.B.
- Enforces **exactly 50–100 unique proposed trader records**, rejects any unsupported company role, foreign evidence host, inadequate summary, missing company domain or duplicated identity names.
- `--dry-run` validates all records and reports `held_for_source_review` **without any credentials or network calls**.
- `--preflight` uses service credentials but **only reads** six cross-source registries, including prior leads and opt-out suppression; any unavailable table or duplicate aborts.
- `--apply` **will abort before credentials or production writes if even ONE hold remains**. On clean approval, calls exactly the existing service-role `netdensity3_seed_first_party` RPC. The DB enforces idempotency, domain-evidence relationship, role, company status and no canonical auto-publishing.
- The new GitHub workflow is exclusively `workflow_dispatch`, `main` only, with explicit `apply=false` default. No cron, no autonomous site crawling, no modified SQL permissions, no frontend changes.
- The workflow contains an explicit offline-source test step, read-only preflight and separately authorized import. Producer and processor intake is NOT falsely shoehorned into trader role: that requires a new role-correct backend contract and is out of this first cohort.

## Acceptance and measurable growth
- [x] Baseline 535 visible, 459 leads independently read from Supabase.
- [x] Create 50-source traceable cohort, 8 held records clearly identified.
- [x] Implement fail-closed importer, read-only dedup and tests.
- [ ] Audit or replace all 8 held companies on their own first-party sources, including legal identity and steel-tube trading relevance.
- [ ] CI P0 and FLOW1 success on the final reviewed head, protected merge in the agreed single-deploy window.
- [ ] Offline dry-run → read-only production preflight → controlled service-only import → count new/duplicate/invalid and `private.netfast_discovered_records` visible entries.
- [ ] **Do not claim any growth beyond 535 until the post-commit database readback.** New companies are only provisional, not verified registrations, connected suppliers or buyers.

Target at least 1,000 unique company cards; from 535 the current gap is **465**. Subsequent expansion waves prioritize Italian traders first, then role-accurate producers/processing contractors after backend role support exists.
