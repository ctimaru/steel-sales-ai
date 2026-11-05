# NET-RO1.3 — Romanian Legal Identity, Source Rights & Protected Import Readiness

**Date:** 2026-11-05  
**Scope:** Smart Steel Sales / Network / Romania `RO`  
**State:** RESEARCH ONLY — ZERO AUTHORIZED IMPORTS  
**Parent:** [NET-RO1 — Romania Industrial Expansion](https://app.notion.com/p/40ff059cecb5816fa3f7cfffa9696119)  
**PR:** [#1142](https://github.com/ctimaru/steel-sales-ai/pull/1142)

## Executive decision

The three NET-RO1 research waves identify **50 unique website domains** and **100 URL-linked technical claims**; they do **not** demonstrate 50 verified Romanian legal entities, publication rights or consent to contact any person.

**Preflight outcome:** `0/50` approved for the future import manifest. This is **not a 50-company rejection**: 50 legal and source-rights reviews are still incomplete.

No production writes. No direct inserts. No reused Italian intake batch. No publication, claims, invites or automatic RFQs.

## Evidence and source hierarchy

1. **ONRC / RECOM official registration lookup:** official registered name, unique CUI, current state, registration/EUID, country RO; capture query date and official reference. Legal record verification requires direct, auditable observation, not a company-page self-assertion or a third-party aggregator.
2. **Company website:** first-party technical product/service capability and group/facility identity where explicitly stated; only store a minimal source reference and factual summary, not scraped creative text. Confirm site ownership.
3. **Chamber of commerce/official directories:** corroboration for registered entity, domain and CUI; do not substitute for live registry status.
4. **Third-party company registries:** research hints only. Do not label them 'official ONRC verified', regardless of their source claims.
5. **Source rights/opt-out/privacy:** separately recorded review with a dated decision and reviewer. A missing suppression record is **not a grant of rights**. Company-name-only public business facts and original descriptions are distinct from redistributing copyrighted text, product tables or logo assets. Assess GDPR Article 14 if personal data is added later; the current research files contain no personal contacts.

References:
- Romanian law 265/2022: https://legislatie.just.ro/Public/DetaliiDocumentAfis/268266
- EU e-Justice trade-register guidance: https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-eu-countries/ro_en
- Romanian government registry information service: https://serviciipublice.gov.ro/serviciu/furnizare-informatii-din-registrul-comertului

## Verified infrastructure facts, independent read-only production

- Active country-scoped canonical role keys: `producer`, `trader_distributor`, `processor_service_provider` and `end_user`. Romania's research mix is **9/30/11**, so all three first-wave roles need support.
- `public.netgrowth3d_stage_industrial(p_items jsonb,p_batch text)` was inspected by `pg_get_functiondef`. It is service-role only, hard-codes `NET-GROWTH3D-...` batch keys, requires **50–100** rows and accepts **ONLY producer or processor**. **Do not repurpose it** for RO: it rejects 30 Romanian traders and has domain-first constraints unsuitable for separately registered multinational subsidiaries. It writes `network_core_target_leads` when called; thus it is **not** a read-only preflight.
- We queried six existing company catalogs and governance sources with `services/worker/sql/netro1_3_catalog_preflight_readonly.sql`; at the observed snapshot: **50 matched input research rows**; 2 multinational domain collisions (each matched 2 existing Italian catalog rows: `tenaris.com`, `vanleeuwen.com`); 48 without exact name/domain matches; no additional exact name collisions.
- At snapshot, suppressions, historical source-rights entries and related RO company objections returned **0 matches** across the 50. Crucially, that means **no existing approval** as well; do not flip any `rights_status` to approved by inference.
- Existing `public.network_companies` had no `country_code='RO'` row at the earlier read; do not infer that every provisional catalog has no Romanian company, and do not confuse the 282 canonical table rows with prior 278 published + 408 provisional baseline.

## First seven partial legal identity observations

File: `services/worker/data/netro1_3_identity_evidence_observations_20261105.json`.

- `artrom.com`: first-party company name and two factories (Slatina, Reșița); legal registration still needs direct ONRC check; **two facilities are one legal company**, absent contrary authoritative evidence.
- `vanleeuwen.com`: Romanian subsidiary candidate **VAN LEEUWEN ROMANIA S.R.L.**, CUI hint **18587332**, separate from Italian company on same domain; third-party corroboration only. **Hold shared-domain collision.**
- `mairon-tubes.ro`: producer website, but exact entity-versus-group linkage and CUI remain unknown. **Hold group relation.**
- `comtechco.ro`: COMTECH CO SRL, CUI hint **9600823** from a third-party register, trade-register notation **J28/215/1997** seen on first-party privacy page. Do **not** mistake that J-format registration string for a tax CUI. Direct ONRC pending.
- `isoplus.group`: Romanian company listed as a group location. Preinsulated heating pipeline product must not be automatically tagged as structural EN 10219 hollow section. **Hold group/technical mapping.**
- `rematbv.ro`: REMAT BRAȘOV SA, CUI hint **1088125**, J08/85/1991; both chamber directory and secondary register support the observation, but live ONRC and rights review remain pending.
- `thyssenkrupp-materials.ro`: **IMPORTANT 2026 RENAME**. First-party legal imprint names **tk accelis Materials Romania SRL**, formerly thyssenkrupp Materials Romania SRL, with VAT **RO18992475** and old registration **J40/11614/2009**. A secondary register likewise reports the 2026 rename. **One CUI, one legal entity**, not two company rows. Direct ONRC and rights review still pending.

The file stores only minimal non-personal legal/business observations and source URLs. `onrc_live_check=not_completed` for all seven; `source_rights_review=pending` for all. These are genuine research improvements, not 7 approvals.

## Fail-closed qualifications and evidence model

Readiness module: `services/worker/scripts/netro1_3_import_readiness.py`.

Before a company could even count as a **future import-manifest candidate**, require:

1. `country=RO`, a canonical active role, source-backed industry relevance and source URL.
2. Independently evidenced **legal registered name**, CUI, business-register number, current ONRC status and official evidence reference. Country/CUI determines corporate identity; website and brand are nonunique aliases.
3. Dated source-rights review for **public facts** and a documented objection/opt-out check, distinct from legal-identity review; independently identified reviewers, no silent bypass.
4. Facility-versus-subsidiary/group differentiation. Explicit resolution for domains/aliases already found. Unresolved exact catalog collisions remain blocked.
5. Product/process/grade/norm semantics from appropriate first-party evidence; `S235` is NOT sufficient evidence for EN 10219 and 'metal laser' is not tube laser.
6. Explicit candidate `import_ready=true` and `publication_approved=true`, approved source observations, separate independent legal and rights reviewers with timestamps.
7. A final set of **50–100 genuinely approved new Romanian CUI values**, all unique. Nothing triggers if fewer than 50 distinct legal companies qualify.
8. The read-only readiness check **never** calls an RPC and never generates an import statement. If the hypothetical minimum is met, it returns `MANIFEST_DESIGN_REVIEW_REQUIRED`, not 'import now'.

Run offline:
```bash
python services/worker/scripts/netro1_3_import_readiness.py
python -m pytest -q services/worker/tests/test_netro1_3_import_readiness.py
```

Tests include: 0 current approvals, false ONRC/rights override rejection, domain collision hold, independent dual review, duplicate CUI check, renaming as one legal entity and detection of the unsupported Italian-only RPC.

## RO-specific protected importer contract (DESIGN, NOT ACTIVE)

A future, separately reviewed importer may accept a **versioned, immutable, signature-checked** batch of 50–100 `qualified` records: country `RO`, registered name, CUI, registration, source references, reviewer decision ids, canonical role(s), technical capability evidence and separately enumerated facilities.

Guards must include active country/role taxonomy, unique `RO + CUI`, review rights and opt-outs, pre-existing suppression/exclusion reconciliation, exact and alias/group/facility matches; no auto-merge of group subsidiaries; no private contact enrichment; no bypass on a duplicated website domain where distinct companies legitimately share that domain.

The **atomic** service-role RPC must be a new RO-specific contract: protected permissions, explicit scoped batch ID, idempotency key, all-or-none validation, no unreviewed records; isolated transaction with `ROLLBACK` during rehearsal and independent readback after an explicitly approved `COMMIT`. Separate public visibility and authenticated buyer/viewer QA afterwards. No DB migration, RPC or prod write is implemented by RO1.3.

## Gate and decision

| Gate | Result |
| --- | --- |
| Research cohort 50 URL-sourced websites | DONE |
| Read-only six-catalog preflight | DONE; 2 shared-domain collisions |
| Initial legal evidence observations | 7 partial; direct ONRC 0 |
| Legal/company and source use approvals | **0** |
| 50–100 distinct legally approved and rights-reviewed entities | BLOCKED |
| RO-specific protected import RPC | NOT BUILT / NOT AUTHORIZED |
| Production import | **0** |
| Network UI changes | NONE |

**Next execution — NET-RO1.3.B:** do official company-registry checks, resolve 2026 rename and multinational CUI identities, review source rights and opt-outs, reject/hold irrelevant sites, only then backfill additional verified first-party companies if genuinely qualified count falls below 50.

_This decision record is not legal advice. Preserve original research evidence and reviewer audit logs; do not mutate the ledger into an import payload._

## NET-RO1.3.B — 19 October 2026 OFFICIAL SNAPSHOT SOURCE ACCESS / LOCAL RECONCILIATION

Read the full [ONRC snapshot streaming runbook](net-ro1.3b-onrc-snapshot-reconciliation-runbook.md), [read-only local matcher](../services/worker/scripts/netro1_3b_onrc_snapshot_reconcile.py), [synthetic tests](../services/worker/tests/test_netro1_3b_onrc_snapshot_reconcile.py) and [source-access audit record](../services/worker/data/netro1_3b_onrc_source_access_20261105.json).

The European data catalog listed the ONRC dataset dated **19.10.2026** and third-party source directories reported **CC BY 4.0** as the ONRC package's declared licence. However, repeated direct requests to `data.gov.ro` (CKAN catalog and dataset) failed with timeout/proxy error. Exact official package ID, resource links, `package_show` licence, two raw original CSV files and file hashes were **not obtained**. `metadata_verified=false`; this is a genuine unresolved blocker, not a cached/approved licence. No ONRC raw records have been scanned or matched to the 50 SSS research candidates at this point.

The new stdlib-only Python reader is intentionally offline and fail-closed: it uses locally supplied official `OD_FIRME.CSV`, `OD_STARE_FIRMA.CSV`, and authenticated/provenance-reviewed CKAN metadata; scans large CSVs in streaming mode; maps CUI and exact normalized corporate aliases; excludes PFA/individual legal forms; reads only legal entity fields and code-level statuses; labels ambiguous CUI, renames and cross-candidate duplicates for manual review; **never** changes production or flips any source-rights, ONRC live check, publication or import flag. Tests use synthetic rows, not the inaccessible ONRC company export.

**Acceptance (current):** Local matcher committed and tested via CI; real official package metadata and data **blocked**; 0/50 reconciled against actual ONRC snapshot; 0/50 legally approved; 0/50 rights cleared; 0 imported. Request the actual publisher `package_show` record and private CSVs when accessible, record their SHA-256 and provenance, then run the offline matcher and review differences. After that, record source-attribution/permission and opt-out decisions separately. Only if 50–100 genuine RO legal entities are independently approved should the RO-specific service-role importer even be designed, rehearsed with ROLLBACK and considered for separate approval.

**Licence note:** CC BY 4.0 generally permits commercial use with attribution where it actually applies to the publisher's licensed material; it never by itself licenses materials on private company websites nor overrides privacy rights.
