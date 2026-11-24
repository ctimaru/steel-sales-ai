import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const view=read("../components/public-project-page.tsx");
const it=read("../app/(italian)/progetto/page.tsx");
const en=read("../app/(english)/en/project/page.tsx");
const nav=read("../components/public-home-navigation.tsx");
const sitemap=read("../app/sitemap.ts");
test("MKT9B bilingual public project routes are discoverable and canonical",()=>{
  assert.match(it,/<PublicProjectPage locale="it"/);
  assert.match(en,/<PublicProjectPage locale="en"/);
  for(const source of [it,en,nav,sitemap]) {
    assert.ok(source.includes("/progetto"));
    assert.ok(source.includes("/en/project"));
  }
});
test("MKT9B separates partner contact from existing investor route; no funds or private data",()=>{
  assert.match(view,/mailto:hello@smartsteelsales\.com/);
  assert.match(view,/\/en\/investors/);
  assert.match(view,/\/investitori/);
  assert.match(view,/Nessun pagamento richiesto/);
  assert.match(view,/No payment is requested/);
  assert.match(view,/non tutte le funzionalità sono disponibili oggi/);
  assert.match(view,/not all capabilities are available today/);
  assert.doesNotMatch(view,/supabase|mkt9-investor-deck-candidate|investor-outreach|<form|checkout|service.role/i);
});
