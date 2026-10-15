import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/international-tube-mass.ts");
const ui = read("../components/public-tube-weight-calculator.tsx");
const enBill = read("../components/english-rfq-bill-builder.tsx");
const handoff = read("../lib/calculator-rfq-handoff.ts");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const mass = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
const close = (actual,expected) =>
  assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-11,
    `Expected ${expected} but received ${actual}`);

// Independent equations frozen from the pre-CALC-INT2 live calculator.
// Golden comparisons prevent any silent change to published kg/m values.
function legacyArea({shape,standard,outerDiameterMm:d,widthMm:b,heightMm:h,thicknessMm:t}) {
  if(shape==="round") return Math.PI*t*(d-t);
  const width=b;
  const height=shape==="square"?b:h;
  if(standard==="geometric") return width*height-(width-2*t)*(height-2*t);
  const ro=standard==="en10210"?1.5*t:t<=6?2*t:t<=10?2.5*t:3*t;
  const ri=standard==="en10210"?t:t<=6?t:t<=10?1.5*t:2*t;
  return 2*t*(width+height-2*t)-(4-Math.PI)*(ro**2-ri**2);
}

const dimensions=[
  {shape:"round",outerDiameterMm:168.3,thicknessMm:6.3},
  {shape:"square",widthMm:100,thicknessMm:5},
  {shape:"rectangular",widthMm:120,heightMm:80,thicknessMm:5},
  {shape:"rectangular",widthMm:120,heightMm:80,thicknessMm:6},
  {shape:"rectangular",widthMm:120,heightMm:80,thicknessMm:6.01},
  {shape:"rectangular",widthMm:120,heightMm:80,thicknessMm:10},
  {shape:"rectangular",widthMm:120,heightMm:80,thicknessMm:10.01},
];

test("CALC-INT2 one engine matches the original geometry across shapes and nominal radius boundaries",()=>{
  for(const d of dimensions) for(const standard of ["en10219","en10210","geometric"]){
    const input={...d,standard,lengthM:12,bars:7,densityKgM3:standard==="geometric"?8000:7850};
    const result=mass.estimatePublicTubeMass(input);
    const section=mass.calculateTubeSection(input);
    assert.equal(result.ok,true,JSON.stringify(input));
    assert.equal(section.ok,true,JSON.stringify(input));
    const area=legacyArea(input);
    const rho=standard==="geometric"?8000:7850;
    close(result.areaMm2,area);
    close(result.weightKgM,area*rho/1_000_000);
    close(result.weightKgBar,area*rho/1_000_000*12);
    close(result.totalKg,area*rho/1_000_000*12*7);
    close(result.totalTonnes,area*rho/1_000_000*12*7/1000);
    close(result.totalMeters,84);
    close(section.areaMm2,result.areaMm2);
    close(section.weightKgM,result.weightKgM);
    assert.equal(section.estimated,true);
    assert.equal(result.estimated,true);
    assert.equal(section.standardAreaMm2===null,standard==="geometric");
  }
});

test("CALC-INT2 standard density is fixed, free mode is custom and totals are finite",()=>{
  const input={shape:"square",standard:"en10219",widthMm:100,thicknessMm:5,lengthM:6,bars:20};
  const fixed=mass.estimatePublicTubeMass({...input,densityKgM3:8100});
  const defaultDensity=mass.estimatePublicTubeMass(input);
  assert.deepEqual(fixed,defaultDensity);
  assert.equal(fixed.densityKgM3,7850);
  const free=mass.estimatePublicTubeMass({...input,standard:"geometric",densityKgM3:8100});
  assert.equal(free.densityKgM3,8100);
  assert.notEqual(fixed.weightKgM,free.weightKgM);
});

test("CALC-INT2 enforces shape, dimensions, quantity, density and overflow guards",()=>{
  const base={shape:"round",standard:"en10219",outerDiameterMm:88.9,
    thicknessMm:5,lengthM:12,bars:10};
  for(const patch of [
    {shape:"unknown"},{standard:"en10220"},{outerDiameterMm:10},
    {thicknessMm:0},{thicknessMm:NaN},{outerDiameterMm:Infinity},
    {lengthM:0},{bars:0},{bars:1.5},{bars:Infinity},
    {standard:"geometric",densityKgM3:0},
    {standard:"geometric",densityKgM3:50000},
    {lengthM:1e308,bars:1e6},
  ]){
    const input={...base,...patch};
    assert.equal(mass.estimatePublicTubeMass(input).ok,false,JSON.stringify(patch));
  }
  assert.equal(mass.calculateTubeSection({...base,outerDiameterMm:10}).ok,false);
  assert.ok(Number.isNaN(mass.parseTubeNumber("1.234,5")));
  assert.equal(mass.parseTubeNumber("168,3"),168.3);
});

test("CALC-INT2 keeps the live UI and RFQ bill on the one engine",()=>{
  assert.match(ui,/import \{ calculateTubeSection \} from "@\/lib\/international-tube-mass"/);
  assert.match(ui,/const section = !error && t != null/);
  assert.match(ui,/const kgM = validSection\?\.weightKgM \?\? null/);
  assert.doesNotMatch(ui,/function standardRectangularAreaMm2\(/);
  assert.doesNotMatch(ui,/freeAreaMm2 = Math\.PI/);
  assert.match(enBill,/estimatePublicTubeMass\(/);
  assert.match(handoff,/CALC_RFQ_HANDOFF_KEY = "sss:calc-rfq-handoff:v1"/);
  assert.match(ui,/enqueueCalculatorRfq\(window\.sessionStorage, item\)/);
  assert.match(ui,/window\.location\.assign\(locale === "en" \? "\/en\/distinta" : "\/distinta"\)/);
  assert.doesNotMatch(source,/window\.|localStorage|sessionStorage|fetch\(|supabase|createClient\(/);
});
