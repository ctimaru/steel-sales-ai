# NET-GROWTH3.F.2C.1 — Corporate Identity & Source Remediation (first independent pass)

**Decision as of 2026-11-05: REVIEW IN PROGRESS, PRODUCTION INTAKE BLOCKED.** This adds a **non-importable documentary overlay** on the F.1/F.2/F.2B 50-candidate research pool and F.2C 50-row audit, not a revised approved 50-entity import manifest.

## Definitive technical / identity corrections made to our evidence model

- **Tecnotubi `tcbtubi.it`**: official footer identifies **Amenduni Tubi Acciaio S.r.l. P.IVA 06651880962**, also present **twice** in `network_company_discovery_candidates` under `alessiotubi.it` (read-only production P.IVA cross-check). A common footer is not proof the operational plant is the *same* legal entity, but a **strong legal-owner collision**: quarantine from new-company cohort until distinct entity number + primary-source proof is supplied. The previous 0-domain-collisions claim did not test VAT.
- **DE.MA `dematubi.it` vs `dematubisrl.it`**: first-party company names differ (De.Ma. di Baldini Giancarlo vs De.Ma. S.r.l.), P.IVA **01248890426 vs 02794420428**, similar activity/address and history. Preserve separately pending independent register and legal successor/affiliate proof; do not merge or import as unique.
- **Amarossi**: [official anagrafica](https://amarossi.it/wp-content/uploads/2026/02/Anagrafica.pdf) identifies **Curvatura Tubi Amarossi S.p.A.** P.IVA 01496290352, controlled by Amarossi 1976 S.r.l. The control relation is **not** itself proof of duplicate; corporate identity evidence improved, independent official registry/rights review still needed. [Official supply terms](https://amarossi.it/wp-content/uploads/2026/02/condizioni-di-fornitura.pdf) explicitly do *not* support generalized ISO 9001, EN 1090 or DoP claims.
- **TIS**: [LEI record](https://lei.bloomberg.com/leis/view/815600326CEFAA70DD71) gives Infocamere-corroborated company registration 02378390138 and next renewal June 2027. Strong independent evidence, not a human approval.
- **CCT INOX**: [LEI record](https://lei.bloomberg.com/leis/view/8156005738141F24A621) gives P.IVA 13022780152 but listed renewal was 4 October 2026; refresh independent record before declaring current.
- **Euroflex**: original `/it/tubolari/` does not itself substantiate EN 10219; use [quality and certifications](https://www.euroflexspa.it/it/qualita-e-certificazioni/) for standard/certificate context, not blanket grade/size compatibility.
- **OCSA**: original `/en/` is general. Use [official precision welded tubes page](https://www.ocsaspa.com/en/tubes/) for EN 10305-3/5 and *feedstock-specific* size ranges.
- **SGM**: original contact page not sufficient technical evidence. [Lavorazioni page](https://www.sgmsrl.com/lavorazioni.html) documents laser tube work.
- **Teknolaser / Andrea Balboni**: first-party [laser tube capability](https://teknolaser.it/laser-tubo/) specifies two separate machines with different diameter/weight bounds. [Legal notices](https://teknolaser.it/note-legali/) warn against reproducing protected materials commercially without permission; do not convert to blanket ban on public corporate facts or silent license to copy.
- **Envasald, Emme Erre Inox, T.ERRE**: specific role review holds; fittings manufacturing and automotive tubing assemblies are not automatically independent third-party processors of structural steel tubes.
- **Five previously unreadable original URLs** (De.Ma, KGT, Teknolaser, Tubifaber, Gromet) remain flagged as live-fetch failures; first-party indexed evidence corroborates company claims, without changing live-fetch status. Retry/check when accessing independently.

## New replacement reserve — not production
- **M. M. Montanari Massimo S.r.l.** ([first-party](https://www.mmtubi.it/)), P.IVA **01004310395**, producer of longitudinal and spiral-welded steel tubes; site contains the corporate name/VAT and product facts. Zero exact domain/name/VAT matches against six Network inventories and VAT columns at check time.
- **FROM S.r.l.** ([first-party](https://www.fromsrl.it/index.html)), P.IVA **02757641200**, third-party machining of stainless steel tubes and other components; source gives corporate identity, VAT and capabilities. Zero exact domain/name/VAT matches at check time.

Original F research: **50**. Tecnotubi removed from *eligible new-entity* count pending legal identity confirmation → **49 active original research prospects + 2 source-backed replacement reserves = 51 candidates**. **This is not 51 reviewed or verified companies.** Other holds may reduce the eventual eligible count further.

## Ruling / next gate

- The original F.1/F.2/F.2B research snapshots and F.2C audit ledger are preserved; `netgrowth3f2c1_corporate_source_remediation_20261105.json` is the immutable next-stage corrective overlay.
- `app/netgrowth3f2c1_remediation.py` is an offline, read-only parser: validates that exclusions/replacements/claim corrections are anchored to the original manifest, without creating a service-role RPC payload. Tests assert **0 approvals, no preflight allowed**.
- Rights to reproduce protected technical text/media or republish site database content are **not** granted merely because the source is public. Legal review/human approval remains pending for all 50 plus 2 reserves.
- **No SQL/RLS changes or production data writes.** Baseline 278 canonical + 408 provisional = 686, F import 0.
- **DO NOT execute transactional RPC ROLLBACK yet**: user sequence explicitly requires fully reviewed legal identity + rights + protected CI first.
- Next work: check exact company registration/ownership for all candidates, resolve/replace holdings, obtain permitted use / factual data posture and human signoff; then construct 50–100 reviewed manifest, verify six catalogs and P.IVA, protected CI, RPC dry-run with ROLLBACK, independent no-write readback; eventual COMMIT separately authorized.

Tracking [issue #1139](https://github.com/ctimaru/steel-sales-ai/issues/1139) · [Notion Network roadmap](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).
