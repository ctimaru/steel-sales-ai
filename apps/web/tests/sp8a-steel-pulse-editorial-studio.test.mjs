import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const studio = read("../app/(italian)/(platform)/platform/steel-pulse/editorial/page.tsx");
const readiness = read("../app/(italian)/(platform)/platform/steel-pulse/page.tsx");

test("SP8.A editorial studio is restricted to the real Platform Owner", () => {
  assert.match(studio, /requirePlatformConsoleContext\(\)/);
  assert.match(studio, /if \(!context\.is_platform_owner\) redirect\("\/platform"\)/);
  assert.match(readiness, /href="\/platform\/steel-pulse\/editorial"/);
  assert.doesNotMatch(studio, /getServiceRole|service_role|createAdminClient|anon_key/);
});

test("SP8.A uses only SP3 read-only RPCs, and no publishing or dummy items", () => {
  assert.match(studio, /rpc\("sp3_editorial_queue"/);
  assert.match(studio, /rpc\("sp3_editorial_detail"/);
  assert.match(studio, /p_state: status, p_limit: 25/);
  assert.match(studio, /queue\.items\.some\(\(item\) => item\.item_id === requestedItem\)/);
  assert.match(studio, /SP7\.2 sospeso · nessuna pubblicazione/);
  assert.match(studio, /Nessuna scheda in questa vista/);
  assert.match(studio, /Nessuna anteprima disponibile/);
  assert.doesNotMatch(studio, /sp3_decide|sp3_save_draft|sp2_ingest|fetch\(|dangerouslySetInnerHTML|action=\{/);
});

test("SP8.A fails closed and cannot create counterfeit rights or source URLs", () => {
  assert.match(studio, /function parseQueue\(value: unknown/);
  assert.match(studio, /function parseDetail\(value: unknown/);
  assert.match(studio, /function safeSourceUrl\(value: string\)/);
  assert.match(studio, /url\.protocol === "https:"/);
  assert.match(studio, /Impossibile verificare la coda SP3/);
  assert.match(studio, /Diritti non verificati o non attualmente validi/);
  assert.match(studio, /href=\{sourceUrl\}/);
  assert.match(studio, /rel="noopener noreferrer"/);
});
