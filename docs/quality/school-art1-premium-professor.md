# SCHOOL-ART1 — Premium Professor Illustration

Status: feature branch; acceptance and deployment pending. Depends on completed SCHOOL-QA3 and SCHOOL-COPY1.

## Art direction
Improve the **character itself**, not the School UI. Preserve the accepted hero layout, dark-green industrial palette, one-question-first journey and mobile dock clearance. Professor should feel competent, friendly and recognizably human rather than a generic pictogram.

## Implemented
- Single **original static vector portrait** at `apps/web/public/school-professor-art1.svg` (viewBox 180×180, 5KB text): warm nuanced face with more defined features, salt-and-pepper short hair, delicate glasses, white shirt, forest-green suit and subtle steel/profile motif. Use gradients and clip only, no raster media, remote fonts or provider calls.
- `TeacherPortrait` embeds the same vector asset at the already approved desktop 155px and mobile 72px, without changing wrappers, position, visible content, search or technical tutor flow.
- The three existing deterministic expression states (neutral, checking, available) remain as simple inline SVG mouth shapes. No animation, speech, avatar service or likeness of a real person.
- Keep visible Italian headline «Come posso aiutarti?» and existing K2 grounded evidence, citations, follow-up questions and safe-only public technical links.

## Quality and security
- Static XML SVG: no JS, foreignObject, animate, external href/src, scripts or external CSS. Size guard below 12 KB.
- One shared illustration file, reused across breakpoints, browser-cached on the same origin. Shared CSS sizes unchanged; no image layout shift.
- Mobile portrait fits within the previously approved circular 48px crop; desktop retains 176px framing. Test Chrome on both at 390/1440.
- Source and browser contracts validate availability, image MIME, headline, state overlay, published K2 provenance and one-question-first UX.

## Protected acceptance
- [ ] P0 tests, TS, Next build and tracked secret guard.
- [ ] UI-SYSTEM2 contrast; PERF2.1 Chrome 390/1440 responsive + Lighthouse; FLOW1 commercial flow.
- [ ] Verify image is actually visible and of suitable artistic quality in the browser screenshots at both sizes, not merely present in DOM.
- [ ] Only after green CI protected merge, Vercel Production READY on exact commit, public Professor HTTP smoke.
- [ ] Founder authenticates visually on mobile and desktop after release; screenshot sign-off remains separate from synthetic acceptance.

## Non-goals
No UI redesign, avatar animation, voice, AI generation, image API/provider budgets, Supabase or legal pilot, calculator weight engine or Distinta/RFQ changes. Pilot Launch 2027 remains NO-GO.