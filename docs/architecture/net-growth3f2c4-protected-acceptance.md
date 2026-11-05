# NET-GROWTH3.F.2C.4 — Official Visure, Rights Sign-off & Final Import-Ready Cohort

**2026-11-05 outcome: acceptance process implemented; final release NOT achieved.** Live Supabase baseline: 278 published canonical + 408 provisional = 686, no F imports. No official Visura acquired, legal counsel sign-off, protected merge, RPC, ROLLBACK or COMMIT performed.

## What is ready
- **50-company prioritized procurement queue:** 13 P1 identity matched to GLEIF/InfoCamere via VAT; 14 P2 company-site VAT-only; 23 P3 no VAT (first find official entity). Two branded/legal-owner holds retained outside 50.
- **67 claim-level review items** across all 52 profiles (65 original claims + 2 replacement claims). F.2C.1 corrections are applied to the candidate review URL for Euroflex, OCSA, SGM, Teknolaser; original URL preserved for audit. Still **zero technical claims approved**.
- **GLEIF source rights clarified:** official [GLEIF LEI Data Terms](https://www.gleif.org/en/meta/lei-data-terms-of-use) expressly license its LEI reference data under **CC0 1.0**. This does NOT grant rights to third-party company catalog text/photos or authorize buyer-supplier verification. Only GLEIF-source rights can be treated as grounded.
- **Per-company Visura + rights packet** with private evidence handles/hashes, issuer/reviewer signoffs, official legal identifier/status, group aliases, approved industry role, claim citations, privacy and opt-out controls.
- Offline **fail-closed** validator with no database credentials, no write functions and tests that show changing an approval flag cannot skip missing Visura and counsel evidence.

## Release decision
| Stage | Real status |
|---|---|
| Research candidates | 50 in scope + 2 quarantined |
| Documented official current visure | **0/50** |
| Independent role/claims signoff | **0/50** |
| Per-company business-web rights/privacy signoff | **0/50** |
| Source-specific GLEIF CC0 rights for 13 exact matched | **Documented source license** |
| Eligible final companies | **0/50** |
| Importable RPC manifest | **NOT GENERATED** |
| Final live six-register + ownership/VAT/opt-out preflight | **NOT performed on approved manifest** |
| Protected CI and merges | **OPEN** |
| Service-role transactional RPC with ROLLBACK | **NOT RUN** |
| Production commit | **NO** |

### Important limits
Current first-party VAT and LEI matching are reliable leads; absence of an LEI does NOT mean a legal company is inactive. Current Visura from [InfoCamere](https://registroimprese.infocamere.it/area-utente) is requested to validate the live registration/role and resolve brand vs operator. GLEIF CC0 license answers only one segment of the rights problem. Purchased Visure should be held in controlled private evidence storage, not committed to GitHub.

**Next decision:** acquire or supply official company registry extracts for the 50, obtain external reviewer legal/data-rights and technical signoffs, and only then run the protected final six-register/VAT/alias/opt-out preflight. The atomic service-role RPC ROLLBACK and subsequent COMMIT require distinct authorization.

Tracking [issue #1139](https://github.com/ctimaru/steel-sales-ai/issues/1139) · [Notion](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304). PR chain #1140 → #1141 → #1143 → #1144 → #1145 → #1146 → #1147 → F.2C.4.
