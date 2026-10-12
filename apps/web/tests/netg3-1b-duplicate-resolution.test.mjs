import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("NETG3.1b duplicate decision requires an audit note and exact identity", () => {
  const actions = read("app/(platform)/platform/company-discovery/actions.ts");
  assert.match(actions, /if \(decision === "duplicate_existing"\)/);
  assert.match(actions, /note\.length < 12/);
  assert.match(actions, /p3_admin_discovery_detail/);
  assert.match(actions, /normalize\(candidate\.legal_name\) !== normalize\(existing\.legal_name\)/);
  assert.match(actions, /candidate\.canonical_domain\.toLowerCase\(\) !== existing\.website_domain\?\.toLowerCase\(\)/);
  assert.match(actions, /requirePlatformPermission\("discovery\.review"\)/);
  assert.match(actions, /p3_review_company_discovery/);
});

test("NETG3.1b reviewer must acknowledge duplicate resolution in governance UI", () => {
  const page = read("app/(platform)/platform/company-discovery/page.tsx");
  assert.match(page, /name="note" required minLength=\{12\}/);
  assert.match(page, /Conferma identità duplicata/);
  assert.match(page, /name="existing_company_id"/);
});
