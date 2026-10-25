# HOME-CONV1A — Calculator-first homepage conversion

Date: 2026-10-25
Status: implemented in review branch. No production merge until accessibility, PageSpeed and Chrome E2E are green.
Previous baseline: HOME-CINE1E #939 merged, CI Lighthouse mobile 97/96/96, mean LCP 2.586s, CLS 0.

## Problem and founder decision

Cinematic imagery has reached acceptable quality, but the initial homepage emphasizes company registration and a free bill builder while the **calculator is the actual first step**.
The locale picker is visually oversized, and access to the account uses two separate header buttons.

## MVP conversion design

- **Primary everywhere on the home journey:** `Apri calcolatrice` / `Open calculator`. Top row sticks on scroll, without JavaScript. Mobile label `Calcola` / `Calculate` in a minimum 44px touch target.
- Hero primary links directly to IT/EN public tube calculator. Italian links preserve `source=home&surface=hero#calcolatore-pesi` attribution; header uses distinct `source=home&surface=header`. No login gate.
- **Second action:** `Crea una distinta gratis` / `Create a free RFQ bill`; once geometry and weight are known, the public bill builder is the natural next step.
- **Company access consolidated:** `Area aziende` / `Company area` single native `<details>` with direct `Accedi` and `Registra azienda` links, plus explicit application review notice. No change to login, registration or review policy.
- **Compact multilingual control:** globe + two-letter code; native locale links for IT/EN/DE/FR/ES remain available. On 320px menu opens towards centre to avoid clipping.
- **Secondary nav:** Distinta, Trova aziende, Network, Scuola (EN: RFQ builder, Network, Knowledge, Contact). Calculator already dominates the persistent header, so no duplicate navigation category.
- No new library, client bundle, server fetch, API call, auth session or new animation. Existing CINE1E imagery untouched.
- Keyboard: summary, language selector and both account links have visible focus outlines; native disclosure elements support click and Enter/Space. Sticky row is independent of the secondary navigation so mobile doesn't reserve 110+px throughout scroll.

## Hard acceptance

1. Chrome 320, 390, 768, 1440: logo/IT/Area/Calcola all in one row with no horizontal overflow; calculator CTA sticky after scroll and still navigates to public tool.
2. Hero primary calculator and secondary bill correct in both languages; correct anchor + attribution in IT.
3. Account native dropdown exposes exactly one login link and one registration link for each locale; no private Network/tenant disclosure.
4. Locale control offers all five supported languages with no truncation or clipping; mobile dropdown contains all links.
5. WCAG Axe zero serious/critical at 390 and 1440; keyboard and mobile 44px touch targets.
6. 3 mobile Lighthouse samples compared with CINE1E (97/96/96, mean LCP 2.586s, CLS 0); block meaningful regressions.
7. Vercel Preview approved visually; release controlled via draft PR, no force deploy.

## Measuring conversion later

After launch compare public `calculator_opened` allowlisted telemetry by source/surface; don't invent click conversion rates. The source labels header vs hero already exist. No tracking without the user's allowed consent mechanisms. A/B testing should be a separate, controlled step.
