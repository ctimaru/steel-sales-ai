# NET-LAUNCH5 — Network Production Visibility & Activation

## Release contract

Network is an **authenticated, tenant-authorized** product. No SEO/public endpoint should expose provisional records. The UI must aggregate two *independently paginated* data sources for eligible Free and Pro workspaces:

- Published: `network_companies` with `publication_status='published'`, excluding archived.
- Unconfirmed: `private.netfast_discovered_records`, including official company research (EIMA batches), Wikidata CC0 and governed candidates.

**Never hardcode “500”.** The real-time inventory may change, and 500 is an observed snapshot, not an acceptance constant. Display totals from `netlaunch4b_browse_page` with `p_source='published'|'unconfirmed'`, preserving each source's own pagination (`p` and `dpage`).

## Production checks

1. **GitHub:** Verify PR and required checks green on `main`. Record the main commit SHA.
2. **Vercel:** Check the production deployment's Git commit SHA, target `production`, status `READY`, and assigned `smartsteelsales.com` domain. A green GitHub workflow alone does **not** prove domain assignment. If the integration returns `403`, resolve team/scope authorization before declaring production verified. Do not force a redeploy merely to test.
3. **Database snapshot (read only):**
   ```sql
   select publication_status, count(*) from public.network_companies
   group by publication_status;
   select origin, count(*) from private.netfast_discovered_records
   group by origin;
   select count(*) from public.network_connection_requests;
   ```
4. **Free acceptance:** Sign in with an activated Free company. Open `/network?view=all`; confirm visible Free entitlement badge, sum of both *non-overlapping* sources, “Da confermare” labels, working tabs, `dpage` navigation, query/role filters, source/provenance profile, mobile list, region map. Test direct profile links.
5. **Pro acceptance:** Repeat with an entitled Pro company. Check Pro badge comes from server entitlement, not URL; all sources, independent pagination, profile access, map and region filtering.
6. **Geography:** No inferred positions or fake pins for entries lacking documented locations. Missing regions remain searchable from all-Italy view.
7. **Connection activation:** With two authorized, distinct businesses, send a motivated connection request and validate recipient inbox, permissions, outcome, and alerts. No synthetic requests on production. Record baseline/after count. Never claim this path accepted while the real count remains zero.
8. **Security:** Check no personal emails/contacts in provisional profiles; no cross-company private data; unauthenticated access denied; RLS remains enforced; Free/Pro scope checked server-side.

## Release decision

- **Code ready:** main + required CI checks green.
- **Production ready:** Vercel deployment SHA/READY/domain independently confirmed.
- **Network visible:** logged-in Free and Pro checks pass, with live inventory totals.
- **Activated:** genuine cross-company request delivered and acknowledged.

Keep these as separate statuses. Missing authorization is a blocker, not a pass. Avoid unnecessary deployments: ship after CI green and production authorization verification.

## Next sequence

NET-LAUNCH5A visibility acceptance → NET-LAUNCH5B simplify search/map and provisional location legend → NET-LAUNCH5C authorized two-company connection E2E.
