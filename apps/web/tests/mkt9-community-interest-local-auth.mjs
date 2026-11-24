// Local Supabase only: real Auth-issued access tokens and Data API, synthetic data.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const url=process.env.API_URL, anon=process.env.ANON_KEY, service=process.env.SERVICE_ROLE_KEY;
assert.ok(url && ["http://127.0.0.1:54321","http://localhost:54321"].includes(url),"Local endpoint required");
assert.ok(anon&&service,"Local CLI keys required");
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,service,options);
const table="mkt9_community_interest";
async function user(label,role,status) {
  const email=label+"-"+randomUUID()+"@example.invalid",password=randomUUID()+"aA1!";
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{role:"platform_superadmin"}});
  assert.ifError(error);const id=data.user.id;
  assert.match(id,/^[0-9a-f-]{36}$/);
  if(role) {
    assert.ok(["platform_superadmin","platform_staff"].includes(role));
    assert.ok(["active","revoked"].includes(status));
    execFileSync("psql",["-h","127.0.0.1","-p","54322","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c",
      "insert into public.platform_user_roles(user_id,role,status) values ('"+id+"','"+role+"','"+status+"')"],{env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});
  }
  const client=createClient(url,anon,options);
  const auth=await client.auth.signInWithPassword({email,password});
  assert.ifError(auth.error);assert.ok(auth.data.session?.access_token);
  return client;
}
const owner=await user("owner","platform_superadmin","active"), ordinary=await user("ordinary"),
  revoked=await user("revoked","platform_superadmin","revoked"), staff=await user("staff","platform_staff","active");
const guest=createClient(url,anon,options);
const payload={kind:"partner",locale:"it",name:"Synthetic Partner",email:"partner@example.invalid",organization:"Fixture",notice_version:"mkt9c-draft-2026-11-24",challenge_digest:"a".repeat(64)};
assert.ifError((await admin.from(table).insert(payload)).error);
assert.ifError((await admin.from(table).insert({...payload,kind:"investor",organization:null,challenge_digest:"b".repeat(64)})).error);
assert.equal((await admin.from(table).insert({...payload,name:"Overwrite",challenge_digest:"c".repeat(64)})).error?.code,"23505");
assert.equal((await admin.from(table).insert({...payload,email:"other@example.invalid"})).error?.code,"23505");
assert.ok((await guest.from(table).select("id")).error);
assert.ok((await guest.from(table).insert(payload)).error);
for(const client of [ordinary,revoked,staff]){
  const read=await client.from(table).select("id,name");assert.ifError(read.error);assert.equal(read.data.length,0);
  const update=await client.from(table).update({status:"closed"}).eq("kind","partner").select("id");assert.ifError(update.error);assert.equal(update.data.length,0);
  const del=await client.from(table).delete().eq("kind","partner").select("id");assert.ifError(del.error);assert.equal(del.data.length,0);
  assert.ok((await client.from(table).insert({...payload,email:"third@example.invalid",challenge_digest:"d".repeat(64)})).error);
}
const visible=await owner.from(table).select("id,kind,name,email,organization,status,created_at,expires_at");
assert.ifError(visible.error);assert.equal(visible.data.length,2);
const count=await owner.from(table).select("id",{count:"exact",head:true}).eq("kind","partner");assert.ifError(count.error);assert.equal(count.count,1);
assert.ok((await owner.from(table).select("challenge_digest")).error);
const partner=visible.data.find(x=>x.kind==="partner");assert.equal(partner.name,"Synthetic Partner");
const changed=await owner.from(table).update({status:"contacted"}).eq("id",partner.id).select("id").maybeSingle();assert.ifError(changed.error);assert.equal(changed.data.id,partner.id);
assert.ok((await owner.from(table).update({email:"changed@example.invalid"}).eq("id",partner.id)).error);
const del=await owner.from(table).delete().eq("id",partner.id).select("id").maybeSingle();assert.ifError(del.error);assert.equal(del.data.id,partner.id);
console.log("MKT9C local Supabase Auth/Data API PASS: anon, ordinary, staff, revoked owner, active owner, service insert, dedup and lifecycle. Synthetic fixture only.");
