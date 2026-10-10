import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/english-rfq-bill-builder.tsx", import.meta.url), "utf8");

test("I18N4.1 initial SSR markup keeps RFQ actions disabled until hydrated", () => {
  assert.match(source, /const \[hydrated, setHydrated\] = useState\(false\)/);
  assert.match(source, /useEffect\(\(\) => \{ setHydrated\(true\); \}, \[\]\)/);
  assert.match(source, /onClick=\{addLine\} disabled=\{!hydrated\}/);
  assert.match(source, /onClick=\{\(\) => removeLine\(line.id\)\} disabled=\{!hydrated \|\| lines.length === 1\}/);
  assert.match(source, /disabled=\{!hydrated \|\| invalidCount > 0\} onClick=\{copyRfq\}/);
});

test("I18N4.1 does not alter product calculations or dispatch private RFQs", () => {
  assert.match(source, /estimatePublicTubeMass/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /setLines\(\(current\) => \[\.\.\.current, createLine\(nextId.current\+\+\)\]\)/);
  assert.doesNotMatch(source, /sendRfq|dispatchRfq|createClient\(|fetch\(/);
});
