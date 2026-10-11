# CRAWL-IT6.1 acceptance

Reviewer with `discovery.read` may view pending geo evidence and original source links. Only `discovery.governance_review` may make a reviewed decision, which requires a 12+ character note. Double review is forbidden by row lock and status guard.

The approval state is `approved_for_facility_review`, not `published`. No public company or facility modification is performed.

QA gates: HP13 definer audit, SEC1 anonymous API compatibility, frontend tests/build, SQL foundation migration and RLS. No geodata added or public profile modified in this release.
