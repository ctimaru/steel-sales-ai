# NET-GROWTH3.G — Online-First Network Expansion & Owner-Claim Enrichment

**Approved direction (5 Nov 2026):** Stop requiring official Visure as the default gate for initial B2B company discovery. Source minimal factual business metadata on the open web, control duplicates/roles/opt-outs, publish provisionally where the platform's existing review/visibility contracts allow it, and let owners claim and enrich their profiles later. Keep legal/copyright and privacy safeguards; a site or LEI does not imply verified supplier or available stock.

## Actual production execution (not just planning)

Using **already deployed** `public.netgrowth3d_stage_industrial(jsonb, batch)`, executed:
1. Created an exact 50-company dataset from **42** prior first-party research candidates plus **8** newly found tube processors.
2. Excluded 2 ambiguous company brand/operator records (`tcbtubi.it`, `lasermec.it`) and 6 weak/problematic source/role records (`envasald.com`, `emmeerreinox.it`, `t-erre.it`, `fabbroferro.it`, `dematubi.it`, `gromet.it`). Kept them outside this insertion rather than deleting source research.
3. Confirmed each new company first-party HTTPS source and checked absence of exact domains/names against 6 existing registers.
4. Executed a service-role **atomic 50-item ROLLBACK test**: `new_unconfirmed=50`, `duplicates=0`, `invalid=0`, `published=0`.
5. Then committed **the separate production staging transaction** (not canonical publication): batch `NET-GROWTH3D-ONLINE-20261105-A`. RPC returned `new_unconfirmed=50`, `duplicates=0`, `invalid=0`, `published=0`.
6. Independent production readback: `network_core_target_leads` **50/50 needs_review**, 50 unique domains, **9 producers / 41 processors**.
7. Production mirror into `private.netfast_discovered_records`: **50/50 matching domains and roles**; provisional total increased from 408 to **458**. Canonical published unchanged **278**, total directory backing records **736** (previously 686).
8. `private.netfast_free_directory_impl` returns these provisional records to eligible active company workspaces with `claimed_status=unclaimed`, `verification_status=unverified`, `discovery_status=unconfirmed`. This is not a canonical public publication, active availability or a verified business badge. A real user visual check is a separate UX sign-off.

## New researched domains

- [Acciaio T&D](https://www.acciaioted.com/) — steel tube/sheet subcontract laser cutting
- [MEP](https://www.mep-snc.com/azienda/) — precision metal tube processing
- [NobilCut](https://www.nobilcut.it/) — subcontract metal work including tubes
- [Tubi Solution](https://tubisolution.com/it/) — outsourced metallic tube working solutions
- [OEMMEVI](https://oemmevisrl.it/) — subcontract laser tube cutting and fabrication
- [LaserSid](https://lasersid.it/) — laser tube and profiles
- [CR Tubi](https://www.crtubi.com/lavorazioni/) — cut and bend steel/stainless tubes
- [Danasi](https://www.carpenteriadanasi.it/) — laser tube cutting and fabrication

No contact persons, company photos, copied descriptive paragraphs or ungrounded supplier availability were inserted. These URLs are evidence references, not permission to copy site catalogs wholesale.

## Next growth cycle (user's new priority)

1. Source another **50–100 nonduplicated industrial businesses per lot** via first-party websites, official openly licensed lists and specialist directories with permission; iterate traders, producers and processors, then EU. Validate industrial role and don't mistake a brand for a unique legal entity.
2. Promote a claimable company profile through **existing moderation** only when enough reliable source/identity checks are available for an unclaimed/unverified listing; no mandatory paid Visura. Preserve opt-out, provenance and ability to correct/withdraw.
3. Profile UI compact: legal/trading company label, website, **what they do**, source date, clear **“Non rivendicata · Informazioni da fonti pubbliche”**, one **“Rivendica azienda”** action. Owner enriches products/materials/standards/dimensions/capacity only after proof of control; don't infer facts.
4. AI/UX trust labels: `sourced_business` is not `claimed_company` is not `verified_supplier`. Technical facts must be traceable to each source, stock/pricing remain unknown.
5. Monitor **net-new production directory candidates** and **claimed profiles**, not only sites researched. Retain owner opt-out, GDPR and site copyright/database constraints.
6. Keep [#1140–#1148] as historical restricted legal-evidence research; the **Visura gate is no longer a requirement for basic Network acquisition**, and older stacked PRs must not reintroduce that blocking condition into this path.

**No frontend deployment or canonical company publishing occurred.** This independent PR documents the already-real production stage and the new growth/claim-first policy.
