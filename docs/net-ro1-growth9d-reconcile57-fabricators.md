# NET-RO1.GROWTH9.D — Romanian metal fabricators: 57 reconciled, 9 first-party profiles

**Date:** 8 Nov 2026. Scope: Smart Steel Sales Network Romania. User prioritizes the widest source-backed carpenteria directory, no automatic visure, no duplicates, and company contact channels governed by LR4.

## Results from the 57 held businesses

- **9** companies with directly found company-controlled websites, location and steel/metal fabrication products/services.
- **48 remain in research**, chiefly unverified exact company website/identity, plus group-domain identities, source-unreachable sites or noncore manufacturing.
- Full 57-line reconciliation file: `services/worker/data/net_ro1_growth9d_reconcile57_20261108.json`.
- Exact source-pinned, optional contacts manifest: `services/worker/data/net_ro1_growth9d_fabricators9_20261108.json`.

### First-wave 9: 8 metalwork processors and 1 open-profile producer

| Region | Company | Role | First-party reference |
| --- | --- | --- | --- |
| Nord-Vest / Cluj | CADRAN INDUSTRIES SRL | Metalwork processor; CNC, welding | https://www.cadranindustries.ro/ |
| Nord-Vest / Bihor | GALEMID SRL | Welded structures and general metal fabrication | https://galemidmetal.ro/contact/ |
| Sud-Est / Galați | ATLAS METALWORK SRL | Structural steel and equipment frames | https://atlasmetalwork.ro/en |
| Sud-Muntenia / Prahova | INDUSTRIAL MONTAJ SA | Industrial construction, structural steel and process piping | https://www.industrial-montaj.ro/ |
| Sud-Muntenia / Prahova | CONFIND SRL | Heavy metal fabrication and industrial systems | https://www.confind.ro/ |
| Nord-Est / Suceava | STRUCT BUCOVINA SRL | Steel building fabrication and erection | https://www.structb.com/ |
| Sud-Muntenia / Prahova | OZEL STEEL PROFIL SRL | **Producer of open galvanized U/C/Z/Sigma profiles**, not proven structural hollow-section tube mill | https://www.ozelsteelprofil.ro/ozel-steel-profil-srl-despre-companie.html |
| București-Ilfov | SKELA INDUSTRIES SRL | Heavy steel frames, bridges and construction structures | https://www.skela.ro/ro/ |
| Sud-Muntenia / Argeș | ARDACO TEHNIC METAL SRL | Metal fabrication and precision/OEM components | https://www.ardacometal.ro/ |

Their descriptions are deliberately conservative; do not infer orders, EU/EN tube grades, welding certificates or owner verification from marketing copy. Industrial Montaj's CUI 1348195 is corroborated by ISCIR and the same company-owned address/domain.

### Not published: high-quality exceptions

- **NEDMETAL (Cristian, Brașov), EDILMET (Râșnov), METABET (Pitești):** legal identity and apparent company websites are in chamber/registry results but company web pages were inaccessible in the current check. Keep in review until a directly accessible first-party product page or another suitably authoritative source is obtained.
- **MOSKAT / QUANTUM:** groups with multiple legal entities and common site; confirm the canonical industrial entity before publication.
- **EMSIL / ZAUNER / MIRAS / DEXION:** separate multinational legal identities/facilities, no duplicated group-domain profile.
- **ALPIN TECH SOLUTIONS:** specializes chiefly in rope-access maintenance, not structural fabrication. Keep lower priority despite incidental metal mounting services.
- Remaining 48 record-specific decisions stored in the reconciliation JSON.

## Protected production plan

1. **No destructive schema or frontend changes**. CI P0 green before merge; any auxiliary FLOW1 issue tracked independently.
2. `supabase/migrations/20261108160000_net_ro1_growth9d_fab9_private_research.sql`: source-pinned 9 new private seeds; expected RO **304 → 313**, public **211** unchanged.
3. `supabase/migrations/20261108161000_net_ro1_growth9d_fab9_publisher.sql`: installs **only** service-role function `private.netro_growth9d_publish_fab9(boolean DEFAULT false)`. Inserting public companies is not triggered by definition.
4. Explicit privileged preview: `SELECT private.netro_growth9d_publish_fab9(false);` must return **9/9 eligible, 0 suppressed, 0 created**, baseline 211/313 and expected **220 public RO**.
5. Explicit owner-authorized atomic publish once: `SELECT private.netro_growth9d_publish_fab9(true);`, only after preview. Readback **220 public and 220 unique domains, 9 wave links, 9 source assertions, 9 role assignments, 9 NUTS2 facilities**, no claim/certification/contact auto publication.
6. Recheck preview `already_published/created_now=0`. Do **not** run the publish-true call again.
7. Stage first-party company-wide inbox/phone channels via NET-CONTACT1 (generic on-domain email or company switchboard numbers only), not direct contact SQL. Use LR4 review, preserving the same approved/held distinctions. A mismatched generic email on a second domain is deliberately not attached.
8. Record owner-verified visual QA separately: country and role filters, company cards, contact fields, claim CTA at 1440/390/320. SQL publication cannot substitute for actual authenticated browser screenshots.

## Business impact

This wave takes Romania to **220 public profiles**, increases the processor population by **8** and adds one manufacturer of *open structural profiles*. **48 held census leads** remain for the next source lookup wave. The contact inbox source list supports gradual additional company contact enrichment; the user or an authorized platform reviewer controls public visibility through NET-CONTACT1, not generic automation.
