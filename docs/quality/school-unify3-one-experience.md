# SCHOOL-UNIFY3 — One School, One Experience
19 October 2026

## Product decision
Smart Steel School uses one compact and professionally styled navigation rail on the five public School homepages and every locale of the authenticated School home. The public surface always links to a clearly marked, login-protected Company Workspace; the workspace links explicitly back to its public language counterpart. There is no private data reuse in a public component.

## What changes
1. Shared server-rendered `SchoolUnifiedNavigation` with one design system and translated labels (IT, EN, DE, FR, ES). Localized navigation only links to **published** real resources: IT/EN have true standards and grades catalogues; DE/FR/ES surface their own native-language technical guides and topic articles instead of suggesting translations for unavailable catalogues. Calculator and bill routes remain language-specific. Workspace uses existing guarded `/school`, `/school/norme`, `/school/gradi`, `/school/explorer`, retaining the `?lang` convention.
2. Shared `SchoolConversionPath` = explore/consult → calculate → prepare bill, with a prominent direct CTA. It explicitly says that preparing a bill is not submitting a purchase order or automatically sending an RFQ. No new tracking cookies or AI feature claims.
3. Italian private home removes visual repetition from the first screen by collapsing the legacy detailed calculator, technical search and catalogue sections under a native keyboard-accessible disclosure. Quick recent/favourite links, original search forms and all private data access are preserved.
4. Existing SEO metadata, canonical/hreflang, original School articles, industrial SVG assets and server-side technical content are unchanged. No schema changes, authorization/RLS changes or public exposure of private docs.

## Release and remaining content gaps
This is an implementation-focused design microblock. The owner explicitly deferred new manual/authenticated test rounds, so **no new QA tests or production synthetic user run will be launched**. Repository's existing required CI remains the merge gate; don't bypass it. DE/FR/ES full norms/grades editorial translations remain a separate, source-verified content sprint. The previous SCHOOL-UNIFY2B synthetic multi-role workflow remains unrun and documented but is not blocking this UX-focused change.
