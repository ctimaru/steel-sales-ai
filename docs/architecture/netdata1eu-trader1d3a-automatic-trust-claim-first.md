# TRADER1D.3A — Automatic Source Quality & Company Claim-First

**20 October 2026 — strategic correction requested by founder.** No manual platform-by-platform company verification or per-company admin approval queue is a growth prerequisite.

## Product principle

1. **Discovery automatically.** Acquire minimal company identity data, domain, sector/tube product signals and geographically sourced facts from lawful and reusable data sources. Keep source URL, date, method and provenance for every field.
2. **Automatic, auditable quality.** HTTP/source reachability, company/domain normalization, duplicate/branch collision detection, steel relevance, role consistency, geolocation evidence and source-reuse authorization are distinct checks. Do not disguise an inferred market as legal domicile or a source URL as ownership/permission.
3. **Progressive exposure.** Only publish fields for which there is a lawful reuse basis, sufficient provenance, domain/company reconciliation and no unresolved identity conflict. No automatic "legally verified company", "licensed data", facility/stock or supplier readiness badge based merely on crawled text.
4. **Company-claimed profile.** Public profiles (after eligible publication) offer **Rivendica profilo**. A confirmed company email associated with one unambiguous domain can already yield an automatic ownership proof via the existing HP5 flow. Any ambiguous domain/organization ownership must require stronger proof or remain pending — never silently assign editing rights.
5. **Companies maintain their data.** After ownership proof and authorization, company administrators can edit descriptions, products, contact details, certifications, facilities and permissions through their company workspace. Track verified-ownership separately from source-derived content confidence and legal "verification".
6. **Rights are not a human review queue.** Automated assessment from explicit source license/permission records; **not_assessed** blocks redistribution. If a license isn't machine-verifiable, use approved alternate sources, first-party opt-in/claim-supplied information, or hold that field. No hidden human approval loop at platform scale.

## Scope shipped in TRADER1D.3A

- Reuse existing superadmin-only private RPC trader1d2_superadmin_queue as a source inspection feed. No new migration pending issue #780 migration-version reconciliation.
- Rename Platform navigation and display from "Verifica commercianti UE" to **Qualità automatica UE**.
- Show deterministic **presence / completeness** signals for HTTPS same-domain role and product evidence, explicit legal identity metadata and cited locations. These signals use *existing records*, not live fetching. Never label as verified companies.
- Show domain/identity holds and source-rights gate as independent blockers. No bulk automatic publication is implemented by this read-only UI.
- Remove manual per-dimension review form from UI. Disable old server action on invocation so cached clients cannot write manual acceptances. Keep private append-only historical ledger for audit; no mutation of public companies/facilities/owner entitlements.
- Keep public claim entry /network/start and company claim route /network/[id]/claim only for published profiles. Do not pass a private research UUID to a public-company claim form.

## Next execution blocks (must be independently verified)

### TRADER1D.3B — Automated Source Trust Refresh
- Deterministic bounded source refresh worker: canonical URL, HTTP status/reachability, refresh timestamp, license registry, respect restricted sites and rate limits.
- Attribution/provenance, rights grant and industry-content evidence distinct; compare conflicts, flag stale sources; no unsupported confidence percent.
- Idempotent ingestion and retries; monitor source changes and batch errors.

### TRADER1D.3C — Governed Automatic Company Promotion
- Only eligible, rights-cleared **field subsets** enter public Network; exact-domain and group collision safety.
- Never copy third-party written descriptions/images/catalogue wholesale; publish minimal factual metadata only on justified grounds.
- Idempotency, audit log, suppression/opt-out, attribution and claim handoff. Never force a legal-company verification badge.
- Acceptance: pre/post public counts, no duplicate companies, no takeover, no private price/RFQ exposure.

### TRADER1D.3D — Claim-First Self-Service Quality
- Existing claim proof: verified corporate email + unique company/domain linkage may be automated. Where insufficient, hold/request stronger, independently checkable proof; no routine platform staff approval.
- Permissioned company editing and audit trail; owner-supplied fields override source facts in the correct scope, trust labels are not self-asserted.
- Alerts on source/profile drift and company-initiated corrections.

## Existing infrastructure and open checks

- EU private research: 60 dossiers / 29 observed locations, zero manual acceptances and zero source reuse approvals; previously observed published canonical count 32.
- Supabase seven migrations applied 2026-10-20; generated ledger timestamps differ from committed filenames. Reconcile with a reviewed official Supabase repair workflow before any further db push ([issue #780](https://github.com/ctimaru/steel-sales-ai/issues/780)).
- Browser authenticated acceptance, mobile/keyboard and required CI are release gates.
- Historic TRADER1D.1/D.2 manual approval ledger/code remains for audit compatibility, not current product policy. Backend decommissioning needs a separate security-reviewed migration.

**Supersedes proposed human-controlled TRADER1D.3 publication gate.** Human participation is reserved for companies claiming and managing their own profiles, not centralized verification of every discovered firm.
