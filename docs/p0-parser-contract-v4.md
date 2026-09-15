# P0.6 — Parser Contract v4

## Purpose

Parser v4 turns raw commercial steel text into structured observations with an explicit, inspectable quality contract. It does not silently correct physically invalid data. Instead, it preserves the extracted source values, lowers confidence, attaches machine-readable validation issues, and routes the observation to human review.

## Stable observation contract

The business fields remain compatible with the v3.1 staging shape: source, item role, grade, standard, geometry, length, quantity, price, availability and confidence.

Every v4 observation also writes `metadata.parser_contract_version = "v4"` plus:

- `dimension_interpretation`: how a dimension expression was interpreted;
- `confidence.score`: same score persisted in the top-level `confidence` field;
- `confidence.band`: `high`, `medium`, or `low`;
- `confidence.components`: deterministic score components;
- `confidence.automatic_acceptance_threshold`: currently `0.90`;
- `validation.status`: `valid`, `review_required`, or `invalid`;
- `validation.issues`: structured issue objects;
- `flags`: deduplicated machine-readable issue codes propagated to commercial observations.

## Confidence model v1

Deterministic components:

| Signal | Weight |
| --- | ---: |
| Base line extraction | 0.55 |
| Tube geometry present | 0.25 |
| Grade present | 0.10 |
| Standard present | 0.05 |
| Commercial context (price, quantity or availability) | 0.05 |

Bands:

- `high`: score >= 0.90
- `medium`: 0.75 <= score < 0.90
- `low`: score < 0.75

Any validation error caps confidence at `0.35`. A non-error extraction below `0.90` receives the `low_confidence` warning and is routed to review.

## Validation taxonomy v1

| Code | Severity | Meaning |
| --- | --- | --- |
| `dimension_non_positive` | error | OD, width or height is zero/non-positive |
| `invalid_wall_thickness` | error | wall thickness is zero/non-positive |
| `invalid_wall_thickness_ratio` | error | wall thickness is physically incompatible with OD/section |
| `invalid_length` | error | extracted length is zero/non-positive |
| `invalid_quantity` | error | extracted quantity is zero/non-positive |
| `invalid_price` | error | extracted price is zero/non-positive |
| `missing_product_geometry` | warning | commercial line has extractable content but no tube geometry |
| `low_confidence` | warning | confidence is below automatic acceptance threshold |

The first issue is the primary review reason; all issue codes are retained in `flags` and the complete issue list remains in staging metadata.

## Tube dimension interpretation

Parser v4 explicitly fixes a v3.1 ambiguity.

- `406,4 × 6,3` -> round tube: OD × wall
- `406,4 × 6,3 × 12000` -> round tube: OD × wall × length
- `220 × 220 × 8` -> square hollow section: width × height × wall
- `300 × 100 × 5` -> rectangular hollow section: width × height × wall
- `300 × 100 × 0` -> rectangular hollow section with invalid wall thickness; never silently reinterpreted as round tube

For three-value dimensions, the third value is treated as section wall when it is physically plausible (`third < min(first, second) / 2`). Zero is retained as a section wall specifically so validation can emit `invalid_wall_thickness`. Otherwise, the pattern is treated as round OD × wall × length.

## Grade and standard coverage added in v4

The deterministic extractor now recognizes common structural variants including `S275J0H`, `S235JRH`, `S355J2H`, pressure grades such as `P265GH`/`P235TR1`, line-pipe `Lxxx` grades, EN standards and `API 5L`.

## Review routing

The existing `promote_worker_job` function remains unchanged. P0.6 adds two compatibility triggers:

1. promoted observations originating from v4 staging metadata receive `role_method = worker_v4`;
2. the existing low-confidence review insert is rewritten at insert time to the parser v4 primary issue code and issue severity.

This preserves the already-tested promotion path while upgrading review quality.

Examples:

- `300×100×0 S355J2` -> reason `invalid_wall_thickness`, severity `error`;
- valid geometry without enough evidence for confidence >= 0.90 -> reason `low_confidence`, severity `warning`.

## Non-goals

P0.6 does not perform fuzzy grade equivalence, cross-document field inheritance, LLM-based extraction, or automatic correction of suspicious values. Those belong to later parser/entity-resolution iterations and must remain evidence-grounded.

## Acceptance gates

P0.6 is production-ready only when all are green:

1. parser v4 unit/regression tests;
2. full Supabase migration rebuild;
3. P0.2 tenant-isolation acceptance;
4. P0.4 steel-ontology acceptance;
5. P0.6 parser-contract SQL acceptance;
6. database lint;
7. complete worker/RAG regression suite;
8. production smoke proving exact review routing and unchanged tenant isolation.
