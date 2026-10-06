import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(public)/distinta/page.tsx", import.meta.url),
  "utf8",
);
const builder = fs.readFileSync(
  new URL("../components/buyer-distinta-builder.tsx", import.meta.url),
  "utf8",
);
const contract = fs.readFileSync(
  new URL("../lib/buyer-distinta.ts", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(public)/distinta/actions.ts", import.meta.url),
  "utf8",
);

test("BD1 replaces the public Listini entry point with Crea distinta", () => {
  assert.match(home, /label: "Crea distinta"/);
  assert.match(home, /href: "\/distinta"/);
  assert.match(home, />\s*Crea distinta\s*</);
  assert.doesNotMatch(home, />\s*Listini\s*</);
});

test("BD1 is manufacturer-independent and contains no price-list discount inputs", () => {
  assert.doesNotMatch(page, /Padana/i);
  assert.doesNotMatch(builder, /Base €\/m|Extra €\/m|Sconto/);
  assert.match(page, /Nessun\s+riferimento\s+a\s+listini\s+produttore/i);
});

test("BD1 converts Target euro per tonne into Target euro per metre from kg per metre", () => {
  assert.match(contract, /\(targetEurT \* weightKgM\) \/ 1000/);
  assert.match(builder, /Target €\/t/);
  assert.match(builder, /Target €\/m/);
  assert.match(builder, /Peso kg\/m/);
});

test("BD1 supports public copy and private save/send", () => {
  assert.match(builder, /Copia distinta/);
  assert.match(builder, /saveBuyerDistinta/);
  assert.match(builder, /sendBuyerDistinta/);
  assert.match(actions, /buyer_create_distinta_snapshot/);
  assert.match(actions, /https:\/\/api\.resend\.com\/emails/);
  assert.match(actions, /reply_to/);
});

test("BD1 supplier delivery keeps recipient addresses separate", () => {
  assert.match(actions, /for \(const recipient of recipients\)/);
  assert.match(actions, /to: \[recipient\]/);
  assert.doesNotMatch(actions, /to:\s*recipients/);
});
