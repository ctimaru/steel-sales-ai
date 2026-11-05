# NET-GROWTH3.C — 50 Italian Tube & Steel Traders Acquisition

Date: 2026-11-05. **Scope: increase real unique company database coverage; absolutely no UI, RFQ, CRM, login or canonical publishing changes.**

## Independently measured starting point
- Network production: **278 canonical published + 257 provisional discoverable = 535** company cards. Core target leads: 459. NET-FAST3 redistributable feed grants: **0**.
- The previous tranche NET-GROWTH3.B added exactly **25 new** first-party, unconfirmed trader records, via the existing service-only `netdensity3_seed_first_party`. This cohort must never be imported again.
- Candidate preflight found **9 already-registered domains**, so those companies were eliminated instead of padding the source list with duplicates. Do not treat a supplier name discovered from a directory as evidence for legal display rights.

## The batch delivered
- `services/worker/data/netgrowth3c_italian_traders_20261105.json`: **50 distinct proposed traders**, each with `name`, official company domain, precise HTTPS first-party source page, independently authored short steel-tube commercial assertion and provisional `trader_distributor` role.
- All **50** entries passed a focused first-party company identity and product-trade screen, incorporating corrections of weak domains; **0** remain in `review_hold_domains`. A future uncovered inconsistency must reintroduce a blocking hold instead of reducing the source standard.
- **Source review decisions:** verified `cil-inox.com`, `sicomsas.it`, `rizzasnc.it` (commercial representative, **not** claimed to own stock), `sudferro.net` (Rizziconi RC, separate from Palermo), and `siderimport3.it` (first-party redirect to its parent Gruppo Bertolini legal company page). Replaced incorrect `comfer.it` with `comfersrl.com` (Roma), replaced unreachable `ispraviareggio.it` with TIR Valvoflangia (`tirvalvoflangia.com`) and `ftlrossi.it` with OSTP Italy (`ostp.it`). Replaced four insufficiently matching/unavailable identities `rigelsrl.com`, `vemapla.it`, `crisbar.it`, `siderpighi.it` with verified independent distributors `zoni1941.it`, `sidervi.com`, `sidernegri.it`, `siderferro.com`. All 50 are **unconfirmed** candidate company records and still require final automated CI and production import readback before being counted.
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
- [x] Create 50-source traceable cohort, source review first found 8 holds; all were resolved through official evidence or documented replacements. Four more low-confidence firms excluded after first-party page recheck.
- [x] Implement fail-closed importer, read-only dedup and tests.
- [x] Resolve all original 8 held records and four secondary low-confidence records; preserve 50 distinct company domains and scope to actual tube/steel trade.
- [ ] CI P0 and FLOW1 success on the final reviewed head, protected merge in the agreed single-deploy window.
- [ ] Offline dry-run → read-only production preflight → controlled service-only import → count new/duplicate/invalid and `private.netfast_discovered_records` visible entries.
- [ ] **Do not claim any growth beyond 535 until the post-commit database readback.** New companies are only provisional, not verified registrations, connected suppliers or buyers.

Target at least 1,000 unique company cards; from 535 the current gap is **465**. Subsequent expansion waves prioritize Italian traders first, then role-accurate producers/processing contractors after backend role support exists.

## Live first-party review details (05/11/2026)

The 50 URLs were checked by a bounded, business-only page read from each official site. Examples independently supporting the market role:
- Inox Team: `https://inoxteam.it/` (welded/seamless stainless pipes and sourcing)
- Sider Brescia: `https://siderbrescia.it/tubi-acciaio-lombardia/commercio-tubi-acciaio.php` (steel pipes sold and cut)
- Fratubi: `https://fratubi.it/azienda/` (industrial steel tube reseller)
- InterSteel: `https://intersteel.it/` (inox pipe distribution)
- SICOM: `https://www.sicomsas.it/prodotti` (tubes stocked for sale)
- Sud Ferro Rizziconi: `https://www.sudferro.net/` (site-origin description indexed with its separate business VAT); **not** the Palermo company's `sudferro.it`
- Siderimport3: its official `siderimport3.it` redirects to the first-party Gruppo Bertolini site, which identifies Siderimport3 S.r.l. separately from its other subsidiaries
- Zoni `zoni1941.it`, SIDER.VI. `sidervi.com`, Negri `sidernegri.it`, SiderFerro `siderferro.com` replaced non-tube/unsupported candidates after source review

The role `trader_distributor` is an initial steel-market category, not a certification or a guarantee of stock for commercial representatives, e.g. Rizza S.n.c. One record per legally distinct company; groups may have several real subsidiaries but not multiple aliases for the same company. This is only a source review; **do not** report growth before an actual database write and live reader count.
