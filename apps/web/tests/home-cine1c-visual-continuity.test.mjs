import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const it = read("../app/page.tsx");
const en = read("../app/en/page.tsx");
const proof = read("../components/public-steel-geometry-proof.tsx");
const style = read("../components/public-cinematic-continuity.module.css");
const network = read("../components/public-network-role-explorer.tsx");
const pillars = read("../components/public-intelligence-showcase.tsx");
const trust = read("../components/public-registration-trust.tsx");
const deps = JSON.parse(read("../package.json")).dependencies;

test("HOME-CINE1C provides bilingual public geometry and commercial flow proof", () => {
  assert.match(it, /<PublicSteelGeometryProof locale="it" \/>/);
  assert.match(en, /<PublicSteelGeometryProof locale="en" \/>/);
  assert.match(en, /<PublicCinematicAccessBand locale="en" \/>/);
  for (const token of ["CHS", "SHS", "RHS", "EN", "Tondo", "Quadro", "Rettangolare", "Circular", "Square", "Rectangular"]) {
    assert.ok(proof.includes(token), "Missing truthful geometry bilingual proof: " + token);
  }
  assert.match(proof, /Flusso illustrativo · nessun dato aziendale reale/);
  assert.match(proof, /Illustrative flow · no live company data/);
  assert.match(proof, /Specifications/);
  assert.match(proof, /Specifiche/);
  assert.match(proof, /RFQ/);
  assert.match(it, /export const dynamic = "force-static"/);
  assert.match(en, /export const dynamic = "force-static"/);
  assert.match(proof, /aria-labelledby="home-cine-proof-heading"/);
  assert.match(proof, /aria-labelledby="home-cine-access-title"/);
});

test("HOME-CINE1C keeps calculator free, RFQ governed and Network private", () => {
  assert.match(proof, /"\/knowledge\/tubes\?source=home&surface=school_section#calcolatore-pesi"/);
  assert.match(proof, /"\/en\/knowledge\/tubes"/);
  assert.match(proof, /"\/distinta"/);
  assert.match(proof, /"\/en\/distinta"/);
  assert.match(proof, /"\/en\/register"/);
  assert.match(proof, /"\/en\/login"/);
  assert.match(proof, /Sending private RFQs and supplier collaboration follow company access controls/);
  assert.match(proof, /Network access requires separate authorization/);
  assert.match(network, /Privato · Premium/);
  assert.match(network, /abilitazione Network separata/);
  assert.match(trust, /non abilita automaticamente/);
  assert.doesNotMatch(proof, /href="\/network"|href="\/rfq-hub"|tenant_id|supabase|100% automatic|[€$]\s*[0-9]/i);
});

test("HOME-CINE1C uses no hydrated motion, remote media, new runtime or fake KPIs", () => {
  for (const part of [proof, it, en, network, pillars, trust]) {
    assert.doesNotMatch(part, /"use client"|useEffect|useState|onClick=|fetch\s*\(|<video|<iframe|<canvas|autoplay/);
  }
  assert.doesNotMatch(proof, /http:\/\/|https:\/\/|<Image|next\/image|<img/);
  assert.doesNotMatch(style, /@keyframes|animation:|backdrop-filter|scroll-timeline|background-attachment:\s*fixed|url\(https?:\/\//);
  assert.doesNotMatch(JSON.stringify(deps), /three|gsap|framer-motion|lottie|motion\/react/);
  for (const cls of [".proof", ".proofPanel", ".shapeSvg", ".geometries", ".networkSection", ".intelligenceSection", ".trustSection", ".toolSection", ".enWorkflow", ".enNetwork", ".enKnowledge", ".accessBand"]) {
    assert.ok(style.includes(cls), "Missing unified style "+cls);
  }
});

test("HOME-CINE1C retains original useful headings, roles and access disclosures", () => {
  assert.match(pillars, /Tre forme di intelligence. Un solo ecosistema./);
  for (const title of ["Prima utilità, poi prodotto.", "Cercala per nome o Partita IVA."]) assert.ok(it.includes(title));
  for (const title of ["From a steel requirement to a better-informed decision.", "One network, four business profiles.", "Technical knowledge should be easier to find."]) assert.ok(en.includes(title));
  for (const role of ["Commerciante", "Produttore", "Terzista", "Utilizzatore"]) assert.match(network, new RegExp(role));
  assert.match(network, /type="radio"/);
  assert.match(pillars, /Procurement Intelligence/);
  assert.match(pillars, /Network Intelligence/);
  assert.match(pillars, /Steel Knowledge/);
  assert.match(trust, /Fonti, correzioni e rimozioni/);
  assert.match(trust, /Privacy/);
  assert.match(it, /<PublicNetworkRoleExplorer \/>[\s\S]*<PublicIntelligencePillars \/>[\s\S]*<PublicSteelGeometryProof locale="it" \/>/);
  assert.match(en, /<PublicSteelGeometryProof locale="en" \/>[\s\S]*<PublicCinematicAccessBand locale="en" \/>/);
});
