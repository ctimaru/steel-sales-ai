# RQG4.2 — Company Review Multi-Role UX & Accessibility Acceptance

Scope: **disposable local synthetic test data only**. This checkpoint does not activate companies, bypass real legal consent, grant production privileges, alter any production Review decision or test against real customer records.

## Tested surfaces

- Company Admin A and Company Admin B authenticate via real **local GoTrue** and see only the corresponding RQG31 private Company Review evidence; the other company's marker must never render.
- Company Viewer, delegated Platform Staff and Platform Owner with no company membership are denied canonical and legacy Company Review deep links. Company admins cannot access Platform Review.
- Each Company Review entry is a named group with a heading and human-readable status; pending decisions remain visible, and Confirm/Correct actions are untouched.
- Native disclosure elements respond to Enter and preserve keyboard focus. Correction fields have explicit accessible names, including geometry, price, quantity, standard and notes.
- At 320, 390, 768 and 1440 px, Review has no horizontal overflow. Advanced disclosure and action controls have at least a 44px nominal hit target; Confirm and Save Correction button text contrasts meet 4.5:1.
- Long source evidence wraps safely rather than forcing horizontal scroll. Review corrections and hit targets are usable on a narrow viewport.

## Test order and limitations

The existing `.github/workflows/perf1-chrome-auth.yml` starts disposable Supabase, GoTrue and Next on localhost. It seeds local-only tenants/Review fixtures and then runs existing PERF1, RQG3.2h, **new RQG4.2 read-only UI/a11y tests**, and finally RQG3.1 mutating Confirm/Correct/RPC tests. Local DB and QA credentials are destroyed afterwards. Test coverage is additive; no new Vercel jobs.

The script checks selected WCAG AA text contrast for key buttons and accessible labels/focus/keyboard/viewport on these flows. It is **not** a blanket WCAG conformance certification or a screen-reader usability study. General product accessibility still benefits from future manual QA.

## Merge gate

Merge only when P0 Required Gate and synthetic PERF1 Chrome are green. Other relevant preexisting mobile/performance checks must remain green when triggered. Hosted Company-positive pilot acceptance stays **DEFERRED** per RQG3.2j and GitHub issue #549.

Next planned microblock: **RQG4.3 — Release & Navigation Acceptance**, checking links, alternate deep routes, fallback UX and the separation of Workspace actions from Platform Review.
