# NET-FAST1 — Discover first, confirm later (16 October 2026)

## Founder decision
Network density is the priority. Research-found companies should appear as **"Scoperta dal Network · Da confermare"**, without a per-company platform moderation step. Being listed is NOT verification, supplier status, buyer activity or company endorsement. Source and correction channel stay visible.

## Delivered
- New **dynamic read overlay** `private.netfast_discovered_records`: de-duplicates by canonical company domain and excludes already published canonical companies, rejected candidate domains, and risk cases.
- Includes NET-COV2A/NET-COV1 research leads (company name, normalized site URL and *proposed* role, no copied website description); they appear automatically when recorded, no further approval queue.
- Also includes clean, previously source/governance-approved discovery candidates without PII, quality flags, identity matches, duplicates or unapproved source rights. Rejected candidates never reappear.
- Access continues through `netux11_require_active_company`: only authenticated active-company Free members. No direct or anonymous reads on private source tables. No changes to PA1.3 Pro boundary.
- Network Free directory combines established profiles and unconfirmed discoveries, counts them separately and visibly badges each unconfirmed item. Individual unconfirmed profile displays site/source, indicated (not verified) category and link for correction/removal via `/company-data`.
- No new canonical `network_companies` publication. No personal emails/phones or Company Memory. No invented region/city/claim.
- As soon as a matching canonical company is published, the provisional card automatically disappears, without manual merging.

## Metrics
Record **published canonical count** and **unconfirmed discovered count** separately. The visible combined directory count is not the number of verified companies. Known pre-release baseline: 31 canonical published, 10 NET-COV1 first-party prospects, 41 pending crawler candidates (mostly duplicates/review cases). Eligibility/dedupe determines actual additional visible count; verify live after migration, do not claim all 41 are eligible.

## Rights and risk
Publishing company name, business website URL and tentative sector classification is distinct from copying protected directory collections or website prose. Continue respecting per-source reuse rights, database rights, first-party/CC0 license bounds and existing robots/worker gates. This release does not authorize high-volume third-party scraping. Correct/removal requests should be acted on through the existing company-data governance channel; rejected/hidden records must be suppressed. GDPR and small-business personal-name edge cases require continuing care.

## Next
- NET-FAST2: automatic replenishment from actually licensed machine-readable source data, worker batching and dedup (no manual per-company approval), geo enrichment with evidence, and verified claim on top.
- NET-FAST3: high-volume performance, pagination, source-specific opt-out/suppression, provenance display and SEO only for properly cleared records.

## Acceptance
SQL security smoke, frontend contract, P0 required CI, production schema, clean live counts, merge and Vercel. Check that Free members see unconfirmed records and anonymous visitors do not.
