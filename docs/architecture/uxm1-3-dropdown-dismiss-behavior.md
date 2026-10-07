# UXM1.3 — Dropdown Dismiss Behavior

Authenticated header dropdowns follow one interaction contract:

- selecting a menu link closes the dropdown immediately;
- clicking or tapping anywhere outside an open dropdown closes it;
- pressing Escape closes open dropdowns;
- route changes close any dropdown that remained open;
- interacting inside a dropdown without navigating does not dismiss it.

The behavior is implemented once by `HeaderMenuDismissController` and is mounted in both the Workspace and Platform shells.

The selector is intentionally limited to `header details[open]`, so content accordions outside the application header are not affected.

The profile drawer keeps its existing dedicated behavior: navigation links close it, the backdrop closes it on outside interaction, and Escape is supported.
