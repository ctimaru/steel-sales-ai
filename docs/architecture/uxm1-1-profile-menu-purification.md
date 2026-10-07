# UXM1.1 — Profile Menu Purification

## Principle

The avatar/profile drawer is not a second product navigation.

It contains only:
- company administration;
- account/privacy;
- a privileged Platform context switch when authorized;
- logout.

Operational product actions such as document import and data review are intentionally removed.

## Operational reachability

Document import remains available from:
- Company > Dati e fonti;
- first-use and setup states on Home;
- canonical route `/operations/uploads`.

Data review remains contextual:
- Home surfaces `Elementi da verificare` only when review work exists;
- alerts and canonical operational routes continue to lead to the review surface.

## Platform Console visibility

The Platform switch is fail-closed.

The workspace:
1. validates the authenticated user with Supabase Auth;
2. requests `platform_access_context`;
3. rejects RPC errors;
4. verifies that the returned `user_id` matches the authenticated identity;
5. requires `platform.console.access`.

Only then does the profile drawer render **Amministrazione Smart Steel Sales → Apri Console piattaforma**.

The `/platform` route repeats the security boundary server-side: login, matching identity and `platform.console.access` are all required. Hiding the menu item is therefore UX only, never the security control.
