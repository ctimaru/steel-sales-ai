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

test("PP1.1 tells internal reviewers that attribution alone is insufficient", () => {
  assert.match(page, /PP1\.1 · Publication Rights/);
  assert.match(page, /Autorizzazione scritta richiesta prima della pubblicazione/);
  assert.match(page, /Citare Padana Tubi come fonte non costituisce/);
  assert.match(page, /sourceRightsReview\.structured_data_visibility/);
});

test("PP1.1 exposes the legal-terms reference only inside the internal preview flow", () => {
  assert.match(page, /version\.is_internal_preview/);
  assert.match(page, /getPriceListSourceRightsReview/);
  assert.match(page, /Note legali della fonte/);
  assert.match(server, /pl1_source_rights_review/);
});
