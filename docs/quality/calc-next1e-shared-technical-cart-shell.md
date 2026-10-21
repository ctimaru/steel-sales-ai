# CALC-NEXT1E — Shared Technical Cart UI System
Date: 2026-10-21

## Implemented
Public IT/EN/DE/FR/ES and private Buyer Distinta share one `TechnicalCartShell` React component and one CSS Module:
- fixed technical-only cart badge (line count, metres, tonnes) with safe-area offsets
- an accessible side drawer on desktop and bottom sheet on mobile with matching color/contrast tokens
- Escape, Tab focus loop, focus restoration and body scroll lock
- optional focus incomplete buyer row when "complete rows" CTA was used
- identical dialog layout and no auto-opening after adding a line

Each caller owns its own validated quantities, persistence, translations, permissions, private commercial targets and RFQ actions. Shell accepts only display labels, counts and children; it imports no commerce contracts. The floating summary excludes prices and private buyer targets.

## QA
- Add code contract tests `calc-next1e-shared-cart-shell.test.mjs`.
- Update preexisting CALC-INT4.4B static assertions for extracted shell, preserve security assertions.
- Extend Chrome 390px and 1440px tests for Escape and focus return in the public cart; Escape in the private cart.
- P0, PERF2.1, UI-SYSTEM2 and computed UI-SYSTEM4 gates before merge.

## Out of scope
- Builder private DE/FR/ES language localization (CALC-NEXT1F)
- Smart dimension search and geometry preview (CALC-NEXT1C)
- No database migrations, pricing publication, automatic supplier dispatch or auth changes.
