import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const proxy = fs.readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
const robots = fs.readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
const schoolHome = fs.readFileSync(new URL("../app/(workspace)/school/page.tsx", import.meta.url), "utf8");
const publicLayout = fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8");

const schoolWrappers = [
  "../app/(workspace)/school/catalogo/page.tsx",
  "../app/(workspace)/school/norme/page.tsx",
  "../app/(workspace)/school/norme/[slug]/page.tsx",
  "../app/(workspace)/school/gradi/page.tsx",
  "../app/(workspace)/school/gradi/[slug]/page.tsx",
  "../app/(workspace)/school/tubes/page.tsx",
  "../app/(workspace)/school/tubes/[slug]/page.tsx",
  "../app/(workspace)/school/tubes/tondo/page.tsx",
  "../app/(workspace)/school/tubes/tondo/[size]/page.tsx",
  "../app/(workspace)/school/tubes/quadro/page.tsx",
  "../app/(workspace)/school/tubes/quadro/[size]/page.tsx",
  "../app/(workspace)/school/tubes/rettangolare/page.tsx",
  "../app/(workspace)/school/tubes/rettangolare/[size]/page.tsx",
].map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8"));

test("UXA2B renames the authenticated macro-space to Scuola", () => {
  assert.match(nav, /label: "Scuola"/);
  assert.doesNotMatch(nav, /label: "Knowledge"/);
  assert.match(routes, /workspace: "\/school"/);
  assert.match(schoolHome, />\s*Scuola\s*</);
  assert.match(schoolHome, /Formazione e conoscenza tecnica/);
});

test("UXA2B keeps Scuola contextual navigation inside authenticated routes", () => {
  for (const routeRef of [
    "appRoutes.knowledge.workspace",
    "appRoutes.knowledge.catalog",
    "appRoutes.knowledge.schoolStandards",
    "appRoutes.knowledge.schoolGrades",
    "appRoutes.knowledge.schoolTubes",
  ]) {
    assert.ok(shell.includes(routeRef), `missing Scuola route reference ${routeRef}`);
  }
  assert.match(nav, /pathname\.startsWith\(appRoutes\.knowledge\.workspace \+ "\/"\)/);
});

test("UXA2B mirrors every public technical route inside the authenticated Scuola shell", () => {
  for (const wrapper of schoolWrappers) {
    assert.match(wrapper, /export \{ default \} from "@\/app\/\(public\)\/knowledge/);
  }
});

test("UXA2B redirects authenticated public-Knowledge navigation back into Scuola", () => {
  assert.match(proxy, /function schoolPathForPublicKnowledge/);
  assert.match(proxy, /pathname === "\/knowledge"/);
  assert.match(proxy, /return "\/school\/catalogo"/);
  assert.match(proxy, /pathname\.startsWith\("\/knowledge\/"\)/);
  assert.match(proxy, /return "\/school" \+ pathname\.slice/);
  assert.match(proxy, /data\?\.claims\?\.sub/);
  assert.match(proxy, /request\.nextUrl\.searchParams\.get\("public"\) !== "1"/);
  assert.match(proxy, /NextResponse\.redirect\(target\)/);
});

test("UXA2B preserves public Scuola as a separate crawlable surface", () => {
  assert.match(routes, /home: "\/knowledge"/);
  assert.match(publicLayout, /index: true/);
  assert.match(publicLayout, /follow: true/);
  assert.doesNotMatch(publicLayout, /AppShell|WorkspaceMobileBottomNavigation/);
  assert.match(robots, /allow: \["\/", "\/azienda", "\/knowledge", "\/knowledge\/"\]/);
  assert.match(robots, /"\/school"/);
  assert.match(robots, /"\/school\/"/);
});
