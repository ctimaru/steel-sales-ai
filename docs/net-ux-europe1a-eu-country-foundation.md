# NET-UX EUROPE1A — EU Country Foundation (20 October 2026)

## Scope
First implementation increment for the approved EUROPE1 plan. Extend country discovery to all 27 EU member states (ISO 3166 alpha-2), retain CH/GB/US, put country then region before technical facets and navigate immediately when geographic selections change.

- Shared typed EU member-country catalog and labels, without treating listing as evidence of company presence.
- Keep backend permission/tenant guards, published-only foreign queries, original Italian discovery behavior and unchanged geo provenance.
- Clear stale region, province, city and pagination when territory changes.
- Italy's existing 20 region options remain operational. Foreign region selection stays disabled until country-specific territorial taxonomy and SQL matching are ready under EUROPE1B/1C.
- Do not offer an EU-wide total/filter before a correct cross-country aggregation contract exists.
- NUTS codes must be linked to national administrative names; NUTS 2 is **not** synonymous with an intuitive "region" in every EU country (e.g. German Länder).
- Map remains Italy-only during 1A. EUROPE1B will add EU vector geometry and drill-down; EUROPE1C will implement EU territorial matching and count aggregation.
- Native country select intentionally shows country names rather than emoji: Windows flags must not regress to faded ISO letters. Per-country vector icon coverage follows with visual expansion.
- No migrations, imports or verification-state changes.

## Acceptance
CI: frontend tests, typecheck and build; country catalog test; saved URL and foreign-region guard regression; required UI-SYSTEM2 contrast checks.
Browser acceptance: Chrome/Windows Free and Pro; Italy->Poland->Italy, URL/history, Italian region reset, selector order, contrast, and mobile widths 390px/768px/1366px.
Merge to main only after required CI passes; report browser acceptance separately.

## References
- Base: NET-UX COMPACT5B, COMPACT6, DATA1 source and identity safeguards.
- Country keys: ISO 3166-1 alpha-2; EU 27 membership at implementation date.
- NUTS geography: Eurostat GISCO NUTS 2024; versioned regions in EUROPE1C, not inferred from country-only records.
