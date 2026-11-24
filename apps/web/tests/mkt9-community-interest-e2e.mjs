// Isolated browser -> real application server actions -> local Supabase -> real inbox markup.
// Only synthetic addresses and a fake provider. Never run against a hosted project.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createClient } from "@supabase/supabase-js";
const root=path.resolve(process.cwd()),require=createRequire(import.meta.url);
const url=process.env.API_URL,anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY;
assert.ok(["http://127.0.0.1:54321","http://localhost:54321"].includes(url));
assert.ok(anon&&service);
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:url,NODE_ENV:"test",MKT9_COMMUNITY_DATABASE_URL:"postgresql://mkt9_intake_writer:fixture-only-writer@127.0.0.1:54322/postgres",MKT9_COMMUNITY_OTP_SECRET:"fixture-only-hmac-key-not-for-production",MKT9_TURNSTILE_SECRET:"fixture",RESEND_API_KEY:"fixture",MKT9_COMMUNITY_EMAIL_FROM:"fixture@example.invalid",MKT9_COMMUNITY_CRM_TRANSFER_APPROVED:"false"});
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,service,options),owner=createClient(url,anon,options);
const email="owner-"+randomUUID()+"@example.invalid",password=randomUUID()+"Aa1!";
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);
const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
execFileSync("psql",["-h","127.0.0.1","-p","54322","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c","insert into public.platform_user_roles(user_id,role,status) values ('"+uid+"','platform_superadmin','active')"],{env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});
assert.ifError((await owner.auth.signInWithPassword({email,password})).error);
let enabled=false,store=new Map(),mail=[],captchaOK=true,ownerAllowed=true;
const jar={get:k=>store.has(k)?{value:store.get(k)}:undefined,set:(k,v)=>store.set(k,v),delete:k=>store.delete(k)};
const realFetch=globalThis.fetch;
globalThis.fetch=async (input,init)=>{
 const u=typeof input==="string"?input:input.url||String(input);
 if(u==="https://challenges.cloudflare.com/turnstile/v0/siteverify")return Response.json({success:captchaOK,hostname:"fixture.invalid",action:"community_interest"});
 if(u==="https://api.resend.com/emails"){const payload=JSON.parse(init.body);assert.ok(payload.to.every(e=>e.endsWith("@example.invalid")));mail.push(payload);return Response.json({id:"fixture"});}
 if(u.startsWith(url+"/"))return realFetch(input,init);
 throw Error("Unexpected outbound request");
};
const config={communityNoticeVersion:"mkt9c-draft-2026-11-24",communityIntakeConfig:()=>({enabled,siteKey:"fixture",hostname:"fixture.invalid"}),communityPath:(l,k)=>(l==="en"?"/en/project/interest":"/progetto/interesse")+"?kind="+k};
const cache=new Map();
function load(relative){
 if(cache.has(relative))return cache.get(relative).exports;
 const mod={exports:{}};cache.set(relative,mod);
 const file=path.join(root,relative);
 const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const req=n=>{
  if(n==="next/link")return {__esModule:true,default:({href,children,...props})=>React.createElement("a",{href,...props},children)};
  if(n==="next/script")return {__esModule:true,default:()=>null};
  if(n==="next/headers")return {cookies:async()=>jar};
  if(n==="next/navigation")return {redirect:target=>{throw Object.assign(Error("redirect"),{target});}};
  if(n==="next/cache")return {revalidatePath:()=>{}};
  if(n==="server-only")return {};
  if(n==="@/lib/community-intake-config")return config;
  if(n==="@/lib/platform-admin")return {requirePlatformSuperadmin:async()=>{if(!ownerAllowed)throw Error("Owner required");}};
  if(n==="@/lib/supabase/server")return {createClient:async()=>owner};
  if(n==="@/components/pending-submit-button")return {PendingSubmitButton:({children,className})=>React.createElement("button",{type:"submit",className},children)};
  if(n==="@/components/confirm-submit-button")return {ConfirmSubmitButton:({children,className})=>React.createElement("button",{type:"submit",className},children)};
  if(n.startsWith("@/lib/"))return load(n.slice(2)+".ts");
  return require(n);
 };
 new Function("require","module","exports",code)(req,mod,mod.exports);return mod.exports;
}
const {submitCommunityInterest,confirmCommunityEmail}=load("lib/community-intake-actions.ts");
const {CommunityInterestPage}=load("components/community-interest-page.tsx");
const {CommunityInterestInbox}=load("components/community-interest-inbox.tsx");
const cssFile=path.join(root,"app/globals.css");
const css=(await postcss([tailwind({base:root})]).process(fs.readFileSync(cssFile,"utf8"),{from:cssFile})).css;
const formData=async req=>{let raw="";for await(const c of req)raw+=c;const f=new FormData();for(const [k,v] of new URLSearchParams(raw))f.append(k,v);return f;};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,"http://localhost");
  if(req.method==="POST"){
   const f=await formData(req);
   try{await (u.pathname==="/submit"?submitCommunityInterest:confirmCommunityEmail)(f);throw Error("Missing redirect");}
   catch(e){if(!e.target)throw e;res.writeHead(303,{Location:e.target});res.end();return;}
  }
  const en=u.pathname.startsWith("/en"),kind=u.searchParams.get("kind")==="investor"?"investor":"partner";
  const element=u.pathname==="/inbox"?await CommunityInterestInbox({}):await CommunityInterestPage({locale:en?"en":"it",kind,result:u.searchParams.get("result")||undefined});
  // React server action transport is adapted only for this isolated harness.
  let html=renderToStaticMarkup(element);
  html=html.replace(/<form\b[^>]*data-testid="community-interest-form"[^>]*>/, '<form method="post" action="/submit" data-testid="community-interest-form">')
   .replace(/<form\b[^>]*data-testid="community-email-code"[^>]*>/,'<form method="post" action="/confirm" data-testid="community-email-code">');
  if(html.includes('data-testid="community-interest-form"'))html=html.replace("</form>",'<input type="hidden" name="cf-turnstile-response" value="'+randomUUID()+'"/></form>');
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end("<!doctype html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><style>"+css+"</style></head><body>"+html+"</body></html>");
 }catch(e){res.writeHead(500);res.end("Fixture failed");console.error("Fixture server failure",e.message);}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.route("**/*",r=>r.request().url().startsWith(base+"/")?r.continue():r.abort());
 const page=await ctx.newPage();
 await page.goto(base+"/progetto/interesse?kind=partner");
 assert.equal(await page.getByTestId("community-interest-form").count(),0);
 enabled=true;
 for(const [locale,kind] of [["it","partner"],["en","investor"]]){
  store.clear();mail=[];const entry=config.communityPath(locale,kind),addr=kind+"-"+randomUUID()+"@example.invalid";
  await page.goto(base+entry+"&result=received");assert.equal(await page.getByTestId("community-interest-form").count(),1);
  await page.locator('input[name=name]').fill("Synthetic "+kind);
  await page.locator('input[name=email]').fill(addr);
  await page.locator('input[name=organization]').fill(kind==="partner"?"Synthetic Steel":"");
  await page.locator('input[name=privacy]').check();
  await page.getByTestId("community-interest-form").getByRole("button").click();
  await page.waitForURL(/result=verify$/);
  assert.equal(mail.length,1);
  const code=mail[0].text.match(/\b\d{8}\b/)[0];
  const before=await owner.from("mkt9_community_interest").select("id").eq("email",addr);assert.ifError(before.error);assert.equal(before.data.length,0);
  await page.locator('input[name=code]').fill(code==="00000000"?"11111111":"00000000");
  await page.getByTestId("community-email-code").getByRole("button").click();await page.waitForURL(/result=verify-error$/);
  await page.locator('input[name=code]').fill(code);
  await page.getByTestId("community-email-code").getByRole("button").click();await page.waitForURL(/result=received$/);
  assert.ok(await page.getByRole("status").count());
  await page.goto(base+"/inbox");
  const card=page.locator("article").filter({hasText:addr});
  assert.equal(await card.count(),1);assert.match(await card.innerText(),/Email verificata/);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));}
  await page.setViewportSize({width:390,height:844});
 }
 ownerAllowed=false;await assert.rejects(()=>CommunityInterestInbox({}),/Owner required/);
 console.log("MKT9C3 browser/action/local Supabase/inbox PASS (synthetic provider, adapted transport)");
 await ctx.close();
}finally{await browser.close();await new Promise(r=>server.close(r));globalThis.fetch=realFetch;}
