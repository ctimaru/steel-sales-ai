import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const server = readFileSync(path.join(root, "lib/price-list-explorer-server.ts"), "utf8");
const investor = readFileSync(path.join(root, "lib/business-plan-investor-copy.ts"), "utf8");

test("TRUST-AUDIT1C.2B blocks inactive private price lists", () => {
  assert.match(server, /getPrivateLabPriceListExplorerVersion\([\s\S]*?\.from\("price_lists"\)/);
  assert.match(server, /\.eq\("status", "active"\)/);
  assert.match(server, /statusError \|\| !activeList/);
  assert.match(server, /getPrivateLabPriceListExplorerItems\([\s\S]*?getPrivateLabPriceListExplorerVersion\(versionId\)/);
});

test("Investor biography is employer-neutral in both languages", () => {
  assert.match(investor, /direct commercial sales experience in the steel-tube sector/);
  assert.match(investor, /esperienza commerciale diretta nel settore dei tubi in acciaio/);
});
