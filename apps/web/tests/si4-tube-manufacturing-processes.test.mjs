import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const articleData = fs.readFileSync(new URL("../lib/school-articles.ts", import.meta.url), "utf8");
const articleDetail = fs.readFileSync(
  new URL("../app/(public)/knowledge/articoli/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const schoolHome = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("SI4 publishes the manufacturing article with four distinct production routes", () => {
  for (const term of [
    'slug: "come-si-producono-tubi-acciaio"',
    "HFI / ERW",
    "SAW — grandi diametri",
    "Seamless — dal pieno al corpo cavo",
    "Cold drawn — quando serve più precisione",
    "Rotary piercing",
    "Submerged Arc Welding",
    "Trafila e mandrino",
  ]) {
    assert.ok(articleData.includes(term), term);
  }
});

test("SI4 avoids the simplistic welded-bad seamless-good hierarchy", () => {
  const renderedContract = articleData + "\n" + articleDetail;
  for (const term of [
    "seamless è sempre migliore",
    "saldato è sempre meno sicuro",
    "La conformità dipende dalla specifica tecnica applicabile",
    "Quindi: saldato o seamless?",
  ]) {
    assert.ok(renderedContract.includes(term), term);
  }
});

test("SI4 renders process-flow and comparison visuals without client-only code", () => {
  assert.match(articleDetail, /article\.processFlows/);
  assert.match(articleDetail, /article\.comparison/);
  assert.match(articleDetail, /md:grid-cols-5/);
  assert.match(articleDetail, /school-table-head/);
  assert.ok(articleDetail.includes("Saldato vs seamless: cosa cambia davvero"));
  assert.doesNotMatch(articleDetail, /"use client"/);
});

test("SI4 links process choices to standards grades and dimensions already in Scuola", () => {
  for (const href of [
    "/knowledge/norme?q=EN%2010216",
    "/knowledge/norme?q=EN%2010217",
    "/knowledge/norme?q=EN%2010219",
    "/knowledge/norme?q=EN%2010210",
    "/knowledge/norme?q=EN%2010305",
    "/knowledge/gradi?q=S355",
    "/knowledge/gradi?q=P265",
    "/knowledge/tubes",
  ]) {
    assert.ok(articleData.includes(href), href);
  }
});

test("SI4 carries primary industrial and standards sources", () => {
  for (const source of [
    "Mannesmann Line Pipe",
    "Tenaris",
    "Corinth Pipeworks",
    "ArcelorMittal",
    "voestalpine Rotec",
    "UNI — EN 10216-1",
    "UNI — EN 10217-1",
    "UNI — EN 10219-1",
    "UNI — EN 10210-1",
  ]) {
    assert.ok(articleData.includes(source), source);
  }
});

test("SI4 inherits canonical sitemap coverage and is visible from the Scuola home", () => {
  assert.match(sitemap, /schoolArticles\.map/);
  assert.ok(sitemap.includes("/knowledge/articoli/"));
  assert.match(articleDetail, /canonical: absoluteUrl/);
  assert.match(schoolHome, /schoolArticles\.slice\(0, 3\)/);
});

test("SI4 remains public editorial knowledge and does not expose the private Network", () => {
  assert.doesNotMatch(articleDetail, /href="\/network/);
  assert.doesNotMatch(articleData, /private_email|private_phone|commercial_memory|relationship_score/);
});
