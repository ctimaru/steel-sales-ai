import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(
  new URL("../app/(public)/knowledge/layout.tsx", import.meta.url),
  "utf8",
);
const action = fs.readFileSync(
  new URL("../components/public-session-action.tsx", import.meta.url),
  "utf8",
);
const proxy = fs.readFileSync(
  new URL("../lib/supabase/proxy.ts", import.meta.url),
  "utf8",
);

test("SI1.2 public Scuola defaults to Accedi and only shows Workspace for an authenticated session", () => {
  assert.match(action, /useState\(false\)/);
  assert.match(action, /supabase\.auth\.getSession\(\)/);
  assert.match(action, /onAuthStateChange/);
  assert.match(action, /Boolean\(data\.session\)/);
  assert.match(action, /authenticated \? "Workspace" : "Accedi"/);
});

test("SI1.2 routes anonymous login back to the private workspace", () => {
  assert.match(action, /authenticated \? "\/dashboard" : "\/login\?next=%2Fdashboard"/);
});

test("SI1.2 uses the auth-aware action in desktop mobile and footer Scuola navigation", () => {
  const matches = layout.match(/<PublicSessionAction/g) ?? [];
  assert.equal(matches.length, 3);
  assert.match(layout, /Trova azienda/);
});

test("SI1.2 preserves authenticated Scuola routing into the private workspace shell", () => {
  assert.match(proxy, /data\?\.claims\?\.sub/);
  assert.match(proxy, /return "\/school\/catalogo"/);
  assert.match(proxy, /request\.nextUrl\.searchParams\.get\("public"\) !== "1"/);
});

test("SI1.2 keeps the public Scuola layout static instead of reading server cookies", () => {
  assert.doesNotMatch(layout, /createClient|getSession|getClaims|cookies\(/);
  assert.match(layout, /PublicSessionAction/);
});
