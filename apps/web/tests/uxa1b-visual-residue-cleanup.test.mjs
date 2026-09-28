import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const coreSurfaces = [
  "../app/(workspace)/network/page.tsx",
  "../app/(workspace)/network/[id]/page.tsx",
  "../app/(workspace)/network/manage/page.tsx",
  "../app/(workspace)/marketplace/page.tsx",
  "../app/(workspace)/search/page.tsx",
  "../app/(workspace)/products/page.tsx",
  "../app/(platform)/platform/company-discovery/page.tsx",
  "../app/(platform)/platform/company-claims/page.tsx",
  "../app/(platform)/platform/knowledge/page.tsx",
  "../app/(platform)/platform/knowledge/[type]/[id]/page.tsx",
  "../app/(platform)/platform/network-trust/page.tsx",
  "../app/(platform)/platform/registrations/page.tsx",
  "../app/(platform)/platform/registrations/[id]/page.tsx",
  "../app/(platform)/platform/people/page.tsx",
].map((path) => ({
  path,
  source: fs.readFileSync(new URL(path, import.meta.url), "utf8"),
}));

const supersededBlueTokens = [
  "#2f6fed",
  "#245ed1",
  "#4b82ee",
  "#eaf2ff",
  "#eef5ff",
  "#d7e5ff",
  "#bdd1f4",
  "#f3f7ff",
  "#dbe5f1",
  "#1e2b45",
  "#40516a",
  "#68788e",
  "#91a0b2",
];

test("UXA1B removes superseded steel-blue tokens from high-frequency product surfaces", () => {
  for (const { path, source } of coreSurfaces) {
    for (const token of supersededBlueTokens) {
      assert.doesNotMatch(
        source.toLowerCase(),
        new RegExp(token.replace("#", "\\#")),
        `${path} still contains superseded token ${token}`,
      );
    }
  }
});

test("UXA1B preserves semantic status colors while moving primary actions to forest", () => {
  const joined = coreSurfaces.map((item) => item.source).join("\n");
  assert.match(joined, /#1a5144/i);
  assert.match(joined, /#226657/i);
  assert.match(joined, /emerald|amber|rose|red/i);
});
