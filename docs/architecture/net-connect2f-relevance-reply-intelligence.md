# NET-CONNECT2F — Relevance & Reply Intelligence

## User outcome
Make Network discovery explainable and useful: show *why* a contactable company is commercially plausible, measure only decisions on the requesting organization's own inquiries, and offer optional manual follow-up text for an aging pending inquiry.

## Relevance rules
- Keep NET-CONNECT2E canonical published, currently reachable recipient eligibility; Free/Pro have the same contract.
- Rank only the available candidates in the **current results page** using industrial role relevance for the chosen (or owned) persona, with a small tie breaker for at most two **shared publicly declared product families**.
- Shared product family is not proof of a supplier's capacity, customer demand, technical standard coverage, or an actual opportunity. Reasons state exactly which recorded public facts were used.
- Filters, map, total discovery results, original list ordering, and provisional separation are unchanged.

## Private decision intelligence
- Authenticated SEC-DEF RPC netconnect2f_intelligence(org_id,company_ids at most 24) requires an active company and membership.
- Sender-only aggregates of real outbound connections from the last 90 days: sent, accepted, declined; plus pending from at least seven days ago.
- Median time from submission to an accepted/declined decision is displayed only after **at least three** decisions with valid timestamps. No statistics about counterparties' performance are revealed. Decision != message reply.
- UI on network/start and network/connections shows real aggregates or a dash on failed data, not false zero.

## Manual follow-up
- Sent requests still pending after seven days show a **copy-only** draft, intentionally without any transport integration. The user may use existing authorized communication channels but the platform sends nothing, does not queue follow-ups and does not bypass the one-pending-request rule.

## Governance and QA
- No private email/contact details, no per-company response rankings, no invitations to provisional profiles and no automated actions.
- New SQL HP13 allowlist / cross-tenant negative; SQL security contract; frontend regression and P0 required list. Keep CI-green merge and production SQL-first release.
- Real authenticated, two-company end-to-end acceptance remains an explicitly separate requirement from CI.
