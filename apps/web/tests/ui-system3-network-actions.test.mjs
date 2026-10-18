import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const base = new URL("../components/", import.meta.url);
const sources = [
  "network-activation-cta.tsx",
  "network-company-growth-entry.tsx",
  "network-access-gate.tsx",
];
test("UI-SYSTEM3 Network actions use the shared semantic action contract", () => {
  for (const name of sources) {
    const content = readFileSync(new URL(name, base), "utf8");
    assert.match(content, /import \{ actionClasses \} from "@\/components\/ui\/button"/);
    assert.match(content, /actionClasses\(\{ variant:/);
  }
});
test("UI-SYSTEM3 removes hardcoded action color pairs from migrated surfaces", () => {
  const merged = sources.map(name => readFileSync(new URL(name, base), "utf8")).join("\n");
  assert.doesNotMatch(merged, /bg-\[#1a6048\]/);
  assert.doesNotMatch(merged, /bg-\[#f0f7f2\]/);
  assert.doesNotMatch(merged, /platform-primary inline-flex/);
});
