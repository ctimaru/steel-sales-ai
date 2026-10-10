# CRAWL-IT3.2 — Integration Acceptance

Integrated branch combines geographic extraction, source governance, approved-source discovery and human-reviewed lead intake.

## Acceptance gates
- Country scope is IT only.
- Railway harvester defaults to off (`CRAWL_IT3_ENABLED=false`).
- Source permissions, reuse rights, database-rights evidence and privacy policy must be reviewed before enabling.
- Discovered domains are staged, never published directly.
- Human-reviewed leads only can enter company extraction; Network publication requires separate candidate governance.
- Dedup: existing Network domain blocks lead acceptance.
- Preserve source URL for geographic evidence; no region inference from province alone.
- Checks must pass on the single integrated PR before deploying.

No production scan or data mutation is authorized by this document.
