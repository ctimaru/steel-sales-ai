# NET-UX EUROPE1E — European Conversational Geographic Discovery

## Product goal
A user may ask in IT/EN/FR/DE/ES for a company role, published technical product and EU territorial region. The AI produces **only navigation filters**; the Free/Pro backend continues to determine real results and counts. No inferred operator, transaction, facility or RFQ dispatch.

## Contract
- Server action loads the existing NUTS 2024 catalog (27 EU countries) + existing IT administrative and published technical taxonomy.
- Deterministic interpreter recognizes supported official names and curated cross-language aliases (e.g. Bavaria/Baviera→DE2, Île-de-France→FR10, Poland/Polonia→PL). Foreign region establishes its country only if unambiguous.
- Country change discards previous foreign/Italian region; an explicit region follow-up preserves previous role/product and changes country if appropriate. Exact region codes used in the resulting URL.
- AI JSON schema remains strict (nine fields, no requested counts or company names); country and NUTS code are verified against the official catalog and the user's explicit criteria; unsupported constraints fail closed.
- Published-company regional query still uses EUROPE1C RPC with active-organization/Pro guard; unmapped territories may yield zero published mapped facilities, never interpreted as no industrial firms.
- DATA1B.4 steel evidence ranking remains IT-only; foreign tube queries use actual `tubes_pipes` published filter if available and do not fall back to Italian evidence.
- Input bound 400 chars, opt-in voice only, capped AI budget and existing RFQ review bridge remain unchanged.
- No SQL migration, organization permissions, activity event logging, LLM-generated operators, prices or mailing.

## Acceptance
- Unit tests for 27-country acceptance, DE2/FR10, wrong-country conflict, ambiguous geography, follow-up and previous-state validation.
- P0 frontend tests/typecheck/build, UI-SYSTEM2 contrast, optional PERF2.1.
- Production commit-aligned Vercel READY.
- Authenticated browser Free/Pro QA not claimed complete without signed-in session.
