import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = text => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const handoffSource = read("../lib/calculator-rfq-handoff.ts");
const buyerSource = read("../lib/buyer-distinta.ts");
const source = read("../lib/calculator-inline-distinta.ts");

// Execute the actual pure modules, injecting the same existing buyer engine and
// validated calculator handoff rather than stubbing calculation semantics.
const handoff = await import("data:text/javascript;base64," +
  Buffer.from(compile(handoffSource)).toString("base64"));
const withoutImports = code => code.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gmu, "");
const buyer = new Function(withoutImports(compile(buyerSource)).replace(/^export /gmu, "") +
  "\nreturn {calculateBuyerDistintaLine,calculateBuyerDistintaTotals};")();
const inline = new Function("validatedCalculatorRfqItem", "calculatorItemToBuyerLine",
  "calculateBuyerDistintaLine", "calculateBuyerDistintaTotals",
  withoutImports(compile(source)).replace(/^export /gmu, "") +
  "\nreturn {emptyInlineDistinta,addInlineDistintaItem,editInlineDistintaLine," +
  "duplicateInlineDistintaLine,removeInlineDistintaLine,inlineDistintaTotals," +
  "inlineDistintaBuyerLines,serializeInlineDistinta,parseInlineDistinta," +
  "readInlineDistintaSession,persistInlineDistintaSession," +
  "INLINE_DISTINTA_SESSION_KEY,INLINE_DISTINTA_TTL_MS,INLINE_DISTINTA_MAX_LINES};"
)(handoff.validatedCalculatorRfqItem, handoff.calculatorItemToBuyerLine,
  buyer.calculateBuyerDistintaLine, buyer.calculateBuyerDistintaTotals);

const now = Date.UTC(2026, 9, 16, 10, 0, 0);
const example = (id, patch = {}) => handoff.calculatorRfqFromValues({
  family: "rectangular_tube", standard: "en10219",
  outerDiameter: "", width: "120", height: "80", thickness: "5",
  quantity: "7", length: "12", kgM: 13.71, density: "7850", ...patch,
}, id, now);
const store = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    keys: () => [...values.keys()],
  };
};

test("4.4A: adding three tube shapes/standards produces canonical buyer rows and correct shared totals", () => {
  const original = inline.emptyInlineDistinta();
  const a = inline.addInlineDistintaItem(original, example("calc-rect-01"), now);
  const b = inline.addInlineDistintaItem(a.state, example("calc-round-02", {
    family: "round_tube", outerDiameter: "168.3", width: "", height: "",
    thickness: "6", standard: "en10210", kgM: 24.015, quantity: "4",
  }), now);
  const c = inline.addInlineDistintaItem(b.state, example("calc-square03", {
    family: "square_tube", width: "100", height: "", thickness: "5",
    standard: "geometric", density: "7850", kgM: 14.89, quantity: "10",
  }), now);
  assert.equal(a.ok, true); assert.equal(b.ok, true); assert.equal(c.ok, true);
  assert.deepEqual(original, { lines: [] }, "pure operations never mutate caller");
  const rows = c.state.lines;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.standard), ["EN 10219","EN 10210","Calcolo geometrico libero"]);
  assert.ok(rows[0].description.includes("120 × 80 × 5"));
  assert.ok(rows[1].description.includes("Ø 168.3 × 6"));
  assert.ok(rows[2].description.includes("100 × 100 × 5"));
  assert.ok(rows.every(row => row.targetEurT === "" && row.grade === ""));
  const totals = inline.inlineDistintaTotals(c.state);
  const canonical = buyer.calculateBuyerDistintaTotals(rows.map(buyer.calculateBuyerDistintaLine));
  assert.deepEqual(totals, canonical);
  assert.equal(totals.completeLines, 3);
  assert.equal(totals.totalMeters, (7+4+10)*12);
  assert.equal(inline.inlineDistintaBuyerLines(c.state).length, 3);
});

