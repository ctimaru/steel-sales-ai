# NET-GROWTH3.F.2C — Independent Legal Identity, Source Rights & Atomic Preflight Decision

**Status: BLOCKED, read-only, 5 November 2026.** This decision is supported by first-party site inspection, a new live SQL dedup query and CI reads. The intended 50-entity source-backed **research pool is not an import authorization**.

## Preflight inputs and observed results

- 3 research manifests F.1 / F.2 / F.2B = **50 distinct domains and names**: 12 candidate manufacturers, 38 candidate processors. 65 candidate technical claims total.
- **Fresh production six-catalog query**: 0 exact-domain collisions across canonical, core leads, discovery (including rejected), CC0, licensed and suppressed/opt-out; 0 exact-normalized-name matches in canonical/leads/discovery. This does not disprove alternate group names, sister company records, registration number collisions or tax-ID overlaps.
- Production: **278 canonical published + 408 provisional = 686**, **0 F imports**.
- Original 50 first-party source URLs: the website reader could extract readable HTML/text from **45**, while **5** were unsuccessful for that reader (De.Ma, KGT, Teknolaser, Tubifaber, Gromet). Independent public-web indexing points to official alternative pages for those five; this does **not** equal a successful live-reader fetch or an approval.
- Several claims require source URL corrections, even where the claims appear on a different first-party page.
- **Legal IDs:** a small subset have a company tax ID displayed on their own website and recorded as *observed only*, not checked against the independent Italian companies register. The ledger is complete for 50 but **0/50** have independent registry sign-off, source-rights acceptance or human role/claim sign-off.

## Critical holds and corrections

| Entity / source domain | Finding | Required action |
| --- | --- | --- |
| DE.MA — `dematubi.it` | Site identifies **DE.MA di Baldini Giancarlo**, VAT 01248890426; another official domain `dematubisrl.it` identifies **DE.MA SRL**, VAT 02794420428, same industrial history/address | Determine legal succession or affiliated status, correct ledger legal name and do not import ambiguously |
| Curvatura Tubi Amarossi — `amarossi.it` | Own site identifies VAT 01496290352; parent/direction Amarossi 1976 SRL | Confirm distinct legal registration and acceptable group-alias handling (group membership does not automatically mean duplicate) |
| Andrea Balboni / Teknolaser — `teknolaser.it` | Own site identifies VAT 01908860388; legal notes say protected text/media may not be reproduced or used commercially without authorization; technical data are indicative | Assess factual-data rights separately from protected content reuse, do not copy source text, no assumption of license or verified capability |
| Euroflex — `euroflexspa.it` | `/it/tubolari/` supports welded shapes, **not** the EN 10219 claim on that exact page; `/it/qualita-e-certificazioni/` does show an EN 10219 structural tube certification | Update claim-level URL only after review; do not label company certified beyond the specific certificate context |
| OCSA — `ocsaspa.com` | Home page too generic for dimensions; `/en/tubes/` gives EN 10305-3/5 with separate ranges by material/coil type | Attach exact source and do not collapse different grade/size ranges into one indiscriminate capability |
| SGM — `sgmsrl.com` | `/contatti.php` is an identity/contact page, not evidence for laser capability; `/lavorazioni.html` describes fabrication | Correct claim URL before claim approval |
| LASAR — `lasar.it` | Original reader extracted a cookie-limited page; independent site search shows tube laser/bending. Site discloses legal entity and parent group | Reconfirm full technical content, alias and parent relation |
| Envasald, Emme Erre Inox, T.ERRE | First-party positioning suggests **fittings manufacturer** or **rigid automotive tubing/assembly maker**; `processor_service_provider` may not be the correct primary role | Explicit industrial-role review, not forced rebucketing |
| KGT, Tubifaber, Gromet | Temporary first-party live page fetch errors, with official indexed source corroboration | Repair or document source retrieval; confirm legal identity before import |

**Important licensing distinction:** a website open to readers is not in itself permission to copy creative descriptions, images or systematically reuse a protected database. Candidate names, independently paraphrased factual signals and URLs still require a documented compliance assessment appropriate to intended use. Keep no personal contacts or private tenant data.

## New enforceable gate

- `services/worker/data/netgrowth3f2c_independent_acceptance_20261105.json` is a **50-row review ledger** with exact original name/domain/role and source links, observed first-party business VAT (where visible), original fetch result, source corrections, legal/group/role/claim/rights status and explicit holds. All review decisions default to pending. The ledger does not write to production.
- `services/worker/app/netgrowth3f2c_acceptance_gate.py` is a pure offline fail-closed validator. It requires independent registry, documented rights basis, legal name/role/technical assertion and human reviewer, full source accessibility and no unresolved holds. It reports blockers only; **no RPC payload or production writing function**.
- Unit tests require **50/50 blocked**, 0 approved, explicit rights caution, and demonstrate that changing statuses to `approved` without legal evidence/reviewer cannot unlock the batch.
- No SQL schema/RLS change, no frontend/Network UI change, no employee email/phone capture, no automated publisher or RFQ dispatch.

## Decision on production RPC dry-run

**NOT RUN.** User-specified ordering was “only after” legal identity + source rights + CI. All 50 currently lack independent legal/rights acceptance; #1143 CI is still not fully proven GREEN. Running `BEGIN; SET LOCAL ROLE service_role; SELECT public.netgrowth3d_stage_industrial(...); ROLLBACK` on unapproved sources would violate that release gate, even if it would not persist data.

**Next release gate:** resolve independent corporate registration/parent group, source content usage rights, fix/replace invalid records, obtain reviewer sign-off for >=50, then generate an **import-ready** manifest and perform single protected RPC transactional ROLLBACK proof. After protected merge, only one governed COMMIT and independent production readback.

Dependency chain #1140 → #1141 → #1143 → F.2C. Track [GitHub issue #1139](https://github.com/ctimaru/steel-sales-ai/issues/1139) and [Notion NET-GROWTH3.F](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).
