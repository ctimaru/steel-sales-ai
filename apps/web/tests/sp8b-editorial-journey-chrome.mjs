import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE=process.env.SP8A_WEB_URL;
assert.equal(BASE,"http://127.0.0.1:3000","Only ephemeral browser target allowed");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
const temp=process.env.RUNNER_TEMP;assert.ok(temp);
const users=JSON.parse(fs.readFileSync(path.join(temp,"sp8a-users.json"),"utf8"));
const editor=users.find(x=>x.id==="editor"),reviewer=users.find(x=>x.id==="reviewer");
assert.ok(editor&&reviewer&&editor.user_id!==reviewer.user_id);
const ITEM="00000000-0000-0000-0000-000000008b11";
const URL=BASE+"/platform/steel-pulse/workflow";
const output=path.join(temp,"sp8a-visual-evidence");
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
async function login(page,actor){
 await page.goto(BASE+"/login",{waitUntil:"domcontentloaded"});
 await page.locator('input[name="email"]').fill(actor.email);
 await page.locator('input[name="password"]').fill(actor.password);
 await page.getByRole("button",{name:"Accedi",exact:true}).click();
 await page.waitForURL(u=>u.pathname!=="/login",{timeout:60000});
}
async function openItem(page){
 await page.goto(URL,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByRole("heading",{name:"Steel Pulse · Bozze e revisioni"}).waitFor({timeout:60000});
 await page.locator('a[href*="item="]').filter({hasText:"SP8.B Synthetic Editorial Source"}).first().click();
 await page.getByRole("heading",{name:"Scheda e prossima azione"}).waitFor({timeout:30000});
}
async function capture(page,label){
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width===1440?900:800});
  await page.waitForTimeout(150);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=1,label+": horizontal overflow "+overflow+" at "+width);
  await page.screenshot({path:path.join(output,"sp8b-"+label+"-"+width+".png"),fullPage:true,animations:"disabled"});
 }
}
async function clientFor(actor){
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
 assert.ifError(error);return client;
}
try {
 const ectx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
 const e=await ectx.newPage();await login(e,editor);await openItem(e);
 await e.getByRole("button",{name:"Salva bozza privata"}).waitFor();
 const stale=await ectx.newPage();await openItem(stale);
 const fill=async(page)=>{
  await page.locator('input[name="headline"]').fill("SP8B sintesi industriale originale e verificabile");
  await page.locator('textarea[name="summary"]').fill("Questo esempio sintetico descrive un segnale industriale senza citare eventi reali, dati riservati o notizie attive.");
  await page.locator('textarea[name="relevance"]').fill("Permette di verificare il flusso di lavoro tra autore e revisore senza alcuna pubblicazione.");
 };
 await fill(e);await capture(e,"editor-draft");
 await e.getByRole("button",{name:"Salva bozza privata"}).click();
 await e.waitForURL(u=>u.searchParams.get("outcome")==="saved",{timeout:45000});
 await e.getByText("Bozza salvata privatamente.").waitFor();
 await fill(stale);await stale.getByRole("button",{name:"Salva bozza privata"}).click();
 await stale.waitForURL(u=>u.searchParams.get("outcome")==="denied",{timeout:45000});
 console.log("SP8.B PASS stale draft revision refused");
 await e.getByRole("button",{name:"Invia a revisione indipendente"}).waitFor();
 await e.locator('textarea[name="reason"]').fill("Revisione editoriale indipendente richiesta per il test sintetico.");
 await e.getByRole("button",{name:"Invia a revisione indipendente"}).click();
 await e.waitForURL(u=>u.searchParams.get("outcome")==="submitted",{timeout:45000});
 const eclient=await clientFor(editor);
 const {data:submitted,error:detailErr}=await eclient.rpc("sp3_editorial_detail",{p_item_id:ITEM});
 assert.ifError(detailErr);assert.equal(submitted.card.status,"in_review");
 assert.equal(submitted.card.authored_by,editor.user_id);
 const {error:selfError}=await eclient.rpc("sp3_decide",{
   p_card_id:submitted.card.id,p_revision:submitted.card.revision,
   p_action:"editor_approve",p_evidence_url:"https://example.org/test-fact-check",
   p_reason:"Self review is forbidden in the synthetic acceptance test"
 });
 assert.ok(selfError,"Author must not approve own draft by direct RPC");
 console.log("SP8.B PASS author cannot self approve");

 const rctx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
 const r=await rctx.newPage();await login(r,reviewer);await openItem(r);
 await r.getByRole("button",{name:"Approva fact-check (non pubblica)"}).waitFor();
 assert.equal(await r.getByRole("button",{name:"Salva bozza privata"}).count(),0);
 await capture(r,"reviewer-factcheck");
 await r.locator('input[name="evidence"]').fill("https://example.org/test-fact-check");
 await r.locator('textarea[aria-label="Motivazione fact-check"]').fill("Controllato contenuto sintetico ed evidenza fittizia nell'ambiente temporaneo.");
 await r.getByRole("button",{name:"Approva fact-check (non pubblica)"}).click();
 await r.waitForURL(u=>u.searchParams.get("outcome")==="approved",{timeout:45000});
 const rclient=await clientFor(reviewer);
 const {data:verified,error:verifyErr}=await rclient.rpc("sp3_editorial_detail",{p_item_id:ITEM});
 assert.ifError(verifyErr);
 assert.equal(verified.card.status,"editor_approved");
 assert.equal(verified.card.editor_reviewed_by,reviewer.user_id);
 assert.equal(verified.source.rights_valid_now,false);
 assert.equal(verified.card.published_at,null);
 assert.deepEqual(verified.history.slice(0,3).map(x=>x.event),["editor_approved","submitted","draft_saved"]);
 assert.equal(await r.getByRole("button",{name:/Pubblica/}).count(),0);
 await capture(r,"reviewed-private");
 console.log("SP8.B PASS draft -> submit -> independent fact-check -> private approved, 1440/390/320");
 await rctx.close();await ectx.close();
}finally{await browser.close();}
