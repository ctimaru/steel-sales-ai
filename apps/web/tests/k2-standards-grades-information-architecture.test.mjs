import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const standardsIndex = fs.readFileSync(new URL("../app/(public)/knowledge/norme/page.tsx", import.meta.url), "utf8");
const standardDetail = fs.readFileSync(new URL("../app/(public)/knowledge/norme/[slug]/page.tsx", import.meta.url), "utf8");
const gradesIndex = fs.readFileSync(new URL("../app/(public)/knowledge/gradi/page.tsx", import.meta.url), "utf8");
const gradeDetail = fs.readFileSync(new URL("../app/(public)/knowledge/gradi/[slug]/page.tsx", import.meta.url), "utf8");
const data = fs.readFileSync(new URL("../lib/public-knowledge.ts", import.meta.url), "utf8");
const publicClient = fs.readFileSync(new URL("../lib/supabase/public.ts", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("K2 defines stable public URL families for standards and grades", () => {
  assert.match(routes, /standards: "\/knowledge\/norme"/);
  assert.match(routes, /standard: \(slug: string\) =>/);
  assert.match(routes, /grades: "\/knowledge\/gradi"/);
  assert.match(routes, /grade: \(slug: string\) =>/);
  assert.match(home, /href: "\/knowledge\/norme"/);
  assert.match(home, /href: "\/knowledge\/gradi"/);
});

test("K2 indexes are useful without exposing internal catalog state", () => {
  assert.match(standardsIndex, /Cosa tratta ogni norma/);
  assert.match(standardsIndex, /tipo di evidenza/);
  assert.match(gradesIndex, /Cosa significano le sigle dei gradi di acciaio/);
  assert.match(gradesIndex, /evitando equivalenze automatiche/);
  assert.doesNotMatch(standardsIndex + gradesIndex, /service_role|source_locator|knowledge_source_id|page_status/);
});

test("K2 detail templates preserve applicability semantics", () => {
  assert.match(standardDetail, /applicabilityLabel/);
  assert.match(standardDetail, /grade\.is_normative/);
  assert.match(standardDetail, /gamma produttore o fornitore non viene/);
  assert.match(gradeDetail, /applicabilityLabel/);
  assert.match(gradeDetail, /standard\.is_normative/);
  assert.match(gradeDetail, /non equivale automaticamente a sostituibilità/);
  assert.match(gradeDetail, /Stesso numero materiale/);
});

test("K2 public frontend reads only through anonymous-safe RPC contracts", () => {
  for (const rpc of [
    "k2_public_knowledge_standards",
    "k2_public_knowledge_standard",
    "k2_public_knowledge_grades",
    "k2_public_knowledge_grade",
  ]) assert.match(data, new RegExp(rpc));
  assert.match(publicClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(publicClient, /SERVICE_ROLE|service_role/);
  assert.doesNotMatch(data, /\.from\("steel_/);
});

test("K2 sitemap includes indexes and only dynamically published detail slugs", () => {
  assert.match(sitemap, /absoluteUrl\("\/knowledge\/norme"\)/);
  assert.match(sitemap, /absoluteUrl\("\/knowledge\/gradi"\)/);
  assert.match(sitemap, /listPublicStandards/);
  assert.match(sitemap, /listPublicGrades/);
  assert.match(sitemap, /standard\.slug/);
  assert.match(sitemap, /grade\.slug/);
});
