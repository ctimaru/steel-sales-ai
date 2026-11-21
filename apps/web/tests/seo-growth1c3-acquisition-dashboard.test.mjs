import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const content = readFileSync(new URL("../components/acquisition-funnel-dashboard.tsx", import.meta.url), "utf8");
test("funnel view contains no client-side credentials or fetch", () => {
  assert.doesNotMatch(content, /fetch\(|useEffect\(|NEXT_PUBLIC_.*(TOKEN|KEY)|service_role/);
  assert.match(content, /buildOrganicFunnel\(dataset\)/);
});
test("view labels cross-source limitations and does not claim completions", () => {
  assert.match(content, /tutte le sorgenti/);
  assert.match(content, /non significano completamento/);
  assert.match(content, /non disponibile, non zero/);
});
