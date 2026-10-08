# SP7.1 — Editorial Operators & First-Source Rights Readiness

**8 October 2026 — production prerequisites, not legal approval or publication.**

## Verified existing workflow

- Admin route: /platform/people. The existing SA2/SA3/SA4 staff invitation system sends email invitations, requires account verification and lets the sole Platform Owner assign defined, audited role templates; no duplicate admin-account scheme needed.
- A Knowledge Editor holds knowledge.edit and knowledge.review, but **cannot review their own SP3 story**.
- A Knowledge Publisher holds knowledge.review and knowledge.publish. The Platform Owner retains legal approval; no one may be author/editor/owner on the same item. The publisher must differ from author and editor.
- SP3 controls are already enforced server-side by sp3_save_draft and sp3_decide, in addition to source-rights checks, item evidence and revision conflict checks.
- Production observation at SP7: exactly one Platform Owner, zero active Knowledge Editors, zero active Knowledge Publishers. No contributor invitation is created by SP7.1 without the real person's email address and owner's action.

## What SP7.1 adds

- New owner-only route /platform/steel-pulse, linked from /platform/people.
- Compact independent human operator check based on real active staff directory. Pending invites are counted separately and cannot satisfy human separation.
- Source-rights status read from actual production database through new authenticated, Platform Owner-only read RPC sp71_pilot_source_readiness.
- The RPC exposes no staff identities, private article bodies or legal evidence contents, and never edits source state. It checks independent source reviewer identifiers, currently valid approval, terms reviewed in 90 days and explicit discovery permission.
- Default deny on missing RPC/malformed response. No feature switch or crawler operation available through the UI.
- SQL regression checks non-owner access denial, unchanged source candidate status and disabled global feed; exact HP13 authenticated privileged-function allowlist expanded for this one read RPC.

## Legal and technical due diligence, source ec_dg_trade

Public official evidence:

1. Commission legal notice: https://commission.europa.eu/legal-notice_en. EU-owned site content is, unless otherwise stated, covered by CC BY 4.0 for reuse; attribution and modifications must be indicated. Third-party works, images showing identifiable people, protected marks and some other materials can require extra permission.
2. DG Trade official news collection: https://policy.trade.ec.europa.eu/news_en. The site itself links an RSS collection to https://policy.trade.ec.europa.eu/node/2/rss_en; independent inspection returned the application/rss+xml media type.
3. Official candidate article (31 August 2026): https://policy.trade.ec.europa.eu/news/commission-sets-type-evidence-be-provided-importers-prove-country-melt-and-pour-steel-products-2026-08-31_en.
4. The Commission's article says the relevant melt-and-pour documentation requirement applied from 1 October 2026 for imported products **covered** by the EU Steel Regulation. Avoid claiming the obligation covers every type of tube. Editors must confirm CN codes and legal applicability.
5. Technical robots.txt could not be independently retrieved by the online verifier; the SP2 worker must check it live and fail closed. Feed retrieval, terms/robots acceptance and egress DNS rebinding protections are **NOT VERIFIED**.

### Licence decision is still pending

No approval of DG Trade rights, no item-level attestation, no inferred approval from CC BY, no imported article text, no photos, no automated reuse. Register source-specific policy exceptions, accurate link attribution and independent reviewer/legal decisions before any crawl or publication. Even verified licence terms do not automatically grant crawl permission or safety against DNS rebinding.

## Human onboarding checklist

- Platform Owner opens /platform/people and invites one real person as Knowledge Editor for original editorial copy.
- Owner invites a second real person as Knowledge Publisher or Knowledge Editor who has knowledge.review, with a distinct verified user identity.
- Invitation expires after 7 days, and the invitation is not an active account; each individual must accept and authenticate.
- Keep the Platform Owner as legal approver and, if appropriate, publisher. Never assign a Platform Owner identity to other users.
- Confirm author/reviewer separation in /platform/steel-pulse. If permissions are changed or staff suspended, the readiness view must immediately change.

## SP7.1 acceptance vs next steps

SP7.1 is finished when the code and owner-only readiness surface are merged, green in Required Gate, and the read RPC is applied/verified on production with source still unverified and disabled. It **does not** claim two people have accepted invitations or the first news card was published.

SP7.2 is gated by real human collaborators and item-specific evidence: operator acceptance, robots and RSS checks, source rights approvals, hardened egress, a manual ingest, independent item fact-check, owner legal attestation, publisher release and supervised public-switch enablement. No default polling or email/push.
