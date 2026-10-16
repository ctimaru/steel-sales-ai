# NET-UX3B.1 — Controlled Evidence Approval & First Regional Publication

## Actual production state (2026-10-16)
- **31** published Italian Network companies. **3** have published Italian regions; **28** still need mapping.
- **8** screened first-party company geographic evidence candidates exist, all matched to current 2026 ISTAT city/province/region.
- Status before this release: **7 pending_review, 1 conflict (DAMATEK), 0 approved, 0 publication**. A recorded note reading "approvato..." does **not** override the actual decision `conflict`.
- Approval **cannot** be attributed to the superadmin by using database service credentials or fabricated JWT claims. Authenticated review and separate publication must be carried out using the real Platform account/session.

## Source audit (second source check)
- Alessio Tubi — [Official contact](https://alessiotubi.it/it/contatti/), La Loggia (TO); check that the address is under Alessio Tubi, not one of the unrelated group members listed on same page.
- BM Laser — [Official contact](https://www.bmlaser.com/contattaci/), Ciriè (TO), legal name B.M. Laser Srl present.
- BST Tubi — [Official first-party PDF](https://www.bsttubi.it/wp-content/uploads/2022/12/CODIFICA-MATERIALI-IMBALLO.pdf), Carpenedolo (BS), operational management/plant; **legal seat is Mantova**. Publish only a Carpenedolo site; never label it legal headquarters.
- DAMATEK — [Official contact](https://damatek.eu/contatti/), Airasca (TO), explicitly `Sede operativa`; currently in `conflict`, requires the user to reopen then review.
- Giulipas — [Official contact](https://www.giulipas.it/contatti-curvatura-piegatura-metalli-brescia-milano-costi-lavorazione-metalli/), Lumezzane (BS), address explicit; replaces generic homepage citation.
- Padana Tubi — [Official contact](https://www.padanatubi.it/contatti/), Guastalla (RE), legal entity and registered site explicit; replaces an unreachable old PDF.
- Tubi S.p.A. — [Official certificate PDF](https://www.tubi-spa.com/wp-content/uploads/2024/05/IQNET_2024-05-31-2G39.pdf), Cittaducale (RI), Tubi Spa identity confirmed. Certificate validity until 2027-05-31 does not by itself certify the geographic Network profile.
- Tubilaser — [Official contact](https://www.tubilaser.com/contatti/), Istrana (TV), Tubilaser S.r.l. clearly identified.

## Executed technical changes
1. Replace only two `pending_review` evidence source URLs (Padana Tubi and Giulipas) with verified first-party contact pages, keeping the original URL and text in the RLS-protected, append-only `network_it_geo_source_recheck_ledger`. No approve/publish mutation.
2. Platform review selector now has a **required empty placeholder** rather than `conflict` as the implicit default.
3. Add `netux3b1_conflicts_queue` and authenticated, RBAC-protected `netux3b1_reopen_conflict` with append-only provenance of the prior decision. Reopening restores `pending_review`; it is never an approval and never publishes a facility.
4. Preserve the existing `crawl_it61_review_geo_evidence` first human review, and `netux3_publish_reviewed_geo` second human publication decision and ledger.

## User acceptance in the authenticated Platform console
1. Open [Geo Review](https://www.smartsteelsales.com/platform/company-discovery/geo-review).
2. Under `Evidenze in conflitto`, inspect DAMATEK source, then **reopen** only if the recorded `conflict` was indeed an error. Enter a new meaningful note; prior decision is retained in the ledger.
3. For each of the 8 candidates, open the exact official source, check the correct company, correct operational/legal-site type, city, province and matching ISTAT. Select `Approva per revisione sede` explicitly and save the first review note. Reject true conflicts.
4. In `Pubblicazione sedi approvate`, individually check the evidence and enter a distinct publication note to create the published `unverified` facility. Only these published facilities affect the Network map.
5. Verify Free/Pro regional filters and per-region count. If all 8 succeed, **3→11** mapped profiles and **28→20** unlocated, subject to live recheck. Never claim these counts before the actual publication ledger and public coverage RPC confirm them.

## Acceptance gates
- [ ] Frontend Node tests / TypeScript / build and Supabase local reset/HP13 CI green.
- [ ] Additive schema and provenance correction migrations applied; direct production read confirms 2 source changes and ledgers, 0 artificial approvals.
- [ ] Positive recovery dry-run with rollback; negative user permission test.
- [ ] PR merge only at CI green; Vercel deploy verified.
- [ ] **Real human reviews and publications** via existing authenticated Platform session; cannot be accomplished via backend impersonation.
