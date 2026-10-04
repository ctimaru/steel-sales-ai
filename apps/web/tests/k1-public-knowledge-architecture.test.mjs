import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicKnowledge = fs.readFileSync(
  new URL("../app/(public)/knowledge/page.tsx", import.meta.url),
  "utf8",
);
const publicKnowledgeLayout = fs.readFileSync(
  new URL("../app/(public)/knowledge/layout.tsx", import.meta.url),
  "utf8",
);
const publicTubeWeights = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);
const workspaceLayout = fs.readFileSync(
  new URL("../app/(workspace)/layout.tsx", import.meta.url),
  "utf8",
);
const robots = fs.readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const root = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");

test("K1 public Knowledge does not depend on tenant workspace context", () => {
  assert.match(workspaceLayout, /getWorkspaceContext/);
  assert.doesNotMatch(publicKnowledge + publicKnowledgeLayout + publicTubeWeights, /getWorkspaceContext/);
  assert.doesNotMatch(publicKnowledge + publicKnowledgeLayout + publicTubeWeights, /requireWorkspace/);
  assert.doesNotMatch(publicKnowledge, /createClient|force-dynamic|canonicalWeights|missingWeights/);
});

test("K1 public Knowledge is crawlable while private product areas are excluded", () => {
  assert.match(robots, /allow: \["\/", "\/azienda", "\/knowledge", "\/knowledge\/"\]/);
  for (const privatePath of [
    "/dashboard",
    "/commercial/",
    "/operations/",
    "/company/",
    "/platform/",
    "/network",
    "/marketplace",
  ]) {
    assert.match(robots, new RegExp(privatePath.replaceAll("/", "\\/")));
  }
  assert.match(sitemap, /absoluteUrl\("\/knowledge"\)/);
  assert.match(sitemap, /absoluteUrl\("\/knowledge\/tubes"\)/);
});

test("K1 establishes metadata and canonical URLs for public Knowledge", () => {
  assert.match(publicKnowledge, /export const metadata/);
  assert.match(publicKnowledge, /canonical: absoluteUrl\("\/knowledge"\)/);
  assert.match(publicTubeWeights, /canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(publicKnowledgeLayout, /index: true/);
  assert.match(publicKnowledgeLayout, /follow: true/);
});

test("K1 makes public Knowledge discoverable from the product while preserving private data boundaries", () => {
  assert.match(root, /href="\/knowledge"/);
  assert.match(root, /Scuola/);
  assert.match(root, /Utile anche senza account/);
  assert.match(shell, /appRoutes\.knowledge\.catalog/);
  assert.match(shell, /Catalogo tecnico/);
  assert.match(nav, /label: "Scuola"/);
  assert.match(publicKnowledge, /consultabile senza account/);
  assert.match(publicKnowledge, /separat[oa] dai dati commerciali privati/);
  assert.match(routes, /tubesStandards: "\/company\/tools\/tubi-norme"/);
});

test("K1 avoids exposing authenticated reference tables directly to the public surface", () => {
  assert.doesNotMatch(publicKnowledge + publicTubeWeights, /steel_standards|steel_material_grades|steel_weight_references|service_role/);
  assert.match(publicTubeWeights, /Calcolo peso tubo acciaio/);
  assert.match(publicTubeWeights, /PublicTubeWeightCalculator/);
  assert.doesNotMatch(publicTubeWeights, /company\/tools\/tubi-norme/);
});
