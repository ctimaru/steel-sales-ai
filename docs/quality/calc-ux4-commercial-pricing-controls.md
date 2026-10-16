# CALC-UX4 — Commercial Price Preview & Controls Polish

Date: 2026-10-16.
Scope: **public EU weight calculator** for five locales IT/EN/DE/FR/ES. Does not change American NPS/Schedule calculator, steel weights or business-logic of RFQs.

## User workflow

1. Choose EN 10219 / EN 10210 (or free calculation), CHS/SHS/RHS and dimensions.
2. **Suggested wall thicknesses are collapsed by default** in a discreet line below the normal editable thickness field. Clicking it expands the existing relevant full-section suggestion chips; selection remains visible and accessible with keyboard/touch. The preferred EN 10219 (6 mm) and EN 10210 (6.3 mm) *starting values* remain identical; a salesperson can still type any valid thickness.
3. Buttons for standard, shape and bar length share coherent selected/unselected states, focus-visible rings, hover and stable touch targets (at least 44 px for button targets).
4. Results keep **kg/m** primary, kg/bar, total meters and tonnage. A slim light **Quick price** panel underneath has two simultaneously editable inputs: **€/ton** and **€/m**. The last input edited is authoritative. When geometry changes, only the other rate is recomputed from the exact current kg/m (no feedback loop).
5. Euro/tonne to euro/metre: `EUR/t * kg/m / 1000`. Inverse: `EUR/m * 1000 / kg/m`. Example at 20 kg/m: `850 €/t → 17 €/m`; reverse `17 €/m → 850 €/t`.
6. Price text accepts localized separators. In Italian/German/French/Spanish, `1.250` is one thousand two hundred and fifty; in English `1,250` is one thousand two hundred and fifty. Grouped decimals `1.250,50` (IT etc.) and `1,250.50` (EN) are supported; invalid combinations are blocked. Displayed derived rate is rounded to 4 decimal digits **only for display**, not the core calculation. Zero is valid.
7. If the geometry is invalid or kg/m <= 0, the derived field displays empty and the panel explains why. When the geometry becomes valid again, pricing derives immediately from the unchanged last edited rate.

## Privacy and scope

- No login required and no monetary data in database, local/session storage, URL, analytics events, RFQ payload, copied weight result, favourites or shared link.
- Calculated price is a **commercial working estimate**, not a quote, pricing catalogue, invoice or product certificate. No IVA/VAT, discounts, freight or margins calculated.
- The panel's input events do **not** trigger weight-calculation engagement events.
- Keep pricing separate from `currentSnapshot`, `resultText`, `shareUrl` and `calculatorRfqFromValues`.
- Existing five calculator URLs, canonical, hreflang and sitemap must stay intact.

## Acceptance

- [ ] Tests for 850 EUR/t @20kg/m and inverse, changing weight, locale thousand separators, invalid inputs, zero/invalid mass, no storage/URL/RFQ/analytics.
- [ ] Existing WC4.2 thickness contract, 5-language CALC tests, typecheck, build.
- [ ] Chrome mobile/keyboard/wcag and smoke controls green; manual mobile screenshot review is advised for both 320/360 px and desktop if browser automation cannot access a protected preview.
- [ ] PR merge only if required CI green; one normal production deployment, no extra manual deploy.
- [ ] Read-only production page check after merge; confirm actual interaction with browser where available.
