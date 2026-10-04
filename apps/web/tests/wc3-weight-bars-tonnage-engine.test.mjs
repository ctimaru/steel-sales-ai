import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);

test("WC3 preserves the forward commercial mass engine", () => {
  assert.match(calculator, /const kgM =/);
  assert.match(calculator, /const kgBar = kgM != null && l != null \? kgM \* l : null/);
  assert.match(calculator, /const totalKg = kgBar != null && qty != null \? kgBar \* qty : null/);
  assert.match(calculator, /const totalTonnes = totalKg != null \? totalKg \/ 1000 : null/);
  assert.match(calculator, /const totalMeters = l != null && qty != null \? l \* qty : null/);
});

test("WC3 calculates whole-bar requirements from a target tonnage", () => {
  assert.ok(calculator.includes('const [targetTonnes, setTargetTonnes] = useState("");'));
  assert.match(calculator, /const targetBarsExact =/);
  assert.match(calculator, /\(targetT \* 1000\) \/ kgBar/);
  assert.match(calculator, /Math\.ceil\(targetBarsExact\)/);
  assert.match(calculator, /const targetActualTonnes = targetActualKg != null \? targetActualKg \/ 1000 : null/);
});

test("WC3 exposes a target-tonnage commercial workflow", () => {
  assert.match(calculator, /Parti dalle tonnellate/);
  assert.match(calculator, /Tonnellate target/);
  assert.match(calculator, /Barre necessarie/);
  assert.match(calculator, /Tonnellate reali/);
  assert.match(calculator, /Usa barre suggerite/);
  assert.match(calculator, /arrotondiamo sempre per eccesso/);
});

test("WC3 lets users adjust bar quantity without retyping the field", () => {
  assert.match(calculator, /aria-label="Riduci di una barra"/);
  assert.match(calculator, /aria-label="Aumenta di una barra"/);
  assert.match(calculator, /setQuantity\(String\(Math\.max\(1, current - 1\)\)\)/);
  assert.match(calculator, /setQuantity\(String\(current \+ 1\)\)/);
});

test("WC3 makes total linear meters visible alongside mass outputs", () => {
  assert.match(calculator, /Metri totali/);
  assert.match(calculator, /values\.totalMeters/);
  assert.match(calculator, /sm:grid-cols-3/);
});
