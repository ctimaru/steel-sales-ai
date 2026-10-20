# NET-DATA1-EU TRADER1D.1 — Evidence Review & Controlled Activation Readiness
2026-10-20 · **Review framework committed to repository; production activation blocked by issue #771.**

## Scope and principle
The sixty EUROPE1C research dossiers across five migrations are *neither verified companies nor published network facilities*. TRADER1D adds a sixth PRIVATE migration implementing an append-only, human-attributed evidence review ledger and a bounded service-only diagnostic queue. It **does not** write to public companies, locations, classifications, CRM, RFQ, claims or the European map. No auto-crawler, NUTS inference, publisher or user-facing endpoint.

## Review dimensions — one evidence assessment per decision
| Dimension | Accept only when | Typical blocker |
|---|---|---|
| Legal entity | Evidence identifies the legal name **and legal country**; separate parent brand from subsidiary | group-only web source / wrong legal company |
| Trader role | First-party sales/distribution documentation for the actual legal entity, not just manufacturer | producer-only / machine vendor |
| Product evidence | Specific tubes, hollow sections, fittings, pressure pipes etc tied to correct company, without inferring EN/stock levels | inferred grade or unreliable catalog |
| Domain reconciliation | Distinguish shared brand domains, franchise/group subsidiaries and canonical/discovered/lead records | exact-domain collision or group identity |
| Source reuse rights | Written permission/license or open license with explicitly recorded scope **network_profile** or **network_facility** | web page public but reuse unlicensed |
| Facility source | Specific sourced site/address/warehouse and actual company ownership, never geocode from HQ | address is a branch office, not stockyard |

Every manual decision is appended to `private.netdata1eu_trader_review_decisions`, requiring an existing authenticated human reviewer UUID, reason and evidence URL for `accepted`. Identity approvals require legal name/country; rights approval requires explicit permission basis and scope. New entries are not auto-generated: an operator must insert them via an approved privileged workflow. Existing research `source_rights` remains `not_assessed` until separately cleared.

## Queue and release model
- Service-only, security-invoker `private.netdata1eu_trader_review_queue(limit,offset,country)` returns an explicit blockers list, source URL, duplicate-domain collision counts against existing canonical/discovered/lead and research peers, location observations, and the number of dossiers with *complete editorial evidence*.
- `editorial_evidence_ready` requires accepted latest decisions for legal identity, role, products, dedup, rights, plus a publication-eligible rights scope, separately sourced legal fields, `source_rights='license_approved'`, and existing `research_state='ready_for_review'`.
- This status means **ready for independent platform editor review only**. A *later, separately approved* promotion transaction must still go through platform governance, legal terms and tenant isolation. No auto-publication function is present.
- Read scope is all research batches and optionally one EU country, max page size 25 and offset 10,000.
- The decision ledger is RLS-protected, `service_role` SELECT+INSERT only, append-only trigger, zero browser access. No SECURITY DEFINER.
- Expected current production numbers: **no additional companies**. Initial staging tables were absent at readback; all 60 dossier source seeds and 29 private places remain GitHub data until allowed by the authorized deployment path.

## First editorial verification priorities
1. **Royal Van Leeuwen / Van Leeuwen Italia**: `vanleeuwen.com` shared with an Italian discovered and lead; separate Dutch group and Italian legal operating company
2. **Weyland** Austria vs Czech `Weyland Stahlhandel` — different entities, possibly a group
3. **KönigStahl** Poland vs Czech **Königfrankstahl** — group/domain identity checks
4. **thyssenkrupp Materials** Poland vs Nederland, plus earlier German thyssenkrupp Schulte — each legal operating entity, not one profile
5. **Hoberg & Driesch / Pouchard** group vs French subsidiary
6. **MAIRON** distribution and own steel tube manufacturing — review trader and producer roles independently
7. **BE Group** Swedish vs Finnish distribution operations and group domain
8. **MCB, BUHLMANN, STAD** initial high-relevance tube traders: audit exact product/capacity evidence and reuse permission before priority publication

These are **review targets, not accepted reviews**.

## Acceptance
- P0 Required Gate: local Supabase rebuild including migration `20261020201000`, SQL/Node tests, TypeScript, build and security checks.
- Verify no public authenticated/anon read and no public RPC; reviewer ID auditable, updates/deletes disallowed, rights/identity CHECK constraints pass.
- Production blocked by [issue #771](https://github.com/ctimaru/steel-sales-ai/issues/771). Apply six migrations ONLY through the authorized safety-reviewed procedure (five research migrations then this review ledger), then run live service-only readback: **60 private research rows, 29 private location observations, 0 manual acceptances, 0 auto-published entities**, conditional on source facts and successful deployment.
- TRADER1D.2 would design the **superadmin-only visual review console** once secure staging activation is verified; do not ship an empty or misleading UI without backend.
