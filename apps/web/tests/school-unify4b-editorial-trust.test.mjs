import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const localeSource=read("../lib/localized-steel-knowledge.ts");
const sourceAnchor="export const MARKET_TECHNICAL_RECORDS=";
const dataStart=localeSource.indexOf(sourceAnchor)+sourceAnchor.length;
const dataEnd=localeSource.indexOf(" as const satisfies",dataStart);
assert.ok(dataStart>sourceAnchor.length&&dataEnd>dataStart,"Editorial source catalog missing");
const catalog=JSON.parse(localeSource.slice(dataStart,dataEnd));
const detail=read("../app/(international-calculator)/[locale]/knowledge/[kind]/[slug]/page.tsx");
const listing=read("../app/(international-calculator)/[locale]/knowledge/[kind]/page.tsx");
const home=read("../components/school-international-references.tsx");
const seo=read("../app/sitemap.ts");
const ux=read("../components/school-technical-editorial-trust.tsx");
const trust=read("../lib/school-technical-editorial-trust.ts");
const navigation=read("../components/school-unified-navigation.tsx");
const expectedStandards=["en-10210","en-10219","en-10216-2","en-10217-1","en-10217-2","en-10224"];
const expectedGrades=["s355j2h","p265gh","s355nh","s355nlh","p235gh","16mo3","p235tr1","p235tr2","p265tr1","p265tr2"];

test("SCHOOL-UNIFY4B complete source-backed 6 standards x 10 grades per DE/FR/ES",()=>{
  for(const locale of ["de","fr","es"]){
    for(const [kind,expected] of [["standards",expectedStandards],["grades",expectedGrades]]){
      const values=catalog[locale][kind];
      assert.equal(values.length,expected.length,locale+" "+kind+" item count");
      assert.deepEqual(values.map(x=>x.slug).sort(),expected.slice().sort());
      for(const article of values){
        assert.equal(article.code.replace(/\s+/g,"").toLowerCase().replaceAll("-",""),article.slug.replace("en-","en").replaceAll("-",""),locale+" "+article.slug+" slug/code parity");
        for(const field of ["title","summary","covers","request","caution","source"]){
          assert.ok(article[field]&&article[field].length>25,locale+" "+article.slug+" "+field);
        }
        assert.ok(/^https:\/\/(landingpage\.bsigroup\.com|knowledge\.bsigroup\.com|accord-checkout\.bsigroup\.com|shop-checkout\.bsigroup\.com|store\.uni\.com)\//.test(article.source),
          "only known publisher domains: "+article.source);
        assert.doesNotMatch(article.summary+article.covers+article.request+article.caution,/\bASTM\s*(?:A|B)\d+\s*=\s*EN\b/i);
      }
    }
  }
});

test("SCHOOL-UNIFY4B canonical published-only contracts and original multilingual docs remain unchanged",()=>{
  assert.match(detail,/if\(!copy\)notFound\(\)/);
  assert.match(detail,/if\(!published\)notFound\(\)/);
  assert.match(listing,/published\.has\(x\.slug\)/);
  assert.match(seo,/if\(!record\)return\[\]/);
  assert.match(detail,/TECHNICAL_RELATED_SLUGS\[group\]\[slug\]/);
  assert.match(detail,/allowed\.has\(x\.slug\)/);
  assert.match(detail,/SchoolEditorialTrust/);
  assert.match(detail,/SchoolTechnicalGlossary/);
  assert.match(listing,/SchoolTechnicalGlossary/);
  assert.match(detail,/published\.last_reviewed_at/);
  assert.match(ux,/recordLastReviewed/);
  assert.match(ux,/SCHOOL_EDITORIAL_DRAFT_DATE/);
  assert.match(trust,/not a date when localized copy was reviewed/);
  assert.match(trust,/not statements of material equivalence/);
  assert.match(home,/filter\(x=>availableStandards\.has\(x.slug\)\)/);
  assert.match(home,/filter\(x=>availableGrades\.has\(x.slug\)\)/);
  assert.match(home,/visibleStandardNames/);
  assert.match(home,/visibleGradeNames/);
  assert.match(navigation,/localizedKnowledgePath\(locale,"standards"\)/);
  assert.match(navigation,/localizedKnowledgePath\(locale,"grades"\)/);
  assert.doesNotMatch(detail+listing+seo,/service_role|supabaseAdmin|private_docs|k2_private/);
});

test("SCHOOL-UNIFY4B research categories distinguish manufacturing route and product scope",()=>{
 for(const locale of ["de","fr","es"]){
  const all=catalog[locale].standards;
  const room=all.find(x=>x.slug==="en-10217-1");
  const hot=all.find(x=>x.slug==="en-10217-2");
  const water=all.find(x=>x.slug==="en-10224");
  assert.ok(room&&hot&&water);
  assert.notEqual(room.source,hot.source);
  assert.notEqual(room.source,water.source);
  for(const g of ["p235tr1","p235tr2","p265tr1","p265tr2"])
    assert.equal(catalog[locale].grades.find(x=>x.slug===g)?.source,room.source);
 }
 for(const source of ["TR1 / TR2","CHS / SHS / RHS","EN 10204"])assert.ok(trust.includes(source));
 assert.match(seo,/SCHOOL_EDITORIAL_DRAFT_DATE/);
});
