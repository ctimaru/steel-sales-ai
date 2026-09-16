-- P1.7 follow-up: the canonical product lookup index already exists from the ontology foundation.
-- Keep the original shared index and remove the duplicate introduced by the Product 360 migration.
drop index if exists public.commercial_observations_org_canonical_product_idx;
