import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

test("PLR5.1 all three governance queues use one accessible filter control", () => {
  const control = read("components/governance-queue-controls.tsx");
  assert.match(control, /aria-current=\{active \? "page"/);
  assert.match(control, /encodeURIComponent|URLSearchParams/);
  assert.match(control, /searchQuery\?\.trim\(\)/);
  for (const [area, uri] of [["registrations", "registrations"], ["company-claims", "company-claims"], ["knowledge", "knowledge"]]) {
    const page = read("app/(platform)/platform/" + area + "/page.tsx");
    assert.match(page, /tabs=\{FILTERS\.map/);
    assert.ok(page.includes('baseHref="/platform/' + uri + '"'));
    assert.doesNotMatch(page, /<nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri/);
    assert.match(page, /requirePlatformPermission/);
  }
});
test("PLR5.1 registration status filtering retains its search query", () => {
  const page = read("app/(platform)/platform/registrations/page.tsx");
  assert.match(page, /searchQuery=\{query\}/);
  const controls = read("components/governance-queue-controls.tsx");
  assert.match(controls, /params\.set\("q", searchQuery\.trim\(\)\)/);
  assert.match(controls, /params\.set\("status", value\)/);
});
