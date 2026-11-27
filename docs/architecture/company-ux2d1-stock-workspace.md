# COMPANY-UX2.D.1 — Stock and planned availability workspace

## Product purpose

The industrial profile now covers products, facilities, sectors, certifications
and assisted review. D.1 makes its existing Stock and arrivals panel useful for
daily commercial work: find a declared position, understand its type and
visibility, and update it through the governed inventory writer.

This microblock changes presentation and interaction. It creates no database
migration, new RPC, inferred inventory, pricing model or ERP synchronization.

## Data and scope

`getManagedNetworkInventory` continues to call `netprofile_ux1b_manage` with the
authenticated organization and managed company. The existing reader returns at
most the 100 most recently updated non-archived positions. Search, filters and
counts describe only those loaded positions. At the limit, the interface states
that the 100 most recently updated positions are shown.

Counts separate stock, incoming material, planned production, private drafts and
published records. Quantities are displayed per position in their declared
units; tonnes, kilograms, metres, bars and pieces are never added together.

Managed rows must have an explicit valid publication state. The public reader
remains compatible with the existing RPC projection, which omits that field.
No missing or unknown managed state is silently interpreted as published.

## Interaction

The primary action is **Aggiungi disponibilità**. The loaded list exposes type,
product, technical description, quantity and unit, locality, planned date,
publication state and last update before opening an editor. Icons describe the
kind of position, not inferred product geometry or company equipment.

Search covers product, standard, grade, dimensions and locality. Type and
publication filters can be combined. A valid empty inventory, a filter with no
results and unavailable inventory data are distinct states. An unavailable
reader does not render zero counts as confirmed inventory.

Only one editor is active. It remains independent of list filtering, preserves
its inputs on validation or writer errors, and has an explicit **Annulla**
action. The component is scoped by organization and company so edits cannot
carry into another workspace after context changes.

| Record state | Available decisions |
| --- | --- |
| New position / private draft | Save private draft or explicitly publish |
| Published position | Update publication, make private or archive |
| Existing private draft | Save, explicitly publish or archive |

The duplicate draft command on published positions is removed. A pending
request prevents duplicate submissions. Success refreshes the governed reader;
the interface does not claim success or change visibility before the server
confirms it.

## Writer and authority

`saveCompanyInventory` returns a bounded result for inline feedback. The legacy
`saveManagedNetworkInventory` redirect action and the new action share the same
write implementation. The server derives the organization from the authenticated
admin context, validates the input and calls `netprofile_ux1b_upsert`.

The existing SQL authorization, approved-claim and active-company linkage checks,
publication trigger and private audit events remain authoritative. A company
under review can prepare drafts; publication stays disabled in the interface
and is independently rejected by the database until the company is eligible.

An incoming or production record requires a real calendar date before
publication. A draft may omit that date. A past planned date does not transform
the record into stock, confirm that goods arrived, or imply availability.

The writer retains its existing concurrency semantics. D.1 does not add the
proposal/state hashes or immutable decision contract used by C.2, and must not
present inventory editing as having those protections.

## Adjacent commercial journeys

Official catalogues remain at `/network/manage/cataloghi`, with their existing
company, rights and source checks. Catalogue evidence describes technical
knowledge; it does not create stock availability.

`/uploads` belongs to private Commercial Memory. It is not a stock import
endpoint. D.1 must not label a link to that route as an inventory import.
Governed CSV/Excel inventory import, with preview, unit mapping and explicit
confirmation, remains a separate future microblock.

## Verification and delivery

Behavioral unit tests cover filtering, loaded-position counts, localized units,
calendar validation, input validation and explicit managed publication states.

The Company Chrome workflow retains A/B/C regressions and adds a D.1 harness
against disposable localhost Supabase. It exercises actual server actions and
RPC readback for draft creation and editing, cancel, explicit publication,
return to private and archive. It also covers combinations of filters, error
recovery, a company under review, rejected unauthorized RPC calls and the
100-position boundary.

Visual acceptance covers empty, populated, editing, validation feedback and
publication-unavailable states at 1440, 390 and 320 px. Inspect focused viewport
captures as well as full-page captures so the actual controls are visible.

The existing inventory SQL regression tests remain in the required gate. No
hosted data or publication state is changed by this acceptance. Implementation,
CI evidence and review status belong in the PR and COMPANY-UX2 project page;
merge and production deployment form a subsequent authorized release.
