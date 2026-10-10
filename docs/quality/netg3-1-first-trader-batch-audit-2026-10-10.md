# NETG3.1 — First trader batch, production preflight
Snapshot 2026-10-10; eight pending Italian Discovery candidates with role `trader_distributor`. Read-only checks. **No candidate was approved, rejected, published or mutated.**

## Outcome: 0 net-new publication prospects in this batch
All 8 have `match_signals=["website_domain_exact"]` pointing to an existing active, published and unclaimed Network company with the same canonical domain. Every run and candidate is `governance_status=unreviewed`; source terms are `not_checked`, database rights `not_assessed`. All eight remain `pending_review`.

| Candidate | Domain | Existing company | Match disposition for human review |
|---|---|---|---|
| Commercio Tubi S.r.l. (two candidates) | commerciotubi.it | Commercio Tubi S.r.l. | Potential duplicate existing ×2 |
| Copromet S.r.l. | copromet.it | Copromet S.r.l. | Potential duplicate existing |
| Ferro Tubi S.p.A. (two candidates) | ferrotubi.com | Ferro Tubi S.p.A. | Potential duplicate existing ×2 |
| Ecor S.p.A. | ecor.com | Ecor S.p.A. | Potential duplicate existing |
| Tecnica Tre S.r.l. | tecnicatre.it | Tecnica Tre S.r.l. | Potential duplicate existing |
| Tenaris | tenaris.com | Dalmine S.p.A. | **Identity ambiguity**: same website domain but differing company legal names; do NOT auto-merge or label as proven duplicate. Research legal entity / group relationship |

## Evidence and rules
- All 8 match existing Network records by website domain, **not necessarily legal identity**. Do not silently publish new profiles, link corporate identities or enrich existing data.
- Two candidates repeat Commercio Tubi and two repeat Ferro Tubi across different runs.
- The seven non-Tenaris candidates have matching company names and domains; still require manual confirm.
- The Tenaris/Dalmine cross-name match warrants explicit human identity resolution, not automatic duplicate marking.
- `personal_data_detected=false` is only an unchecked candidate flag, not legal sign-off.
- The two runs in scope (`ca6ad0ea-f8c8-46aa-87d0-e0401aeb9b52`, `ab73b387-69c6-4f40-a73d-4ccc5da2c883`) are both unreviewed, so source terms and database rights need assessment first.
- Use the existing `/platform/company-discovery/governance` and `/platform/company-discovery` surfaces, with scoped `discovery.governance_review` / `discovery.review` permissions.
- Do not approve a source without actual terms and database-rights evidence. An evidence gap is a blocked state, not implicit approval.

## Follow-on tasks
1. Record source-specific legal, database and personal-data evidence for both runs.
2. Review the seven same-name/same-domain candidates as potential duplicate-existing, with a concrete matched-profile reference and an audit note.
3. Escalate Tenaris/Dalmine to manual identity resolution; ensure group/brand/entity distinctions are not collapsed.
4. Revise supplier acquisition KPI: **0 net-new companies from Batch A**, not +8. Re-evaluate next candidate tranche for truly unmatched trader profiles.
5. Separately initiate buyer-side discovery, since there are 0 pending end-user candidates.
