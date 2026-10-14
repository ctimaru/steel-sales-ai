import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=read("../app/(italian)/(workspace)/review/page.tsx");
const confirm=read("../components/review-confirm-form.tsx");
const correct=read("../components/review-correct-form.tsx");
const runner=read("./rqg42-company-review-a11y-chrome.mjs");
const workflow=read("../../../.github/workflows/perf1-chrome-auth.yml");
const fixture=read("../../../supabase/tests/rqg31_local_fixture.sql");

test("RQG4.2 accessible Company Review retains server-side admin boundary and own evidence",()=>{
  assert.match(page,/requireWorkspaceAdmin\(\)/);
  assert.match(page,/getReviewItems\(\)/);
  assert.match(page,/role="group" aria-label=\{\`Revisione \$\{flag\.id\}/);
  assert.match(page,/<h2 className="mt-3 break-words/);
  assert.match(page,/overflow-wrap:anywhere/);
  assert.match(page,/minmax\(0,1fr\)/);
  assert.match(page,/ReviewConfirmForm id=\{flag.id\}/);
  assert.match(page,/ReviewCorrectForm id=\{flag.id\}/);
  assert.doesNotMatch(page,/\/platform\/review|service_role|\.insert\(|\.update\(|\.delete\(/);
});

test("RQG4.2 all correction fields have accessible names and mobile touch targets",()=>{
  const fields=["grade","standard","material_number","outer_diameter_mm",
    "thickness_mm","width_mm","height_mm","length_mm","quantity","quantity_unit",
    "price_value","price_unit","currency","discount_percentage",
    "availability_status","note"];
  for(const name of fields){
    const input=correct.match(new RegExp('name="'+name+'"[^>]*'));
    assert.ok(input, "Missing field "+name);
    assert.match(input[0],/aria-label="[^"]+"/,"Missing label for "+name);
  }
  assert.match(correct,/grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.match(correct,/focus-visible:outline/);
  assert.match(confirm,/min-h-11/);
  assert.match(confirm,/focus-visible:outline/);
  assert.match(correct,/min-h-11/);
  assert.match(correct,/bg-amber-800/);
  assert.match(correct,/aria-busy=\{pending\}/);
  assert.match(confirm,/aria-busy=\{pending\}/);
});

test("RQG4.2 runs isolated browser role/keyboard/viewport/contrast checks before local mutations",()=>{
  assert.match(runner,/assert.equal\(process.env.PERF1_WEB_URL,BASE/);
  assert.match(runner,/54321/);
  assert.match(runner,/endsWith\("@example.test"\)/);
  for(const role of ["buyer","trader","buyerViewer","platformStaff","owner"]){
    assert.ok(runner.includes('"'+role+'"'),"Role coverage missing: "+role);
  }
  assert.match(runner,/RQG31 PRIVATE A/);
  assert.match(runner,/RQG31 PRIVATE B/);
  assert.match(runner,/getByRole\("textbox"/);
  assert.match(runner,/keyboard\.press\("Enter"\)/);
  assert.match(runner,/for\(const width of \[320,390,768,1440\]\)/);
  assert.match(runner,/ratio>=4\.5/);
  assert.match(runner,/\/platform\/review/);
  assert.doesNotMatch(runner,/https:\/\/www\.smartsteelsales\.com|auth\.admin|\.insert\(|\.update\(|\.delete\(/);
  assert.match(fixture,/RQG31 PRIVATE A/);
  assert.match(fixture,/RQG31 PRIVATE B/);
  assert.match(workflow,/node tests\/rqg42-company-review-a11y-chrome.mjs/);
  assert.ok(workflow.indexOf("node tests/rqg42-company-review-a11y-chrome.mjs")<
    workflow.indexOf("node tests/rqg31-chrome-multi-role.mjs"));
  assert.match(workflow,/supabase stop --no-backup/);
});
