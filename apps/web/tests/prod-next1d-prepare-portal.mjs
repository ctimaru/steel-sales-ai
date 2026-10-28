/**
 * PROD-NEXT1.D — short-lived supplier capabilities for a SINGLE buyer-created RFQ.
 * Local disposable GitHub Actions Supabase only. No external sends, token logs or URLs.
 */
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
const temp = process.env.RUNNER_TEMP;
assert.ok(temp && path.isAbsolute(temp), "Ephemeral GitHub runner required");
assert.equal(process.env.DEMOTEST23_WEB_URL, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.RESEND_API_KEY ?? "", "");
const personas = JSON.parse(readFileSync(path.join(temp,"demotest23-personas.json"),"utf8"));
assert.ok(personas.some(x=>x.id==="buyer") && personas.some(x=>x.id==="producer"));
const tokens={};
const vars=[];
for(const name of ["producer","trader"]){
  const token=randomBytes(32).toString("hex");
  tokens[name]={token};
  vars.push("\\set next1d_"+name+"_hash '"+createHash("sha256").update(token).digest("hex")+"'");
}
for(const [file,data] of [["prod-next1d-tokens.json",JSON.stringify(tokens)],
  ["prod-next1d-psql-vars.sql",vars.join("\n")+"\n"]]){
  const target=path.join(temp,file);
  writeFileSync(target,data,{mode:0o600});
  chmodSync(target,0o600);
}
console.log("PROD-NEXT1.D ephemeral local supplier capabilities generated; token contents withheld");
