import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const component = fs.readFileSync(
  new URL("../components/public-company-lookup.tsx", import.meta.url),
  "utf8",
);
const route = fs.readFileSync(
  new URL("../app/api/public/company-lookup/route.ts", import.meta.url),
  "utf8",
);
const legacyAction = fs.readFileSync(
  new URL("../app/public-company-lookup-actions.ts", import.meta.url),
  "utf8",
);

test("HP2.2b public lookup no longer depends on React Server Actions", () => {
  assert.doesNotMatch(component, /useActionState/);
  assert.doesNotMatch(component, /formAction/);
  assert.match(component, /onSubmit=\{handleSubmit\}/);
  assert.match(component, /fetch\("\/api\/public\/company-lookup"/);
});

test("HP2.2b route handler accepts FormData and always returns a bounded JSON state", () => {
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /queryPublicCompany/);
  assert.match(route, /status: "error", mode: null, items: \[\]/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(route, /status: 200/);
});

test("HP2.2b client contains local network and payload recovery", () => {
  assert.match(component, /if \(!response\.ok\)/);
  assert.match(component, /catch \{/);
  assert.match(component, /setState\(\{ status: "error", mode: null, items: \[\] \}\)/);
  assert.match(component, /Array\.isArray\(payload\.items\)/);
});

test("HP2.2b legacy server action remains a thin compatibility wrapper only", () => {
  assert.match(legacyAction, /return queryPublicCompany/);
  assert.doesNotMatch(legacyAction, /supabase\.rpc/);
});
