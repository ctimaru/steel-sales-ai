# SCHOOL-QA3 — Authenticated Visual Sign-off, Desktop and Mobile

## Evidence supplied by the founder (2026-10-29)
The founder provided three real-account screenshots: authenticated School desktop (~1620px wide), Professor desktop (~1600px), and Professor mobile (~390px). These screenshots show the real production workspace UI; no credentials or internal company documents were requested.

## Visual verdict
- **School desktop — PASS:** calm, industrial first view; compact search Norme/Gradi; calculator a one-click; secondary panels collapsed. Do not redesign it.
- **Professor desktop — PASS with nonblocking polish:** teacher dominates with one question, grounded source disclosures; illustration remains intentionally simple, so premium avatar craft is a later art-direction task, not an excuse to enable animation or voice.
- **Professor mobile — P1 acceptance gaps:** the teacher disappeared due to `sm:flex` desktop-only artwork; four large recommendation pills consumed the first screen; bottom workspace dock visually obscured the last pill at the photographed scroll position. Mobile top navigation also consumes some space but remains functional; avoid broad shell changes.

## One controlled correction
- Reuse the exact original SVG teacher portrait in an accessible and compact mobile presence bubble beside the teacher status, while retaining desktop portrait. No additional artwork, requests, fonts, images or third-party dependencies.
- Show two suggested questions by default; disclose two further prompts behind a native `details/summary` control. All original suggestions remain usable. Do not change question parsing, trusted source lookup, answers, AI flags or citations.
- Trim mobile hero padding slightly and reserve 8rem + iOS safe area below the **authenticated** Professor page so the fixed navigation dock does not block the final content when scrolling.
- Add source contracts and Chrome acceptance on public + demo-authenticated 390/1440 to confirm visible mobile portrait, collapsed sample questions, no overflow and authenticated bottom clearance.

## Protected release
- [ ] P0 test/typecheck/build and secret scan; UI contrast.
- [ ] PERF2.1 Chrome Professor and authenticated School 390/1440; wider mobile and Lighthouse regressions.
- [ ] FLOW1 commercial end-to-end in synthetic temporary infrastructure.
- [ ] Only after all green: protected merge and Vercel Production READY matching merge SHA.
- [ ] Final founder visual sign-off using real authenticated mobile; screenshots are accepted as **before** evidence, not proof of the post-merge fix.

## Explicit non-goals
No public School redesign, no calculator/normative engine edits, no Distinta/RFQ or Network/Commercial edits, no AI/Voice or avatar animation, no pilot activation. All data stays isolated and the Launch 2027 pilot remains NO-GO.