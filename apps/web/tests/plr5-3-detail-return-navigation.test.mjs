import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
test("PLR5.3 registration list/detail preserve search and status while retaining RBAC", () => {
 const list=read("app/(platform)/platform/registrations/page.tsx");
 const detail=read("app/(platform)/platform/registrations/[id]/page.tsx");
 assert.match(list,/application\.id\}\?/);
 assert.match(list,/new URLSearchParams/);
 assert.match(detail,/platformQueueReturn\("\/platform\/registrations", status, q\)/);
 assert.match(detail,/requirePlatformPermission\("registrations\.read"\)/);
});
test("PLR5.3 knowledge return links are fixed base URLs and filter allowlisted", () => {
 const list=read("app/(platform)/platform/knowledge/page.tsx");
 const detail=read("app/(platform)/platform/knowledge/[type]/[id]/page.tsx");
 const fn=read("lib/platform-queue-return.ts");
 assert.match(list,/activeStatus \? "\?status="/);
 assert.match(detail,/platformQueueReturn\("\/platform\/knowledge", query\.status\)/);
 assert.match(fn,/allowed\.includes\(status\)/);
 assert.match(fn,/slice\(0, 120\)/);
 assert.doesNotMatch(fn,/redirect\(|window\.|fetch\(/);
});
