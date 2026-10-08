# SP7 — Production Activation & First Licensed-Source Pilot

**8 October 2026 | Supabase production schema installed; public publication remains OFF; no live crawler.**

## Production audit and deployment

- Target: Supabase steel-sales-ai, project ref ecrafjdummcdfycznitx, eu-west-3.
- Before deployment: no steel_pulse_private schema, no SP2–SP6 migration records, four auth accounts, one active Platform Owner, zero Knowledge Editors and zero Knowledge Publishers.
- Supabase MCP applied the complete SP2–SP6 migrations sequentially and reported success for all five.
- After deployment: 5/5 migration records, six initial registry sources, 0 approved sources, 0 ingestion items, 0 editorial cards, 0 individual preference rows, 0 saved/read rows; publication_settings.enabled=false; anonymous SP4 RPC returns []. The browser roles retain no direct private-table access.
- A seventh source (ec_dg_trade) was added to the live source registry with status=candidate, license_basis=unverified, operations empty. This commit declares an idempotent candidate insert for clean CI and future deployments. No approval, ingestion or publication is implied.

### Production migration version reconciliation

| Git migration | Registered production version |
| --- | --- |
| 20261008153000_sp2_steel_pulse_ingestion_foundation.sql | 20261008135525 |
| 20261008165000_sp3_steel_pulse_editorial_publish_gate.sql | 20261008135549 |
| 20261008182000_sp4_steel_pulse_public_feed.sql | 20261008135553 |
| 20261008195000_sp5_steel_pulse_personalized_feed.sql | 20261008135556 |
| 20261008200000_sp6_steel_pulse_engagement_retention.sql | 20261008135600 |

**Operational risk:** Repository timestamp prefixes and MCP-registered production versions differ (older project migrations also differ). Before any automated Supabase db push, reconcile the COMPLETE remote and repository history with a reviewed migration repair plan. Otherwise migrations that are already applied could run twice. Do not rewrite migration history casually or run a blind production push.

## Pilot source: European Commission DG Trade

Source ID: ec_dg_trade
- Official collection: https://policy.trade.ec.europa.eu/news_en
- Official RSS link from that collection: https://policy.trade.ec.europa.eu/node/2/rss_en
- Commission legal notice: https://commission.europa.eu/legal-notice_en
- Decision on Commission information reuse: https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng

The Commission generally licenses Commission-owned web editorial content under CC BY 4.0 unless stated otherwise. Correct credit and disclosure of changes are required. Third-party images, personal likenesses, trademarks and individual copyright notices can require separate authorizations. Attribution must not imply endorsement. A site-wide policy is not by itself an item-specific editorial or legal approval.

The source is deliberately NOT approved. The publication requires source/editor/legal sign-off, robots and feed URL operational verification, and a specific permitted operation. The SP2 worker still has no enabled polling or cron; its documented DNS rebinding risk calls for vetted egress protections before unattended fetching.

## Suggested first original card — PREVIEW ONLY

Original article: https://policy.trade.ec.europa.eu/news/commission-sets-type-evidence-be-provided-importers-prove-country-melt-and-pour-steel-products-2026-08-31_en

Original IT headline: **Acciaio importato nell'UE: prove richieste per il Paese di fusione e colata**

Original IT summary: La Commissione europea ha approvato il 31 agosto 2026 un atto che chiarisce quali documenti possano utilizzare gli importatori per attestare il Paese di fusione e colata dei prodotti siderurgici interessati dal regolamento UE. Lo scopo dichiarato è rafforzare tracciabilità e verifiche nel mercato europeo.

Original business relevance: Le imprese che importano, acquistano o commercializzano tubi e profili dovrebbero accertare quali categorie merceologiche siano effettivamente comprese nelle misure e quali prove documentali si applichino. Non bisogna presumere che ogni tipo di tubo rientri nello stesso obbligo.

Attribution model: “Fonte: Commissione europea, DG Trade, 31 agosto 2026. Sintesi originale in italiano di Smart Steel Sales; traduzione, selezione e contestualizzazione a cura della redazione. Nessuna affiliazione o approvazione da parte della Commissione.” No Commission images, logos or copied paragraphs. Item-specific factual, copyright and legal approvals remain pending.

## GO / NO-GO requirements

1. **People — BLOCKED.** Production has one Platform Owner and no active Knowledge Editor/Publisher. SP3 prevents self review and requires distinct author, independent fact reviewer and owner legal approver, plus eligible publisher distinct from author/editor. At least two additional real staff users with delegated privileges are needed; invite using the existing SA3/SA7 controls, never fake identities.
2. **Source approval — BLOCKED.** Confirm the original page's copyright and any exception, RSS terms and robots. Record current terms review and the distinct source-rights reviewers as required in SP2. Keep approved_operations empty until that happens.
3. **Ingestion — BLOCKED.** The worker may only start after a source with legal approval, approved discover_metadata scope, robots review and egress controls. Do not activate any schedule in SP7.
4. **Editorial sign-off — BLOCKED.** Stage a metadata-only item, create original copy, independent factual review, owner item-rights sign-off and final publisher decision through SP3 audited transitions.
5. **Global publication — OFF.** Only when there is a valid, tested, approved card should the Platform Owner expressly authorize changing the SP4 kill switch; first test anonymous 3-item output, no private-field leakage, source suspension/withdrawal, and login mobile/desktop.
6. **Rollback.** On a rights incident immediately disable public publication_settings.enabled, suspend affected sources, invoke SP3 withdrawal, verify anonymous feed is empty. Do not drop schema without a backup/restore plan.

## Next microblock

SP7.1 — Authorize two independent editorial operators and finish item-specific licence/robots verification, then SP7.2 — manual first ingestion, editorial approval, audited public go-live and live anonymous/authenticated UX checks. No email or push notifications.
