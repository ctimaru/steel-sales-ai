import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const brand = fs.readFileSync(new URL("../components/product-brand.tsx", import.meta.url), "utf8");
const identity = fs.readFileSync(new URL("../lib/product-identity.ts", import.meta.url), "utf8");
const publicHome = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const companyShell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const platformShell = fs.readFileSync(new URL("../components/platform-shell.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");

test("UX2 keeps industrial identity but aligns application tokens to the light steel-blue system", () => {
  for (const token of [
    "--brand-950: #14233f",
    "--brand-700: #245ed1",
    "--brand-500: #4b82ee",
    "--copper-500: #c36e32",
    "--background: #f5f7fb",
    "--foreground: #1e2b45",
    "--primary: #2f6fed",
  ]) assert.ok(globals.includes(token), `missing token ${token}`);
  assert.match(globals, /\.app-surface/);
  assert.match(globals, /\.app-primary/);
});

test("UI1 brand remains lightweight and rebrandable from one identity contract", () => {
  assert.match(identity, /name: "Steel Sales AI"/);
  assert.match(identity, /marketLine: "B2B intelligence for steel & tube"/);
  assert.match(brand, /productIdentity\.name/);
  assert.match(brand, /productIdentity\.descriptor/);
  assert.doesNotMatch(brand, /<img|next\/image|svg/i);
});

test("UI1 applies the same product identity to public, Company and Platform contexts", () => {
  assert.match(publicHome, /ProductBrand/);
  assert.match(companyShell, /ProductBrand/);
  assert.match(platformShell, /ProductBrand/);
});

test("UI1 keeps the public landing fast and asset-light", () => {
  assert.doesNotMatch(publicHome, /<img|next\/image|video|iframe/i);
  assert.doesNotMatch(publicHome, /animate-|transition-all/);
  assert.match(publicHome, /B2B intelligence for steel & tube/);
});

test("UX2 preserves task-dense Company Home behavior without making search the hero", () => {
  assert.match(dashboard, /Il centro operativo della tua azienda/);
  assert.match(dashboard, /Oggi nel workspace/);
  assert.match(dashboard, /Commercial Memory/);
  assert.match(dashboard, /Spazi condivisi/);
  assert.match(dashboard, /Marketplace/);
  assert.match(dashboard, /Knowledge/);
  assert.match(dashboard, /metric-number/);
  assert.doesNotMatch(dashboard, /<form action=\{appRoutes\.commercial\.search\}/);
});
