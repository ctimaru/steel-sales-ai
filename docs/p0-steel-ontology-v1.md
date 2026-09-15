# Steel Ontology v1 — P0.4

## Purpose

P0.4 establishes the first production contract for how Steel Sales AI identifies steel-tube products across emails, offers, PDFs, spreadsheets and future ERP/CRM sources.

The objective is not to build the full Industry Graph yet. P3 owns market-wide company/plant/capability coverage. P0.4 creates the stable semantic foundation that every later layer can reuse.

## Ontology layers

Steel Sales AI uses three different scopes and they must not be collapsed into one global data lake.

1. **Private Company Graph** — tenant-owned emails, RFQs, offers, orders, prices, documents and commercial observations.
2. **Steel Network Graph** — global/shareable steel facts such as standards, grades, product families, plants and verified capabilities.
3. **Market Intelligence Layer** — derived or aggregated signals where sharing and privacy rules permit it.

A canonical product ID is a shared *identifier rule*, not shared commercial data. Two tenants can derive the same product ID for the same steel specification without either tenant seeing the other tenant's offers, prices or documents.

## Core ontology entities

The v1 model uses the existing Knowledge Graph entity types as the semantic vocabulary:

- Company
- Plant
- Country
- Product Family
- Grade
- Standard
- Process
- Application

The tube product identity composes those concepts with geometry. Later phases can promote Product, Dimension and Certification to first-class graph entities when needed by P3 without changing the v1 product-ID contract.

## Tube families in v1

Canonical families:

- `round_tube`
- `square_tube`
- `rectangular_tube`

Accepted aliases include:

- round: `round_tube`, `round tube`, `circular_tube`, `CHS`
- square: `square_tube`, `square tube`, `SHS`
- rectangular: `rectangular_tube`, `rectangular tube`, `RHS`

When geometry is available, geometry wins over the textual family label.

## Canonical product identity

Identity version: `tube:v1`

Core identity fields:

- product family / shape
- grade
- standard
- material number, when present
- cross-section geometry
- wall thickness
- manufacturing process, when present

Explicitly excluded from core identity:

- length
- quantity
- price
- currency
- delivery date
- incoterm
- customer/supplier
- certification/document requirement

These excluded fields are commercial or variant facts. They must remain queryable, but they must not fragment the core product identity.

### Why length is excluded

`406.4 × 6.3 P265GH` supplied at 6 m and the same tube supplied at 12 m represent the same core steel product for price-history and commercial-memory purposes. Length remains an observation attribute and can still be used as a filter.

### Why certification is excluded

A 3.1 certificate, PED requirement or other documentation condition can change the commercial offer without changing the metallurgical/geometric product core. Certification will be modeled as a linked requirement rather than part of the v1 product ID.

## Key format

The canonical text key is deterministic and human-inspectable.

Round example:

```text
tube:v1|family=round_tube|grade=p265gh|standard=en10224l275|material=_|geom=od:406.4|t=6.3|process=_
```

Rectangular example:

```text
tube:v1|family=rectangular_tube|grade=s355j2h|standard=en10219|material=_|geom=120x80|t=5|process=_
```

The UUID is deterministically derived from the versioned canonical key. The UUID therefore stays stable across documents and tenants as long as the v1 identity contract does not change.

## Normalization rules

- textual identity tokens are case-insensitive;
- whitespace and punctuation differences do not change the identity token;
- numeric dimensions remove insignificant trailing zeroes;
- `120 × 80` and `80 × 120` resolve to the same RHS identity;
- equal width/height geometry resolves to SHS/square identity;
- complete round geometry requires OD + wall thickness;
- complete SHS/RHS geometry requires width + height + wall thickness;
- incomplete geometry receives no canonical product ID rather than a misleading one.

Unknown grade, standard, material number or process are represented explicitly as `_`. This deliberately creates a less-specific identity instead of silently assuming missing technical information.

## Database contract

P0.4 adds pure immutable canonicalization functions and generated columns to both:

- `public.commercial_observations`
- `public.products`

Generated fields:

- `canonical_product_key`
- `canonical_product_id`

This gives existing historical observations a canonical product identity without rewriting their source/provenance fields. New rows inherit the identity automatically from their normalized technical attributes.

Indexes are tenant-prefixed:

- `(organization_id, canonical_product_id)` on commercial observations
- `(organization_id, canonical_product_id)` on products

This supports fast tenant-scoped product-history queries while preserving P0.2 isolation.

## Examples

The following all resolve to the same round-tube ID:

- `ROUND TUBE / P265GH / EN-10224 L275 / 406.400 × 6.300`
- `round_tube / p265 gh / EN 10224 L275 / 406.4 × 6.3`
- `CHS / P265GH / EN10224 L275 / 406.4000 × 6.3000`

The following resolve to the same RHS ID:

- `120 × 80 × 5 S355J2H EN 10219`
- `80 × 120 × 5.0 s355j2h EN10219`

The following do **not** resolve to the same ID:

- `S355J2H` vs unknown grade
- `EN 10219` vs unknown standard
- known manufacturing process vs unknown process

That separation is intentional: missing technical facts must not be guessed.

## Relationship to existing Knowledge Graph

The existing M5.4 catalog remains authoritative for canonical Grade, Standard, Product Family and other semantic entities. P0.4 does not duplicate those tables.

The product ID is a deterministic composition layer on top of the current extracted technical fields. P0.7 can later harden entity resolution and map aliases/equivalences such as grade/material-number relationships without breaking `tube:v1`.

## Privacy rule

Canonical IDs are safe to compare; tenant facts are not globally visible.

Never create a global product-demand catalog by copying private observations into globally readable Knowledge Graph rows. A product specification may have a global identifier, but a tenant's use of that product, its price, RFQ, offer, customer and supplier remain inside the tenant boundary.

## Acceptance criteria

P0.4 is complete when:

1. canonical tube-key and UUID functions are deterministic and immutable;
2. equivalent formatting and aliases produce the same canonical ID;
3. RHS orientation is normalized;
4. incomplete geometry does not receive a false identity;
5. existing commercial observations receive generated IDs where their tube geometry is sufficient;
6. `products` and `commercial_observations` use the same identity contract;
7. tenant-scoped indexes exist;
8. database lint and P0 security/worker/RAG regressions stay green;
9. Supabase security/performance advisors show no new blocking findings.

## Next consumers

- **P0.6 Parser contract v4**: emit normalized technical fields with confidence/error taxonomy.
- **P0.7 Entity resolution hardening**: alias and equivalence mapping on top of v1 IDs.
- **P1 Product 360 / Price History**: group commercial observations by `canonical_product_id`.
- **P3 Product taxonomy / Capability Graph**: reuse `tube:v1` IDs as the bridge between private product history and shareable market capabilities.
