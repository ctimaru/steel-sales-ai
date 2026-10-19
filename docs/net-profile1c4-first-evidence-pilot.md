# NET-PROFILE1C.4 — First real source-evidence pilot

Date: 2026-10-19 (Europe/Rome).

**Result:** 3 real discovered-company records and 6 sourced candidate evidence rows were inserted into production `private.network_company_enrichment` after the NET-PROFILE1C.3 migration. Confirmed by SQL counts: `count(*)=6`, `count(distinct discovered_record_id)=3` for `extractor_version='operator-source-pilot-v1'`.

| Company | Discovered UUID | Official evidence pages | Candidate fields |
|---|---|---|---|
| COPAL S.r.l. | fe6bbfbf-5472-45a7-a7f9-3d686b14b5d0 | https://www.copal.it/l-azienda | description, industry |
| Coferinox S.r.l. | 7b024fb4-3abf-42d0-babc-a3399108c56b | https://www.coferinox.it/ | description, products |
| METALTUBI S.r.l. | e5925d89-4d57-4ca4-95a4-58f241b105e4 | https://metaltubi.it/ | description, products |

**Methodology:** controlled review of genuine public official-site pages, with concise operator-authored candidate summaries/terms. These six rows were inserted by an authorized database operation, **not** by invoking the deployed website-extraction CLI. Do not count this pilot as a successfully deployed, unattended crawler or as an end-to-end test of the service-role RPC. The CLI remains opt-in and needs a worker-runtime acceptance with its own service role credentials.

**Safety:** rows have `review_status=candidate`, `confidence=null`, original evidence URLs and excerpts, and do not affect the public Network profiles. No personal contacts were collected. No memberships, claims, verifications or connection requests were generated.

**Next steps:** merge the verified worker/persistence contract, run a worker-initiated end-to-end RPC test in its authorized runtime, implement governed candidate-to-public promotion, then scale by measured source coverage and budget.