test("4.4A: repeated add same ID is idempotently rejected; explicit duplicate/new item are independent", () => {
  const item = example("calc-repeat01");
  const first = inline.addInlineDistintaItem(inline.emptyInlineDistinta(), item, now);
  assert.equal(first.ok, true);
  const second = inline.addInlineDistintaItem(first.state, item, now);
  assert.equal(second.ok, false);
  assert.equal(second.reason, "duplicate");
  assert.strictEqual(second.state, first.state);
  const dup = inline.duplicateInlineDistintaLine(first.state, item.id, "line-clone01");
  assert.equal(dup.ok, true);
  const edit = inline.editInlineDistintaLine(dup.state, "line-clone01", {
    quantity: "3", grade: "S355J2H", note: "Richiesta lavorazione",
  });
  assert.equal(edit.ok, true);
  assert.equal(edit.state.lines[0].quantity, "7");
  assert.equal(edit.state.lines[0].grade, "");
  assert.equal(edit.state.lines[1].quantity, "3");
  assert.equal(edit.state.lines[1].grade, "S355J2H");
  assert.equal(edit.state.lines[1].targetEurT, "");
  assert.equal(inline.removeInlineDistintaLine(edit.state, item.id).state.lines.length, 1);
  assert.equal(inline.removeInlineDistintaLine(edit.state, "missing-row").reason, "missing");
  assert.equal(inline.duplicateInlineDistintaLine(dup.state, item.id, "line-clone01").reason, "duplicate");
});

test("4.4A: invalid input, stale calculator item, unsafe edits and partial rows never enter state", () => {
  const start = inline.emptyInlineDistinta();
  assert.equal(inline.addInlineDistintaItem(start, example("calc-age-000"), now+handoff.CALC_RFQ_HANDOFF_TTL_MS+1).reason, "invalid");
  assert.equal(inline.addInlineDistintaItem(start, example("calc-bad-000", {quantity:"1.5"}), now).reason, "invalid");
  assert.equal(inline.addInlineDistintaItem(start, example("calc-bad-001", {thickness:"50"}), now).reason, "invalid");
  const first = inline.addInlineDistintaItem(start, example("calc-good001"), now);
  assert.equal(first.ok, true);
  for (const patch of [
    { quantity: "0" }, { quantity: "2.5" }, { quantity: "Infinity" },
    { weightKgM: "500" }, { standard: "EN 10210" },
    { targetEurT: "850" }, { description: "Changed geometry" },
    { barLengthM: "-12" }, { grade: "x".repeat(101) },
    { quantityMode: "wrong" },
  ]) {
    const result = inline.editInlineDistintaLine(first.state, first.state.lines[0].id, patch);
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.equal(result.reason, "invalid");
    assert.strictEqual(result.state, first.state);
  }
  const meters = inline.editInlineDistintaLine(first.state, first.state.lines[0].id, {
    quantityMode: "meters", quantity: "3,5",
  });
  assert.equal(meters.ok, true);
  assert.equal(inline.inlineDistintaTotals(meters.state).totalMeters, 3.5);
  const tonnes = inline.editInlineDistintaLine(first.state, first.state.lines[0].id, {
    quantityMode: "tonnes", quantity: "0,75",
  });
  assert.equal(tonnes.ok, true);
  assert.equal(inline.inlineDistintaTotals(tonnes.state).totalTonnes, 0.75);
});

