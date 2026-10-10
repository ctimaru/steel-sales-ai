import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");

test("NETG1.2 pending applicant sees only public tools, not private workspace activation", () => {
 const page = read("app/registration/status/page.tsx");
 assert.match(page, /application\.application_status !== "activated"/);
 assert.match(page, /Strumenti gratuiti disponibili/);
 assert.match(page, /href="\/knowledge"/);
 assert.match(page, /href="\/distinta"/);
 assert.match(page, /non richiedono l&apos;attivazione del workspace privato/);
 assert.doesNotMatch(page, /create_organization_for_current_user/);
});
test("NETG1.2 account access still requires company membership before dashboard", () => {
 const login = read("app/login/actions.ts");
 assert.match(login, /if \(!membership\)/);
 assert.match(login, /redirect\(application \? "\/registration\/status" : "\/register"\)/);
 assert.match(login, /lr5_account_lifecycle_state/);
});
