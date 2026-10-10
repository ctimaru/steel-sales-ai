import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
test("PLR5.5 mobile filters retain 44px touch targets and constrained horizontal scroll", () => {
 const controls=read("components/governance-queue-controls.tsx");
 assert.match(controls,/min-h-11/);
 assert.match(controls,/max-w-full snap-x snap-mandatory/);
 assert.match(controls,/overflow-x-auto overscroll-x-contain/);
 assert.match(controls,/focus-visible:outline/);
 assert.match(controls,/platform-selected-solid/);
 assert.match(controls,/aria-current=\{active \? "page"/);
});
test("PLR5.5 row density is responsive without removing keyboard focus", () => {
 const rows=read("lib/governance-row-contract.ts");
 assert.match(rows,/p-3 sm:p-5/);
 assert.match(rows,/focus-visible:outline/);
});
