import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(public)/listini/[versionId]/page.tsx", import.meta.url),
  "utf8",
);
const server = fs.readFileSync(
  new URL("../lib/price-list-explorer-server.ts", import.meta.url),
  "utf8",
);

test("PP1 internal preview surfaces publication readiness without auto-publishing", () => {
  assert.match(page, /PP1 · Publication Readiness/);
  assert.match(page, /Pubblicazione bloccata/);
  assert.match(page, /ready_to_publish/);
  assert.match(page, /version\.is_internal_preview/);
  assert.match(server, /getPriceListPublicationReadiness/);
  assert.match(server, /pl1_publication_readiness/);
});

test("PP1 discloses source rules excluded from automatic pricing", () => {
  assert.match(page, /Condizioni della fonte non automatizzate/);
  assert.match(page, /Il calcolo automatico non sostituisce tutte le condizioni d&apos;ordine/);
  assert.match(server, /getPriceListPublicNotices/);
  assert.match(server, /pl1_price_list_public_notices/);
});

test("PP1 keeps publication blockers and bounded warnings visually distinct", () => {
  assert.match(page, /Blocker/);
  assert.match(page, /Warning governati/);
  assert.match(page, /publication_rights_not_approved/);
  assert.match(page, /delivery_term_conflict/);
  assert.match(page, /partial_eur_t_coverage/);
  assert.match(page, /special_shape_without_weight/);
});
