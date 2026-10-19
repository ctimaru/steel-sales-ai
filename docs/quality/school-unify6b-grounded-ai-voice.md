# SCHOOL-UNIFY6B — Governed AI Gateway + Optional Voice
Implementation 2026-10-19. Depends on merged SCHOOL-UNIFY5 #746 and SCHOOL-UNIFY6A #748.

## Outcome
- Real opt-in Vercel AI Gateway synthesis (not mock text), reusing the provider integration already present in Network. No API keys in git.
- Browser sends only recognized technical codes (max 2) and locale to an authenticated server action, never the raw user text. Server independently retrieves at most four published K2 references. Only trimmed public K2 cards and normalized codes are sent to Gateway. No user prompt, customer name, company document, pricing or private workspace memory is transmitted.
- Strict model JSON schema. Reject unknown source IDs, missing K2 evidence, uncertain answers, unverified certification/equivalence/stock claims, invalid JSON, timeout and gateway errors. All links originate from trusted K2 record citations and are selected by the server; never trust a model URL. Human technical review remains mandatory.
- Dedicated SQL migration with private tables, RLS and atomic authenticated SECURITY DEFINER quota RPC. Hard ceiling 3 per-user/day and 30 global/day UTC. No prompts, transcripts or audio stored in quota tables.
- Disabled by default: SCHOOL6B_AI_ENABLED=false and SCHOOL6B_VOICE_ENABLED=false. Requires server-only AI_GATEWAY_API_KEY to synthesize. SCHOOL6B_MODEL defaults to model already used by Network; verify model catalog before changing.
- Browser speech recognition starts only when the user explicitly clicks, only in supported secure browsers. Transcript is editable and is never automatically submitted. Disclose possible external browser speech service. Recognition stops on component unmount/reset.

## Acceptance
1. Both flags off: no AI or microphone, no model call, no usage costs. AI flag on without key remains disabled.
2. RPC missing/quota denied: no Gateway call, public source research still works.
3. Raw prompt contains company/private terms: model receives only normalized codes and K2 published cards.
4. Unknown code, no K2 sources, non-cited answer, unsupported certainty, timeout, invalid schema: safe abstention.
5. Voice permission denied: graceful fallback; manual editable text remains available, no auto-send.
6. Five language UI and browser speech locale; K2 evidence in requested locale only.
7. Authenticated workspace context and independently verified quota, never caller-supplied tenant id.
8. Automated tests + P0 TypeScript/build, Supabase migrations, UI-SYSTEM2, PERF2.1 and Vercel Preview. Manual authenticated multi-role acceptance is still suspended by founder decision.

## Release and product boundaries
Do NOT activate billed AI or browser microphone production flags as a side effect of merge. Enable only after independently deploying migration, reviewing AI Gateway spend budget, secure auth acceptance and founder-approved controlled pilot. No RFQ/PO auto dispatch. Integration into the unified Commerciale/RFQ experience requires separate explicit human approval and product work.