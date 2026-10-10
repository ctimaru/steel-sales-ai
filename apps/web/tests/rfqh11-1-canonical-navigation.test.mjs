import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const routes = read("../lib/routes.ts");
const directory = read("../app/(workspace)/marketplace/suppliers/page.tsx");
const detail = read("../app/(workspace)/marketplace/suppliers/[profileId]/page.tsx");
const alias = read("../app/(workspace)/rfq-hub/suppliers/[profileId]/page.tsx");
const actions = read("../app/(workspace)/marketplace/suppliers/actions.ts");
const originalAlias = read("../app/(workspace)/rfq-hub/suppliers/page.tsx");

test("RFQH11.1 routes supplier list and detail through canonical RFQ Hub", () => {
  assert.match(routes, /suppliers: "\/rfq-hub\/suppliers"/);
  assert.match(routes, /supplier: \(id: string\) => `\/rfq-hub\/suppliers\/\$\{id\}`/);
  assert.match(directory, /appRoutes\.rfqHub\.supplier\(supplier\.id\)/);
  assert.match(detail, /appRoutes\.rfqHub\.suppliers/);
  assert.match(detail, /appRoutes\.rfqHub\.campaign\(/);
});

test("RFQH11.1 keeps one secured server implementation for old and new routes", () => {
  assert.match(originalAlias, /marketplace\/suppliers\/page/);
  assert.match(alias, /marketplace\/suppliers\/\[profileId\]\/page/);
  assert.match(detail, /supabase\.rpc\("rfqh11_supplier_detail"/);
  assert.doesNotMatch(alias, /createClient|service_role|fetch\(/);
  assert.match(routes, /supplier: \(id: string\) => `\/marketplace\/suppliers\/\$\{id\}`/);
});

test("RFQH11.1 supplier profile mutations revalidate both canonical and legacy views", () => {
  assert.match(actions, /revalidatePath\(appRoutes\.rfqHub\.suppliers\)/);
  assert.match(actions, /revalidatePath\(appRoutes\.rfqHub\.supplier\(profileId\)\)/);
  assert.match(actions, /revalidatePath\(appRoutes\.marketplace\.supplier\(profileId\)\)/);
  assert.match(actions, /rfqh11_update_supplier_profile/);
});
