# NET-RO1.3.B — ONRC snapshot reconciliation (operator runbook)

**Decision (2026-11-05, resource-link discovery):** official ONRC dataset URL and three direct `data.gov.ro` CSV resource links are now identified through the [official ONRC dataset catalog](https://data.gov.ro/dataset?organization=onrc&res_format=csv) and an independent [source index linking straight to the official files](https://firmedb.ro/surse). However, the host's actual CKAN `package_show` response, the underlying CSV bytes, SHA-256 and the specific publisher-verified licence **have not been retrieved**; direct page/API requests timed out or failed. The versioned [source-access record](../services/worker/data/netro1_3b_onrc_source_access_20261105.json) records the exact IDs/URLs, evidence scope and continuing holds. A source-index CC BY 4.0 statement is a **licence hint**, not the actual publisher's distribution approval.

**Outcome:** zero official ONRC rows processed, zero actual ONRC snapshot matches, zero current ONRC live verifications, zero source-rights clearances, zero eligible companies and zero imports. No claims that 50 sites have become 50 legally verified Romanian companies.

## Current implementation

- `services/worker/scripts/netro1_3b_onrc_snapshot_reconcile.py`: stdlib-only, streaming local CSV reader. Designed for ONRC's caret-separated CSV files with UTF-8 BOM, given an **operator-supplied** CKAN `package_show` JSON document.
- `services/worker/tests/test_netro1_3b_onrc_snapshot_reconcile.py`: synthetic test cases for Romanised/diacritic legal names, CUI and corporate-name agreement, former-vs-current-name handling, ambiguous multi-CUI/company matches, mismatched CUI, official package metadata, no natural persons and no import authority.
- Existing `services/worker/scripts/netro1_3_import_readiness.py` remains the independent company-level release gate; an ONRC snapshot match **never automatically sets** `legal_identity_status=onrc_verified` or `source_rights_status=approved_for_public_facts`.

## Exact 2026-10-19 ONRC resources discovered (not downloaded)

| Resource | Official publisher URL | File result |
| --- | --- | --- |
| Dataset | [Firme 19.10.2026](https://data.gov.ro/dataset/firme-19-10-2026) | Exact official listing; page detail timed out |
| `OD_FIRME.CSV` | [Company identities](https://data.gov.ro/dataset/1962670f-acda-41b5-b52c-c430d7a1ef5e/resource/361e52e3-4590-40af-ae0f-8a15089fc927/download/od_firme.csv) | Direct CSV URL known; not downloaded |
| `OD_STARE_FIRMA.CSV` | [Status code relations](https://data.gov.ro/dataset/1962670f-acda-41b5-b52c-c430d7a1ef5e/resource/0689b858-8371-44ec-bc2f-0fc6e5ae2fcc/download/od_stare_firma.csv) | Direct CSV URL known; request timed out |
| Nomenclature | [Nomenclatoare 19.10.2026](https://data.gov.ro/dataset/nomenclatoare-19-10-2026) | Exact official listing; page detail timed out |
| `N_STARE_FIRMA.CSV` | [Status-code descriptions](https://data.gov.ro/dataset/7729250c-f03a-45d5-b2de-df015340b619/resource/eb45f5fd-b2c5-4ed2-876d-2d6f92ed6922/download/n_stare_firma.csv) | Direct CSV URL known; not downloaded |

Company package ID: `1962670f-acda-41b5-b52c-c430d7a1ef5e`. Nomenclature package ID: `7729250c-f03a-45d5-b2de-df015340b619`. These are evidence-based URL identifiers, **not an authenticated `package_show` result**, and neither package licence nor file checksum is approved yet.

The parser now **pins** the company package and exact file resource UUIDs. Tests reject substituted editions. The third status-code nomenclature must be obtained to interpret status safely; an unexplained status code must remain unverified, not active.

## Controlled source acquisition

1. Retrieve **official** CKAN metadata for the ONRC package dated **19.10.2026** at [data.gov.ro ONRC catalog](https://data.gov.ro/dataset?res_format=csv&organization=onrc) or its [CKAN package search](https://data.gov.ro/api/3/action/package_search?q=19.10.2026). Choose exactly one package whose publisher/organization is ONRC and whose title names the October 19 snapshot. Do **not** substitute July/September data or rely on snippets; date is the dataset **coverage date**, not a live registry check.
2. Query official CKAN `package_show?id=EXACT_ID_FROM_PACKAGE_SEARCH` and save the **actual returned JSON** as a local file `/secure/onrc/package_show_20261019.json`. Ensure `success=true`, organization `onrc`, exact date, licence `CC-BY-4.0`, and the two resources `OD_FIRME.CSV` and `OD_STARE_FIRMA.CSV` with their actual `data.gov.ro` HTTPS links. Do not guess IDs or resource URLs. Check attribution/commercial reuse conditions for the specific distribution and document reviewer approval independently.
3. Download those two actual ONRC files **to a private location outside Git** using only their publisher-supplied links. Record origin URL, date, file size and independent SHA-256. Never ingest `OD_REPREZENTANTI_LEGALI`, `OD_REPREZENTANTI_IF`, raw PFA/individual records or contact information. Do not commit/download into public assets, frontend, Notion or Supabase.
4. Run **offline, read-only**:
   ```bash
   python services/worker/scripts/netro1_3b_onrc_snapshot_reconcile.py \
     --package-json /secure/onrc/package_show_20261019.json \
     --firms /secure/onrc/OD_FIRME.CSV \
     --status /secure/onrc/OD_STARE_FIRMA.CSV \
     --output /secure/onrc/netro1_3b_first50_reconciliation.json

   python -m pytest -q services/worker/tests/test_netro1_3b_onrc_snapshot_reconcile.py
   ```
5. The output is a **non-public review report** containing only minimal company identity fields: CUI, registered name, trade-register code, internal join key and state code. The script reads all rows streaming but outputs **no person records, addresses, representatives, contacts, financial data or prices**. Corporate PFA/non-company input rows are discarded.
6. The script handles exact CUI, explicit current/legal alias and exact normalized names; it does **not** auto-accept fuzzy names. A CUI matched to a different registered name is `cui_match_legal_rename_review`; a differing CUI is `cui_conflicts_with_name_match`; more than one candidate or corporate row for the same CUI becomes `cross_candidate_duplicate_cui_hold`; multiple plausible entries become `ambiguous_multiple_registry_rows`. Unknown/uncoded statuses are **not automatically active**; raw codes require independent `N_STARE_FIRMA` decoding and live ONRC check.
7. Review the matched corporate identity with ONRC current data, its legal form/activity and the legal entity/facility/group tree; cross-check the six Network catalogs by legal CUI, registered name, alias and source domain. Provisional catalog presence and explicit opt-out requests must also be reconciled; an absent suppression record is not permission to publish.
8. Independent source-rights and legal identity reviewers (different persons), with dated evidence and a recorded publisher licence decision, must separately accept each company. `CC-BY-4.0` publisher registry data would allow suitable reuse with attribution **only if verified for the used distribution**; it does not license text, images or product tables from all 50 independent company sites.
9. Only if the independent read-only readiness gate finds **50–100 distinct RO CUIs approved**, specify and review a new country/CUI-aware, all-or-none and trader-capable service-role import RPC. Rehearse an isolated `ROLLBACK` before any **separately approved** import, and perform independent production readback. The old Italian `netgrowth3d_stage_industrial` RPC must **not** be used for Romanian traders or cross-border subsidiaries.

## Technical and legal caveats

- The local `package_show` JSON, even if structurally valid, is *operator supplied*; parser validation is not independent proof of authenticated provenance. Record actual official retrieval evidence, date, licence and file hashes during source review.
- ONRC exports are **historical snapshots**. A match proves only what that file contained at its reference date, not that a company is active on the day of import. A separate current ONRC check and corporate-status decoding is necessary.
- Company CUI is a Romanian business identifier, **not automatically a VAT-status verification**. Do not conflate group websites, legal entities and individual factories.
- Name aliases such as `thyssenkrupp Materials Romania` → `tk accelis Materials Romania SRL` should be keyed by **CUI 18992475**, not counted twice. CUI remains **unverified** against the inaccessible official snapshot at this stage.
- A site having a product catalog does not prove production, stock, material grade, EN 10219 certification or permission to repost product descriptions. These require separate review.
- Avoid any automated communication to 50 companies or their employees until independently approved policy/consent gates.

## Acceptance checklist

- [x] 50 candidate domain research manifest remains read-only.
- [x] CLI streaming reconciliation implemented and synthetic tests supplied.
- [x] Official catalog presence observed via EU catalog; access failures documented.
- [x] Exact government dataset and three CSV URL paths identified via linked source index (not data downloads).
- [ ] Actual official CKAN `package_show`, publisher licence and matching resource UUIDs retrieved and authenticated.
- [ ] Real OD_FIRME / OD_STARE and N_STARE files downloaded privately, hashes recorded.
- [ ] 50 corporate candidates reconciled against real ONRC snapshot.
- [ ] Status semantics decoded, company group/alias/independent CUI identities accepted.
- [ ] Source rights/opt-out and technical roles accepted by independent reviewers.
- [ ] 50–100 genuinely eligible RO legal entities.
- [ ] Future protected RPC design, rollback rehearsal, independent readback and mobile/desktop Network QA.

**Status: RESOURCE URL DISCOVERED, OFFICIAL BYTES/METADATA STILL BLOCKED — no legal approval, no production import.**
