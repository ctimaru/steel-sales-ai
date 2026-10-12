# NETG3 — Governed Network Expansion, execution contract
**2026-10-10 — production Supabase read-only preflight.** No scraping, writes, candidate promotions or approvals were performed.

## Starting point
- **32** active companies, **30** published, **0** with role end_user, **3** companies with structured facilities.
- **43** pending Discovery candidates, all IT: 24 processors; 10 producers; 7 traders; 1 trader+processor; 1 producer+processor; **0 end users**.
- All 43 have recorded identity quality and source URLs; **0** have `personal_data_detected=true` (absence of a flag is **not proof** that no personal data exists).
- **16** Discovery source runs: 9 curated web search, 6 manual URL, 1 other. All have governance unreviewed, terms not_checked, database rights not_assessed.
- Source, claim, and company verification statuses are independent. No candidate may be automatically published merely due to a source URL or identity score.

## Work packages and acceptance criteria
### NETG3.1 — Review-first supplier batches
- **Batch A (up to 8 candidates):** pending Italian traders (7 pure + 1 trader/processor).
- **Batch B (up to 10):** Italian producers; then processors in batches of up to 10.
- Prioritize candidates with grounded identifiers, credible source URLs, sufficient role evidence, and no possible existing-company match.
- For each source run, record evidence of source rights, terms, database-rights status and personal-data policy through existing `discovery.governance_review` RPCs **before** reviewing its candidates.
- Candidate governance decisions through existing UI; do not bypass approved role permissions, claim review, or publication gates.
- Batch acceptance: 100% decisions have reason/evidence; duplicates are linked not republished; no blocked/unreviewed sources are promoted.

### NETG3.2 — Buyer acquisition (net-new discovery)
- Existing pending candidates contain **zero** end users; launch a separate first tranche targeting **10–20 qualified Italian industrial users**, not by relabelling suppliers.
- Prefer business-provided registration, direct outreach, user-submitted profiles, and manually reviewed open company information.
- Do not scrape personal contact data or reuse restricted databases. Review source terms and privacy before collection/publication.
- Record source, role evidence and geographic region only when supported; publish after governance review.

### NETG3.3 — Location and completeness backfill
- Fill geographic region/city and facility where verified sources justify it; baseline **3/32** structured facilities.
- Improve VAT/registration identity fields where lawful and verifiable; distinguish missing from not applicable.
- Add no inferred geographic or identity values; periodically check for normalized-legal-name/domain/VAT duplicates.

### NETG3.4 — Growth readiness gate
- Review by role (buyer, trader, producer, processor), source, territory, and verified vs claimed vs published.
- Targets for pilot planning (not current outcomes): >=10 reviewed buyer profiles; >=8 traders assessed in Batch A; 100% candidate publication decisions gated by approved source + candidate governance; clear RFQ buyer onboarding CTA.
- Defer any large-scale import until legal/source review and QA are complete.

## Operations: reproducible read-only checks
```sql
select coalesce(role_keys::text,'[]'), count(*) as candidates
from public.network_company_discovery_candidates
where review_status='pending_review' and country_code='IT'
group by role_keys order by candidates desc;

select source_type, governance_status, terms_status, database_rights_status, count(*)
from public.network_company_discovery_runs
group by 1,2,3,4 order by 5 desc;

select count(*) filter(where review_status='pending_review') pending,
       count(*) filter(where review_status='published') published,
       count(*) filter(where review_status='duplicate_existing') duplicates
from public.network_company_discovery_candidates;
```

## Safety and costs
No new backend worker, background cron, unapproved web crawling, Vercel builds or database schema changes are part of this contract. Existing governance UI at `/platform/company-discovery/governance` is the operational review surface. Decision owners are scoped platform staff with permissions; final company verification remains a separate trust process.