test("4.4A: session is namespaced, bounded, read-only until explicit save and TTL guarded", () => {
  const state = inline.addInlineDistintaItem(inline.emptyInlineDistinta(), example("calc-store01"), now).state;
  const s = store();
  s.setItem("smart-steel-sales:buyer-distinta:v1:guest", "pre-existing buyer draft");
  s.setItem(handoff.CALC_RFQ_HANDOFF_KEY, "pre-existing calculator handoff");
  assert.equal(inline.readInlineDistintaSession(s, now), null);
  assert.equal(inline.persistInlineDistintaSession(s, state, now), true);
  assert.deepEqual(s.keys().sort(), [
    "smart-steel-sales:buyer-distinta:v1:guest", handoff.CALC_RFQ_HANDOFF_KEY,
    inline.INLINE_DISTINTA_SESSION_KEY,
  ].sort());
  const raw = s.getItem(inline.INLINE_DISTINTA_SESSION_KEY);
  assert.deepEqual(inline.readInlineDistintaSession(s, now), state);
  assert.equal(inline.parseInlineDistinta(raw, now + inline.INLINE_DISTINTA_TTL_MS + 1), null);
  assert.equal(inline.parseInlineDistinta(raw, now - 60_001), null);
  assert.equal(inline.parseInlineDistinta("{", now), null);
  assert.equal(inline.parseInlineDistinta(raw.repeat(2000), now), null);
  assert.equal(inline.parseInlineDistinta(JSON.stringify({version:2,savedAt:now,lines:state.lines}), now), null);
  assert.equal(inline.persistInlineDistintaSession(s, inline.emptyInlineDistinta(), now), true);
  assert.equal(s.getItem(inline.INLINE_DISTINTA_SESSION_KEY), null);
  assert.equal(s.getItem("smart-steel-sales:buyer-distinta:v1:guest"), "pre-existing buyer draft");
});

test("4.4A: tampered session price, unknown fields, duplicate rows or excessive lines are rejected", () => {
  const state = inline.addInlineDistintaItem(inline.emptyInlineDistinta(), example("calc-safe-001"), now).state;
  const body = JSON.parse(inline.serializeInlineDistinta(state, now));
  const parse = patch => inline.parseInlineDistinta(JSON.stringify({...body,...patch}), now);
  assert.equal(parse({ lines:[{...body.lines[0],targetEurT:"850"}] }), null);
  assert.equal(parse({ lines:[{...body.lines[0],secretPrice:850}] }), null);
  assert.equal(parse({ lines:[{...body.lines[0],grade:{unsafe:"value"}}] }), null);
  assert.equal(parse({ lines:[body.lines[0],body.lines[0]] }), null);
  assert.equal(parse({ lines:new Array(inline.INLINE_DISTINTA_MAX_LINES+1).fill(body.lines[0]) }), null);
  assert.equal(parse({ lines:[{...body.lines[0],quantity:"2.5"}] }), null);
  assert.equal(inline.serializeInlineDistinta({lines:[{...body.lines[0],targetEurT:"900"}]},now), null);
  assert.equal(inline.inlineDistintaBuyerLines({lines:[{...body.lines[0],targetEurT:"900"}]}), null);
  const failedStorage = {getItem(){throw Error("disabled")},setItem(){throw Error("denied")},removeItem(){throw Error("denied")}};
  assert.equal(inline.readInlineDistintaSession(failedStorage,now),null);
  assert.equal(inline.persistInlineDistintaSession(failedStorage,state,now),false);
});

test("4.4A: bounded at 50 lines with stable IDs; no supplier dispatch, URL, login, pricing or network IO", () => {
  let state = inline.addInlineDistintaItem(inline.emptyInlineDistinta(), example("calc-seed-001"), now).state;
  for(let index=1;index<inline.INLINE_DISTINTA_MAX_LINES;index++) {
    const copied=inline.duplicateInlineDistintaLine(state,"calc-seed-001",`line-${String(index).padStart(5,"0")}`);
    assert.equal(copied.ok,true);
    state=copied.state;
  }
  assert.equal(state.lines.length,50);
  assert.equal(inline.inlineDistintaTotals(state).completeLines,50);
  assert.equal(inline.addInlineDistintaItem(state,example("calc-full-001"),now).reason,"full");
  assert.equal(inline.duplicateInlineDistintaLine(state,"calc-seed-001","line-extra01").reason,"full");
  assert.equal(inline.inlineDistintaBuyerLines(state).length,50);
  assert.doesNotMatch(source,/fetch\(|\.supabase|localStorage|document\.cookie|window\.location|sendBuyerDistinta|createBuyerRfqCampaign/);
  assert.match(source,/targetEurT: ""/);
  assert.match(source,/calculatorItemToBuyerLine/);
  assert.match(source,/calculateBuyerDistintaTotals/);
  assert.match(source,/INLINE_DISTINTA_SESSION_KEY/);
});
