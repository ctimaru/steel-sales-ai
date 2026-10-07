# UXM1.2 — Platform Context Switch

## Decision

Platform administration is no longer presented inside the avatar/profile drawer.

For identities that hold `platform.console.access`, the authenticated workspace header exposes a persistent **Console piattaforma ↗** control. On smaller screens the same permission-gated switch is rendered as a compact **Console ↗** control.

The Platform Console exposes the inverse **Workspace aziendale ↗** switch.

## Visual contract

Both directions use the same `ContextSwitchLink` component and therefore share:
- border and neutral white surface;
- compact rounded treatment where space is constrained;
- the same hover language;
- a directional arrow;
- same-tab navigation.

This makes the transition feel like switching between two product contexts rather than opening a setting.

## Authorization

Visibility still depends only on the authenticated workspace context resolving `platform.console.access` for the matching `user_id`.

The persistent switch is UX only. The `/platform` server boundary continues to verify authenticated identity and permission independently.
