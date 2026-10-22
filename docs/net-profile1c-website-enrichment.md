# NET-PROFILE1C — Website enrichment contract

First deliverable: evidence storage and trust boundaries for automatic discovery enrichment.

* **Source:** official organization website when accessible; do not bypass site controls, robots requirements, rate limits, or terms. Track source URL, excerpt, fetch time and extractor version.
* **Fields:** description, product and service taxonomy, industry, and explicit geographic facts. Do not infer tube consumption, certified capacities, verified customer status, ownership or registration.
* **Status:** candidate until governed promotion; accepted only after corroboration appropriate to the field. A confident AI extraction is not a verified company declaration.
* **Safety:** no arbitrary scraping endpoints exposed to client; protect against SSRF in a worker, block internal/private IPs and redirects to them; bound URL, response size, pages, timeout and concurrency.
* **Records:** one of canonical_company_id or discovered_record_id per evidence entry. Provisional and published profiles may look identical to viewers but their database lifecycle remains separate.
* **Display follow-up:** provide a unified company profile showing available evidence with its source; claim is a secondary action; meaningful connection requires an active eligible recipient. No fabricated outreach.
* **Rollout:** first validate on a small sample with official websites, quality checks and deduplication, then scale across the Network using a queue with retries and crawl budgets.

This migration creates *only an internal candidate table*: it does not automatically publish descriptions or start a crawler.