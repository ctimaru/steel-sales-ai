# UXM1 — Workspace Menu & Platform Boundary

## Information architecture

The avatar drawer is an identity/settings surface rather than a duplicate product menu.

### Workspace
- Importa documenti
- Revisioni dati

Operational alerts remain in the header bell.

### Azienda
- Completa setup azienda — only while guided setup is incomplete
- Profilo azienda
- Team e accessi
- Dati e fonti

Tube and standards tools remain in Scuola. Pilot analytics remains available for pilot operations but is not promoted as an ordinary company setting.

### Account
- Account e privacy

## Platform administration boundary

Platform administration is presented as a visually separate context switch.

Visibility is based on the Platform authorization contract returned by `platform_access_context` and specifically `platform.console.access`, not on the user's company role.

An organization admin therefore does not gain Platform access automatically. Platform Owner and delegated Platform Staff can reach `/platform` using the same authenticated session, while the Platform layout continues to enforce authorization server-side.

The Platform shell exposes a clear return path to the company workspace.

## Canonical routes

`/company/team` is now the canonical team/access management route.

`/onboarding` remains the guided initial setup flow. Its team section is retained for onboarding continuity, but ongoing team administration no longer depends on an anchor inside onboarding.

## Legacy generated workspace identity

Generated organization names matching `Steel Sales AI workspace <token>` are not shown as user-facing workspace identity in the avatar drawer. Until a real organization name replaces that legacy seed value, the UI displays `Smart Steel Sales · Workspace`.
