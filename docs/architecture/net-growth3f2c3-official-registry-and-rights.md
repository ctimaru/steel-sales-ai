# NET-GROWTH3.F.2C.3 — Official Registry Evidence & Final 50-Company Clearance

**2026-11-05 · RESULT: FINAL CLEARANCE NOT ACHIEVED.** This step obtained new, authoritative corporate corroboration but **did not** authorize the production import. Source ledger contains **52** candidates: 50 unexcluded research prospects, 2 quarantined brand/owner records. Unlike a brand-name match, a GLEIF hit is recorded as a company match only when the **exact same Italian tax identifier appears both on the company first-party site and the independently validated InfoCamere/GLEIF record**.

## Independent GLEIF Golden Copy lookup

Read-only queries against [GLEIF official API](https://api.gleif.org/api/v1/lei-records) were made for **15 previously collected company registration numbers** plus legal-name searches for **37** without VAT. The Golden Copy was dated **2026-11-05**.

| Metric | Current observation |
| --- | ---: |
| Known VAT identifiers, before F.2C.3 | 15 |
| New company-website VAT identifiers with exact domain match | **12** |
| First-party VAT identifiers now in research | **27/52** |
| GLEIF exact first-party VAT matches (InfoCamere RA000407) | **13** |
| Of these, ACTIVE / ISSUED / next renewal in future | **9** |
| Of these, ACTIVE but LEI LAPSED | **4** |
| GLEIF name searches with ≥1 hit | **17/37** (many generic/ambiguous) |
| Final official current visure acquired | **0** |
| Legal + rights + claim/reviewer-approved companies | **0/50** |
| F cohort additions in production | **0** |

9 *currently issued corroborated* candidates: Euroflex, Sideralba, Metal Master, Mondeo, Sidergamma, TIS, CCT INOX, Officine Orsi, Curvatura Tubi Amarossi. 4 *LAPSED LEI only* candidates: LASAR, Carema, Nanni Ottavio, Scrosati. **LAPSED does not establish company insolvency or cessation**, only that the LEI itself has not been renewed. The CCT INOX renewal previously described as October 2026 is actually **2027-10-04** in the 2026-11-05 updated Golden Copy: prior finding corrected.

[Original GLEIF LEI link](https://api.gleif.org/api/v1/lei-records/8156005738141F24A621) is preserved in every exact-match record. All official business-entity names, identifiers, LEI statuses, official registration authority and date are explicitly recorded in the new ledger; the presence of a LEI, independently matching VAT, or valid tax-ID checksum is **not** a substitute for a current company registry document, claim review and rights decision.

### Important identity precision cases

- **Nanni Ottavio:** first-party [contact/footer](https://www.nanniottavio.it/contatti/) confirms **Nanni Ottavio S.r.l. / 02014650408**, not a sole proprietorship. Previous tentative natural-person legal-form flag is corrected. Still do not harvest employee contacts or infer GDPR permission from legal-person status.
- **Tecnotubi:** company site displays owner/Amenduni VAT **06651880962**, already in Network under Alessio Tubi. A broad GLEIF "Tecnotubi" search returns at least **three unrelated legal entities** with other VAT IDs. None is assigned to `tcbtubi.it` absent operating-entity proof.
- **LASERMEC:** official [contact page](https://lasermec.it/contatti/) says **a brand owned by Dumont S.r.l.** A separate GLEIF result for *LASERMEC S.R.L.* / 01404960419 belongs to another legal entity, not automatically the brand site's owner. Keep quarantined.
- **FA.PI.:** [first-party](https://www.fapisrl.com/chi-siamo/) gives P.IVA **00141970434**. GLEIF name-search result *FA.PI. DISTRIBUZIONE S.R.L.* / 01451330516 is **different**; do not attach that entity.
- **SC, SGM, SBS:** very generic legal names return many GLEIF records. Any match without site VAT/corporate registered address proof is **unverified**.
- **OCSA:** first-party product page documents EN 10305-3/5 precision welded tubes. An older [UNSIDER association listing](https://unsider.it/wp-content/uploads/2016/05/REPERTORIO-UNSIDER-2016-26042016-rev1.pdf) ties `ocsaspa.com` to corporate identifier 00193810264, and a name-matched GLEIF record exists; the VAT has not been observed on the first-party domain, so this remains an **association+GLEIF candidate**, not an exact company-first-party identifier match.
- **Officine Foresto:** [company site](https://www.officineforesto.com/) states it is OFFICINE FORESTO SNC, VAT 01481090932, and advertises **ISO/EN1090 as in progress**. No claim of certified compliance is allowed.

### Role and AI confidence

Evidence for a company selling or processing tubes is different from verified supplier, stock, dimensional feasibility, grades or pricing:
- `company_identity_status`: `gleif_corroborated` / `first_party_only` / `alias_ambiguous` / `registry_pending`
- `industrial_role_evidence`: `first_party_process_or_product_source_found` / `mismatch_requires_taxonomy_review` / `pending_review`
- `technical_capabilities`: **only individually sourced conservative claims**; EN 10219, S355, 100×100×6, mill certification, pricing and stock remain `unknown` until evidenced.
- `supplier_verified`, `rfq_allowed`, `stock_confirmed` remain **false** for this entire research pool. No frontend UI changes.

## Rights and documentation gate

The [official Registro Imprese service](https://registroimprese.infocamere.it/ricerca-libera-e-acquisto) supports searches; for official up-to-date visure, document access and potential cost apply. A current registry document or comparable authoritative proof must be retained and reviewed per legal entity before an intake-ready manifest is assembled. No purchases were authorized.

Separate **licensed/open LEI reference data** from **company website text/images**, technical catalogs, personal contacts and database rights. [GLEIF Golden Copy](https://www.gleif.org/en/lei-data/gleif-golden-copy) supports up-to-date independent identity information; it is not a license to republish each company's protected creative works. EU [Directive 96/9/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A31996L0009) and [Commission GDPR legal-person guidance](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/application-regulation/do-data-protection-rules-apply-data-about-company_en) inform a minimized factual-metadata approach, requiring human legal/privacy sign-off on intended collection/display and an opt-out pathway. No personal contact records have been collected.

**Engineering conclusion:** This branch introduces an offline **52-row annotated evidence ledger** and a fail-closed verification guard/test suite. **27 first-party VATs**, **13 cross-matched GLEIF records**, **0 direct collisions in six database inventories** at read-only preflight, but **0 fully approved companies**. There is **no SQL/RLS/frontend migration, no unapproved import manifest, no service-role transaction, no rollback simulation and no production COMMIT**.

Protected PR order #1140 → #1141 → #1143 → #1144 → #1145 → #1146 → F.2C.3; 1 deployment/day. Next decisions: obtain up-to-date documents/registration for all 50; resolve rights/role and replace mismatches; independent reviewer approvals; then protected CI and transactionally preflight the **approved** 50 with ROLLBACK, verify no-write readback, and consider separately authorizing a single COMMIT.

Tracking: [issue #1139](https://github.com/ctimaru/steel-sales-ai/issues/1139) · [Notion roadmap](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).
