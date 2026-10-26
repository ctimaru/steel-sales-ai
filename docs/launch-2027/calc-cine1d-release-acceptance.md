# CALC-CINE1D — Final acceptance and frontend release

Continuation of CINE1A composition, CINE1B family artwork and CINE1C controls and
results. PR #956 consolidates the complete calculator change. This release
closes the agreed visual implementation and its public functional acceptance.

## Release target and source reconciliation

- Repository: `ctimaru/steel-sales-ai`, production branch `main`.
- Vercel project: `prj_APnQ9rFMsFsU506v2YJ4EqXV3PVC`, team
  `team_UOHjmeMwmplUldDocZfjBmns`.
- Public target: `https://www.smartsteelsales.com` (and apex alias).
- Main baseline reconciled before release:
  `8d582c6ecbd1849fd85deb72de690db289d41935`.
- Last accepted calculator source:
  `7a1945baa6c58b1d8d880a31c3bcf8cc55f68c64`.
- The `apps/web` tree before and after merging current main is exactly
  `de34ff94946af19222a666ad3d6e4ee194d0117c`. The main reconciliation introduces
  no additional frontend change. Previously merged backend/network work stays
  owned by its own release process; this operation does not apply migrations.

The repository's Vercel ignore command skips builds when a commit changes no
files under the web root. A main-reconciliation or documentation-only commit
may therefore have a canceled Preview even though its web tree is identical
to the accepted Preview. The production merge changes the web tree relative
to main and must produce a new READY production deployment.

## Acceptance evidence before publication

On the accepted calculator commit, P0 passes with 2,178 frontend tests and the
production build. Complete Chrome/Lighthouse, FLOW1, action contrast and
protected Preview contrast all pass. PR #956 links exact runs and screenshots.

Twenty calculator cases cover IT/EN/DE/FR/ES at 320/390/768/1440, and eight home
floating-tool cases cover IT/EN at the same widths. Known CHS/RHS numerical
values, real family artwork, normative area, primary-action placement, compact
mobile controls, retained three-line bill, copying without private prices,
invalid geometry, focus and Axe are verified. Existing private-builder and
international regressions remain enabled. The original desktop action limit
is retained: measured 401px, below its 430px guard.

The release head must pass its required GitHub gate after reconciliation.
After publication, repeat the public calculator and floating-tool acceptance
against the real public domain and verify the production deployment commit and
aliases. Hosted tests use essential-only consent, isolated browser storage and
local bill actions; they do not dispatch RFQs to real suppliers. Full private
supplier-response coverage comes from FLOW1 with captured local mail, not from
an authenticated production send.

## Restore point and completion record

Before this release the domain resolves to READY deployment
`dpl_6NWJctrYvjgQpTxjs5e6wRKqxrxb`, commit
`3e632ec4679eca08e872d91c2ad912cec7cf2932`.
If the new frontend fails public acceptance, restore that known deployment
through Vercel and verify both domain aliases. Vercel rollback may disable
automatic domain assignment; restore the intended assignment mode explicitly
when resuming deployment. No database rollback accompanies this frontend-only
release.

Exact merge SHA, READY deployment, public acceptance results and final release
status are recorded in PR #956 and the WC — Weight Calculator Experience page
in Notion after execution. Lighthouse diagnostics are not real-user CWV.
