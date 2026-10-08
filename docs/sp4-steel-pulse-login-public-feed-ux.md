# SP4 — Steel Pulse Login & Public Feed UX

**8 ottobre 2026 — login-first, no fake news, publication disabled by default**

## Product decision
Login remains the primary task: Steel Pulse is supplementary in a desktop second column and follows the form, feedback, password recovery, and registration CTA on mobile. The login form, safe next redirects and account setup remain unchanged. The news panel uses a React Suspense boundary so an unavailable API does not delay the login form.

### What visitors see
- A brand-consistent panel with source links, original editorial summary and commercial relevance when stories are approved.
- A clear "In preparazione" state linking to Scuola and Calcolo pesi when no content is available.
- No invented stories, unauthorized imagery, tenant intelligence, prices, contacts or RFQ data.
- Source links go to the verified original HTTPS article in a separate tab, with accessible labeling.
- Semantic headings, keyboard/tap targets, responsive stacking and plain text escaping.
- Login stays noindex; this is not an SEO-indexed public news page.

## Public read boundary: default deny
Migration: supabase/migrations/20261008182000_sp4_steel_pulse_public_feed.sql
- One private publication_settings row has enabled=false after migration. It must remain off until real SP2/SP3 data and rights are validated.
- Only one new anonymous read-only SQL RPC: public.sp4_public_steel_pulse_feed. STABLE SECURITY DEFINER and empty search_path audited in HP13.
- Response includes at most 3 original headline/summary/relevance cards, topic/language, source name, canonical source HTTPS URL and source publication date.
- No audit, source rights evidence, staff identities, legal attestation, tenant memory or unpublished content is returned.
- The RPC queries SP3 rights-current eligible projection, which checks source suspension, approval expiry and item withdrawal on each request.
- The Next.js reader uses only the Supabase publishable key, stateless anonymous access, cache no-store, 2.5s timeout and fail-closed empty-state rendering.
- No public table/view grant, service role on frontend, publishing action, crawler or RSS output.

## Required acceptance
- [x] Migration and rollback-only SQL test for public zero state, publication settings, exact output fields, revocation and withdrawal.
- [x] Node regression for reader link validation, limited output, no-store, login priority and accessible layout.
- [x] HP13 reviewed anonymous function allowlist updated from ten to eleven.
- [ ] CI Required Gate must succeed on the final commit before merge.
- [ ] Production Supabase migration and live anonymous smoke must be separately verified.
- [ ] First source/item-specific rights approvals and independent human editorial publishing required before enabling live news.

## Production cutover: explicitly not executed by SP4
1. Confirm Supabase production migration history, backup and scope; apply SP2, SP3 and SP4 migrations sequentially.
2. Verify settings disabled, no approved sources and no public stories.
3. Record rights approval for a specific licensed source and item, with independent human editor, legal approver and publisher.
4. Verify anonymous RPC only returns approved display fields; test source suspension and editorial withdrawal for cache freshness.
5. Platform Owner may then enable publication_settings with a controlled decision and audit; no automatic switch.
6. Smoke login/auth, password reset, account claim, mobile and desktop accessibility.

## Next
SP5 is personalized interests, saved topics and followed categories, never mixed with private commercial memory. An editorial management UI and controlled production rollout are still required for a useful real-news service; do not claim otherwise.
