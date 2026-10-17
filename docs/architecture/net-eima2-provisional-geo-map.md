# NET-EIMA2 — Provisional end-user geography from first-party websites
Date: 2026-10-17

## Decision
EIMA 2026 is a **discovery pointer only**, not a reusable licensed bulk dataset. Do not crawl or rehost its exhibitor catalog absent database-rights review. Use independently evidenced company website URLs for limited, factual company research.

NET-EIMA1 staged 8 new agricultural-equipment targets as `network_core_target_leads` and skipped 3 already staged: ALPEGO, MASCHIO GASPARDO, FARESIN. Classification `end_user` is *indicative* and `finished_equipment_only`; **no assertion of tube consumption or purchasing**.

## Scope shipped by NET-EIMA2
- `network_neteima2_provisional_geo` stores source URL, brief observed address excerpt, current ISTAT municipality, province and region for eligible unconfirmed research leads. Service-only staging, restrictive RLS, never direct client access.
- Eligibility: official company-domain HTTPS URL, explicit city and province on page, exactly one current ISTAT match, not already a canonical Network company.
- Free and Pro readers retain their existing entitlement checks. Server-side discovery pagination filters provisional companies by region **only if their observed geography is available**. Other unmapped companies stay discoverable nationally.
- The compact and full Italy maps show *published* locations (green) and *provisional, source-observed* locations (gold) separately, without merging verified and unconfirmed counts. No coordinate, plant or customer relationship is inferred.
- No canonical company or facility is promoted or published by NET-EIMA2. No individual contacts collected, no cross-tenant data.
- Review and correction/removal remain existing governance workflows.

## Real source cohort
7 of the 8 new leads have official company site address data:
- AGREX — Roveredo di Guà (VR), https://agrex.net/
- Antonio Carraro — Campodarsego (PD), https://www.antoniocarraro.it/it/contatti
- Argo Tractors — Fabbrico (RE), https://argotractors.com/contatti/
- BERTI — Caldiero (VR), https://www.bertima.it/chi-siamo/contatti/
- CAEB International — Sorisole (BG, Petosino locality), https://caebinternational.it/contatti.html
- NOBILI — Molinella (BO), https://www.nobili.com/
- SICMA — Miglianico (CH), https://sicma.it/

FERRI source lists Tamara (FE), a locality not an ISTAT municipality; avoid guessing Copparo or claiming an official municipality until corroborated from reliable locality-to-municipality evidence.

## Acceptance
1. Database migration and staging must complete without disabling any trust or tenant boundary.
2. Verify exactly the sourced records and per-region provisional overlay numbers against SQL, preserving canonical published baseline.
3. CI must pass for merge; separately verify Free/Pro authenticated map in production after deployment.
4. Correct/remove wrong records via source review; never treat an EIMA exhibition listing alone as a steel tube buyer signal.

No automatic mail outreach, connection requests, company claim, or publication is included.
