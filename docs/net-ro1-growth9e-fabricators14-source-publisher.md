# NET-RO1.GROWTH9.E — Romanian fabricators: 14 sourced profiles, 48 held reconciled

Date: 2026-11-08. Founder priority: maximize country-wide source-backed metal fabricator coverage; do not require formal visure for every new directory entry. Publish conservative profiles with no invented EN 10219 supply, tube buying, customer relations, owner verification, certifications, contacts, or RFQ readiness.

## Source and identity reconciliation

- Prior live baseline: **220 public RO company domains / 313 private RO research records**.
- Prior held 48: **7 newly first-party-cleared**, **41 still held** and independently researchable.
- Plus **7 new first-party industrial sources**: **14 candidate net-new domains** after exact public/private domain and normalized-name preflight, with 0 suppressed; AVIROB was excluded because already present in both datasets.
- Primary roles: 12 industrial processors/fabricators, 2 manufacturers of **open metal profiles** (not verified tube mills).
- Domains, source URLs, detailed localities, NUTS2, contact candidates: `services/worker/data/net_ro1_growth9e_fabricators14_20261108.json`.
- All 48 prior leads and their decisions: `services/worker/data/net_ro1_growth9e_reconcile48_20261108.json`. Do not present all 48 as qualified or imported.

## 14-candidate wave (7 prior, 7 new)

| County | Candidate | Official source | Queue |
| --- | --- | --- | --- |
| Bihor | METALISTEEL | https://metalisteel.com/ | prior |
| Iași | MEKONF | https://mekonf.ro/ | prior |
| Iași | EDMARIO SRL | https://edmario.ro/ | prior |
| Brașov | EDILMET SRL | https://edilmet.ro/ | prior |
| Dolj | ASDR CONSTRUCTII SRL | https://www.asdrconstructii.ro/ | prior |
| Sibiu | CONA PRODUCTIONS SRL | https://cona.ro/ | prior |
| Arad | PROFILE GALVANIZATE SRL | https://profilegalvanizate.ro/ | prior |
| Mureș | PROELCONS SRL | https://www.proelcons.ro/ | new |
| Mureș | PRIMEX MURES SRL | https://www.primexmures.ro/ro | new |
| Bacău | SUDOMETAL | https://www.sudometal.com/despre-noi/ | new |
| Mehedinți | SERV REPARATII DIV SRL | https://srd-severin.ro/ | new |
| Bacău | MISAN SRL | https://www.misan.ro/servicii | new |
| Mureș | IMGP STAHLBAU | https://www.imgp-sb.ro/ | new |
| Cluj | PRONIF PROFILE SRL (Profin) | https://www.profin.ro/ | new |

CONA is anchored to **CONA Productions** with the Mârșa factory; do not add a second company profile under the same parent domain without explicit legal/facility identity reconciliation. PROFILE GALVANIZATE and PRONIF PROFILE are suppliers of *open* profiles/structural elements; no automatic closed tube mill tag. Website claims are unverified until owner claim and review.

## Protected release sequence

1. Require P0 protected CI **green** on latest branch head and protected squash merge to main. FLOW1 auxiliary status is tracked separately. No Vercel UI changes/deploy triggered by SQL-only release.
2. Apply `20261108170000_net_ro1_growth9e_fab14_private_research.sql` only once, expecting RO private 313→327 and public remain 220. The DO block is atomic and fails closed for duplicate/suppressed identities or drift.
3. Apply **definition-only** `20261108171000_net_ro1_growth9e_fab14_publisher.sql`; does not publish on creation.
4. Privileged read-only `SELECT private.netro_growth9e_publish_fab14(false);` must return exactly 14/14 eligible, 0 suppressed/created, public baseline 220, private baseline 327.
5. Explicitly authorized one-time `SELECT private.netro_growth9e_publish_fab14(true);`, in one transaction only after valid preview. Expect **234 RO public unique-domain profiles** and 14 separate wave links.
6. Independent readback: 234 published/unique domains, 327 private research, 14 wave links, 14 primary role assignments, 14 source assertions, 14 NUTS2 facilities; no automatic claims, verifications, certifications or contact publication. Repreview should say already_published/created_now=0.
7. Candidate corporate phones and same-domain generic inboxes can go only through `netcontact1_stage_company_channel` and LR4/NET-CONTACT1 pending review after first-party source and company channel inspection. Do not stage staff/personal emails or plausible-looking unverified values.
8. Real authenticated 1440/390/320 network visual QA remains a separate check; do not call it done merely from SQL readback.

## Next growth lane

While the 14 are released, research the **41 remaining holds**, excluding misleading groups and non-core facilities; concurrently collect 50–100 more Romanian fabrication candidates across underrepresented counties. Publish only identities with enough web evidence for an accurate minimal card. Owners can later claim and enrich profiles.
