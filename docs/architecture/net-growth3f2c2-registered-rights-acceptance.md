# NET-GROWTH3.F.2C.2 — Registered-Entity, Source Rights & Publication Decision

2026-11-05 · **RESEARCH DECISION: BLOCKED**. This is an evidence-backed corporate reconciliation and review queue, **not** an import-eligible 50-company batch.

## Live state and quality

- Baseline readback: **278 canonical published + 408 provisional = 686**, **0 F import**.
- The original 50 unique research domains plus 2 sourced reserves make **52 audited prospects**. **Two distinct legal-name failures**:
  1. \`tcbtubi.it\` / **Tecnotubi** official page footer identifies Amenduni Tubi Acciaio S.r.l., P.IVA **06651880962**, a VAT number also used in the existing discovery database for \`alessiotubi.it\`. Exclude until separate operating registration is proven. Group plants and brands are not unique legal entities.
  2. \`lasermec.it\` / **LASERMEC** [contact page](https://lasermec.it/contatti/) openly states the Lasermec name is a trademark owned by **Dumont S.r.l.**, independently corroborated as a historic business VAT **00287740260** via an [older public-sector supplier list](https://www.atertv.it/docs/File/albo%20fornitori/ALBO_FORNITORI_export_05_03_19.PDF). This shows a brand/operator relation, **not** current legal registration, or permission to import as a separate firm. Source original laser-tube product signal remains attributable to the company after operator verification.
- Therefore **50 not-yet-approved candidate legal prospects** (48 original + 2 reserves). Total **52 inspected**, 2 quarantined. The 50 are candidate domains, not 50 officially vetted companies.
- Exact-domain / normalized-name / known-VAT check over all 52 found **0 new collisions**, but the Tecnotubi operator VAT cross-check was performed *in addition* by matching owner/operator identity. Thus the zero field-level results are not proof of unique identity.

## Independent corporate evidence, with strength labels

- TIS S.r.l., [LEI 815600326CEFAA70DD71](https://lei.bloomberg.com/leis/view/815600326CEFAA70DD71): Infocamere registration ID 02378390138, entity ACTIVE, LEI ISSUED, renewal 2027-06-06. **Independent corroboration**, not human publication approval.
- CCT INOX S.p.A., [LEI 8156005738141F24A621](https://lei.bloomberg.com/leis/view/8156005738141F24A621): Infocamere registration ID 13022780152 and entity ACTIVE; next renewal 2026-10-04 is in the past. Do not infer a current LEI renewal or automatically label the entity ceased.
- Reserve [M.M. Montanari](https://www.mmtubi.it/), VAT 01004310395: first-party and [secondary company listing](https://www.ufficiocamerale.it/5735/mm-montanari-massimo-srl), but secondary listing explicitly says **not directly official Chamber of Commerce data**. No independent official registration sign-off.
- Reserve [FROM S.r.l.](https://www.fromsrl.it/index.html), VAT 02757641200: first-party name and third-party machine work clear; currently no official independent register acceptance.
- Several others (KGT, OMV, CCT, Tubifaber, Teknolaser, Euroflex etc.) have first-party corporate VAT/identity. **VAT formatting and checksum do not validate current registration.**

## Rights and privacy, two clearly separate layers

Intended SSS Network content is **minimal factual first-party information only**: legally correct company name, corporate domain, reviewed role, conservative original short paraphrase of processes/products, specific source URLs, date, unknown fields, an opt-out/claim pathway. No company photos/logos, copied descriptions, third-party catalog dumps, or personal contacts in research rows.

Legal posture is **not auto-approved**:
- [Directive 96/9/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A31996L0009): database-maker rights may restrict extraction and republication of substantial or systematically extracted collections, though no new copyright in mere facts is created by the Directive. Avoid blanket claims that all public web content requires a license **or** that all public web facts are freely reusable in every context.
- [GDPR 2016/679](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679): if later adding identifiable people/emails, legal basis and proper notice require separate consideration; that step is outside this cohort.
- [Teknolaser legal notices](https://teknolaser.it/note-legali/): separate factual data from protected text, images and technical specifications. Do not copy protected material.
- Data-rights classification \`pending_legal_review\` for **all 52** until human legal sign-off and published-use scope is documented. Do not mistake a first-party product claim for machine stock, manufacturing availability or a supplier-verification badge.

## Engineering acceptance

- Machine-readable [52-row legal review ledger](../services/worker/data/netgrowth3f2c2_registered_rights_20261105.json) with original source, first-party VAT if supported, independent evidence where available, role/rights/identity gates, 2 brand exclusions, and a review artifact field.
- Offline [read-only validator](../services/worker/app/netgrowth3f2c2_registered_rights.py), [tests](../services/worker/tests/test_netgrowth3f2c2_registered_rights.py) block if 50 official registrations, reviewed technical facts, documented rights assessment and reviewer decisions are not all accepted.
- All 52 currently held, **0 approved for production**, no approved import manifest, no RPC ROLLBACK called. Protected checks and branch review are separate.
- Protected PR order **#1140 → #1141 → #1143 → #1144 → #1145 → F.2C.2**, no premature merges, one deployment per day.

## Next steps

1. For 50 active prospective entities, seek up-to-date official RegistroImprese/Telemaco or BRIS extract, record legal name, VAT/CF, status and parent/operator. Reject or replace if business is a mere brand, inactive, duplicate or tube-irrelevant.
2. Revisit F.2C source correctness and open 5 retrieval issues; require claim-level exact first-party URL. Resolve fittings/automotive roles without forced category.
3. Legal reviewer approves factual-metadata-only collection/display/reuse pattern and any required notices or attribution case-by-case. No automatic contact harvesting.
4. Rerun **six DB registers plus VAT/aliases** on the *approved final 50–100*. Only then build approved RPC manifest and do one service-role transaction with ROLLBACK, verify no-write readback. COMMIT must remain a distinct authorized decision.

[GitHub tracking #1139](https://github.com/ctimaru/steel-sales-ai/issues/1139) · [Notion F roadmap](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).
