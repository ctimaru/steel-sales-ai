# SA7 — Knowledge Operations Delegation Cutover

## Goal

SA7 activates the SA2 Knowledge capability model over the K2–K8 public Steel Knowledge editorial layer.

The cutover introduces a governed editorial workflow without creating a second CMS and without exposing canonical technical tables or tenant-private Commercial Memory.

## Existing foundation reused

SA7 reuses the existing editorial registries:

- `steel_knowledge_standard_pages`
- `steel_knowledge_grade_pages`

K2–K4 already separate editorial copy from canonical technical facts. K8 already provides live SEO/content quality and publication-readiness checks.

## Roles and capabilities

### Knowledge Editor

- `knowledge.read_drafts`
- `knowledge.edit`
- `knowledge.review`
- `knowledge.quality_audit`

Knowledge Editor can prepare drafts and participate in review but cannot publish.

### Knowledge Publisher

- `knowledge.read_drafts`
- `knowledge.review`
- `knowledge.publish`
- `knowledge.quality_audit`

Knowledge Publisher can approve and publish but deliberately cannot edit draft copy.

### Platform Auditor

- `knowledge.read_drafts`
- `knowledge.quality_audit`

Platform Auditor is read-only.

Platform Owner retains implicit access to every known capability.

## Draft / live separation

The central SA7 invariant is that editing a currently published Knowledge page must never mutate the public version.

Each existing editorial row now carries:

- isolated `draft_payload`;
- `workflow_status` (`draft`, `in_review`, `changes_requested`, `approved`);
- independent `draft_version`;
- draft, review and publication actor/timestamp metadata.

The K2–K8 anonymous public read contracts continue reading only the existing live columns and `page_status`.

Saving a draft:

- validates and normalizes editorial JSON;
- updates only `draft_payload` and workflow metadata;
- increments `draft_version`;
- resets prior review approval;
- leaves live copy, public URL and `page_status` unchanged.

While a draft is `in_review`, edit mutations are rejected so a reviewer is always evaluating a stable snapshot.

## Review workflow

An Editor can submit a draft to review only when the draft passes the SA7 publication-readiness blocker set.

Reviewers with `knowledge.review` can:

- approve the current draft;
- request changes with a mandatory note.

Approval sets `workflow_status = approved` but does not publish or change anonymous output.

## Publication workflow

`knowledge.publish` is the independent high-risk capability.

Publishing requires:

- workflow state `approved`;
- zero publication-readiness blockers.

Publication atomically copies the approved draft fields into the existing live editorial columns, aligns `editorial_version` with `draft_version`, sets `page_status = published`, records the publisher and refreshes `last_reviewed_at`.

Unpublish changes the live page state to `archived`; the editorial copy and version history are retained.

## Editorial validation

SA7 validates:

- payload type and 256 KiB maximum size;
- SEO field lengths;
- editorial section and FAQ structure/counts;
- source reference structure and `http(s)` URLs;
- related-slug syntax and limits;
- standard-specific scope copy;
- grade-specific designation copy.

Readiness requires SEO title/description, intro, type-specific core copy, at least two editorial sections, at least two FAQs and at least one public source reference.

## Quality audit

`knowledge.quality_audit` exposes a Platform-only aggregate combining:

- the existing K8 live SEO/freshness report;
- SA7 draft readiness and workflow counts.

The K8 internal RPCs remain service-role-only. SA7 reaches them only through a private capability-checked implementation.

## Platform UI

`/platform/knowledge` requires `knowledge.read_drafts` and shows:

- workflow counters;
- K8 live-quality metrics when `knowledge.quality_audit` is present;
- effective capability badges;
- standard/grade editorial queue;
- read-only experience for Platform Auditor.

`/platform/knowledge/[type]/[id]` shows the isolated draft, live/draft versions, blockers and only the actions authorized by the current capability set.

## Audit

All privileged mutations write `platform_access_events` through the common SA2 ledger.

Actions include:

- `knowledge_draft_saved`
- `knowledge_review_submitted`
- `knowledge_draft_approved`
- `knowledge_changes_requested`
- `knowledge_page_published`
- `knowledge_page_unpublished`

The audit records actor identity, authority type, role snapshot, exact permission, page entity and before/after workflow state without copying the full editorial body into the audit ledger.

## Security boundaries

- Browser roles retain no direct SELECT/INSERT/UPDATE/DELETE access to editorial tables.
- Public K2–K8 read RPCs are not replaced by SA7.
- K8 internal quality RPCs remain service-role-only.
- Platform Staff receive no `organization_membership`.
- SA7 never grants access to Commercial Memory.
- Canonical technical reference tables are not editable through SA7.

## Acceptance

SA7 acceptance proves:

1. Knowledge Editor can read/edit/review/quality but cannot publish.
2. Knowledge Publisher can read/review/publish/quality but cannot edit.
3. Platform Auditor can read drafts and quality only.
4. Ordinary authenticated users cannot enter the Knowledge control plane.
5. Editing an already-published page changes only `draft_payload`.
6. The anonymous K2 page remains unchanged after draft save and review approval.
7. A draft is frozen while `in_review`.
8. Publication requires approved workflow state.
9. Publishing promotes the approved draft atomically to the public page.
10. Unpublish removes the page from the anonymous K2 contract.
11. Mutations record permission-aware Platform audit events.
12. Platform Staff receive no tenant membership.
13. Platform Owner retains uninterrupted capability access.

## Boundary after SA7

Operational delegation is complete for Registrations, Company Discovery, Claims and Knowledge editorial operations.

Root-only boundaries continue to include People & Access governance, reserved tenant break-glass authority and Platform-controlled Network verification/moderation that has not been explicitly delegated.
