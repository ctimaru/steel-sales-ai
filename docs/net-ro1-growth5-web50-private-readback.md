# NET-RO1.GROWTH5 — Romania private web research +50

**Executed 2026-11-05 in production Supabase.** Country RO private web-research count **147 -> 197**. Batch key: `NET-RO1-GROWTH5-WEB50-20261105`. All 50 inserted in two guarded 25-row transactions, without DDL, deployment or public profile promotion.

Independent readback: **50 batch rows, all 50 unclaimed, web-sourced/unverified, not published; 197 unique country research domains and research IDs; 9 live RO public profiles and 9 historical publication crosswalk records unchanged.**

Source provenance is retained in **each private research row** (`source_url`, `research_id`, `display_name`, `source_summary`, `source_kind`, `review_lane`), rather than copying the private database rows to a public source tree. Roles: **37 trader-distributor, 13 processor/service**.

Review lanes: **18 web_profile_review_pending**, **17 retail_industrial_fit_review**, **11 industrial_fit_review**, **4 possible_legal_entity_overlap_hold**. None of the 32 flagged records may be automatically published or considered verified independent legal companies.

Representative public first-party source pages: https://viacon-steel.ro/tevi-din-otel/, https://www.italinox.ro/produse-din-inox/tevi/, https://www.tevi-laminate.ro/produse/, https://steeltube.ro/, https://xpozit.ro/servicii/debitare-laser-teava-profile, https://serviciilaser.ro/debitare-teava-cu-laser/.

Live audit query: `SELECT count(*),count(DISTINCT canonical_domain),count(DISTINCT research_id) FROM private.network_web_research_seeds WHERE country_code='RO';`

**Next:** another 30–50 first-party industrial sources and selectively release reliable public profiles via the separate protected claim workflow. No compulsory paid chamber-of-commerce extracts for initial public website facts.
