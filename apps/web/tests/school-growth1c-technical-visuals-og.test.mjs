import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const data = read("../lib/school-articles.ts");
const home = read("../app/(public)/knowledge/page.tsx");
const index = read("../app/(public)/knowledge/articoli/page.tsx");
const detail = read("../app/(public)/knowledge/articoli/[slug]/page.tsx");
const og = read("../app/api/school-og/[slug]/route.tsx");
const homeOg = read("../app/api/school-og/route.tsx");
const visuals = ["storia-tubi-acciaio", "produttori-tubi-europa", "come-si-producono-tubi-acciaio"];

test("SCHOOL-GROWTH1C: three original technical SVG covers with alternative descriptions", () => {
  assert.match(data, /visual: \{ src: string; alt: string; caption: string \}/);
  for (const slug of visuals) {
    assert.match(data, new RegExp('slug: "'+slug+'"'));
    assert.ok(data.includes('"src":"/school/visuals/'+slug+'.svg"'), "visual route for "+slug);
    const img = read("../public/school/visuals/"+slug+".svg");
    assert.match(img, /<svg[^>]*viewBox="0 0 1200 675"/);
    assert.match(img, /<title id="art-title">/);
    assert.match(img, /<desc id="art-desc">/);
    assert.ok(Buffer.byteLength(img) < 16000, slug+" SVG must stay small");
    assert.doesNotMatch(img, /<script\b|<image\b|xlink:href|\bhref="https?:/i);
  }
  assert.match(data, /non rappresenta sedi, ubicazioni o capacità produttive reali/i);
});

test("SCHOOL-GROWTH1C: mobile-first editorial covers render on all public article entry points", () => {
  for (const s of [home, index, detail]) {
    assert.match(s, /import Image from "next\/image"/);
    assert.match(s, /src=\{article.visual.src\}/);
    assert.match(s, /alt=\{article.visual.alt\}/);
    assert.match(s, /width=\{1200\} height=\{675\}/);
    assert.match(s, /unoptimized/);
    assert.match(s, /sizes="/);
  }
  assert.match(detail, /<figcaption[^>]*>/);
  assert.match(detail, /article.visual.caption/);
  assert.match(detail, /\bpriority\b/);
});

test("SCHOOL-GROWTH1C: verifiable social previews have valid image/png media and 1200x630 dimensions", () => {
  for (const f of [og,homeOg]) {
    assert.match(f, /import \{ ImageResponse \} from "next\/og"/);
    assert.match(f, /"Content-Type": "image\/png"/);
    assert.match(f, /width: 1200, height: 630/);
    assert.match(f, /return new ImageResponse/);
    assert.doesNotMatch(f, /fetch\(|https?:\/\/[^" ]+\.png|fontFile|service_role/);
  }
  assert.match(og, /getSchoolArticle\(slug\)/);
  assert.match(og, /export async function GET/);
  assert.match(homeOg, /export function GET/);
  assert.match(og, /runtime = "nodejs"/);
  assert.match(detail, /\/api\/school-og\/\$\{article.slug\}/);
  assert.match(index, /images: \[\{ url: absoluteUrl\("\/api\/school-og"\)/);
  assert.match(index, /summary_large_image/);
  assert.match(detail, /images: \[\{ url: absoluteUrl\(/);
  assert.match(detail, /card: "summary_large_image"/);
  assert.match(detail, /image: absoluteUrl\(/);
  assert.doesNotMatch(detail, /knowledge\/articoli\/\$\{article.slug\}\/opengraph-image/);
  assert.match(detail, /canonical: absoluteUrl\(/);
  assert.match(detail, /citation: article.sources.map/);
});

test("SCHOOL-GROWTH1C preserves commercial/private and editorial boundaries", () => {
  assert.doesNotMatch(home+index+detail+og+homeOg, /\/network\b|company\_memory|service_role/);
  assert.match(detail, /relatedArticleSlugs/);
  assert.match(detail, /<SchoolHero/);
  assert.match(detail, /source=school&surface=home_card#calcolatore-pesi/);
});
