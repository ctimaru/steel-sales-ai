import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const site = fs.readFileSync(new URL("../lib/site.ts", import.meta.url), "utf8");
const envExample = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const loginActions = fs.readFileSync(new URL("../app/login/actions.ts", import.meta.url), "utf8");
const verifyActions = fs.readFileSync(new URL("../app/verify-email/actions.ts", import.meta.url), "utf8");

test("D1 makes smartsteelsales.com the canonical public origin", () => {
  assert.match(site, /https:\/\/smartsteelsales\.com/);
  assert.doesNotMatch(site, /steel-sales-ai\.vercel\.app/);
  assert.match(envExample, /NEXT_PUBLIC_SITE_URL=https:\/\/smartsteelsales\.com/);
});

test("D1 pins production auth redirects to the canonical site URL", () => {
  for (const source of [loginActions, verifyActions]) {
    assert.match(source, /import \{ siteUrl \} from "@\/lib\/site"/);
    assert.match(source, /process\.env\.VERCEL_ENV === "production"/);
    assert.match(source, /return siteUrl/);
  }
  assert.match(loginActions, /\/auth\/finish\?signup=1/);
  assert.match(loginActions, /\/auth\/finish\?recovery=1/);
  assert.match(verifyActions, /\/auth\/finish\?signup=1/);
});
