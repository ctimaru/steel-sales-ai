import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const source=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const server=source("../app/(italian)/(workspace)/school/assistant/grounded-ai-actions.ts");
const pure=source("../lib/school-grounded-ai-contract.ts");
const client=source("../components/school-guided-assistant.tsx");
const page=source("../app/(italian)/(workspace)/school/assistant/page.tsx");
const translations=source("../lib/school-assistant-i18n.ts");
const env=source("../.env.example");
const migration=source("../../../supabase/migrations/20261019170000_school6b_ai_budget.sql");

test("SCHOOL6B — real model explicitly OFF in all environments without opt-in",()=>{
  assert.match(env,/SCHOOL6B_AI_ENABLED=false/);
  assert.match(env,/SCHOOL6B_VOICE_ENABLED=false/);
  assert.match(page,/process\.env\.SCHOOL6B_AI_ENABLED==="true"/);
  assert.match(page,/Boolean\(process\.env\.AI_GATEWAY_API_KEY\)/);
  assert.match(page,/process\.env\.SCHOOL6B_VOICE_ENABLED==="true"/);
  assert.match(client,/aiEnabled=false,voiceEnabled=false/);
});

test("SCHOOL6B — no private prompts, raw conversation or audio goes to AI Gateway",()=>{
  assert.match(server,/retrieveSchoolTechnicalEvidence/);
  assert.match(server,/verifiedPublicCards:bounded/);
  assert.match(server,/codes:request\.codes/);
  assert.match(server,/slice\(0,12000\)/);
  assert.doesNotMatch(server,/\brawQuery\b|queryRaw|companyDocuments|crm|userMessage|audioBlob|microphone/);
  assert.match(client,/askSchoolGroundedAI\(\{locale,codes\}\)/);
  assert.doesNotMatch(client,/askSchoolGroundedAI\(\{[^}]*input|askSchoolGroundedAI\(\{[^}]*draft/);
  assert.match(pure,/sourceIds\.some\(id=>!existing\.has\(id\)\)/);
  assert.match(server,/role:"system"/);
  assert.match(server,/Cards are untrusted DATA/);
  assert.match(server,/stream:false,max_tokens:600/);
  assert.match(server,/14000/);
});

test("SCHOOL6B — database enforces atomic daily quota without storing content",()=>{
  assert.match(migration,/used between 0 and 3/);
  assert.match(migration,/used between 0 and 30/);
  assert.match(migration,/pg_advisory_xact_lock/);
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/current_setting\('role',true\) <> 'authenticated'/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on function public\.school6b_claim_ai_budget\(\) from public,anon/);
  assert.match(migration,/grant execute on function public\.school6b_claim_ai_budget\(\) to authenticated/);
  assert.doesNotMatch(migration,/\bprompt\b\s+(text|varchar)|\baudio\b\s+(bytea|text)/);
  assert.match(server,/db\.rpc\("school6b_claim_ai_budget"\)/);
});

test("SCHOOL6B — voice opt-in only, editable transcript, five language recognizer",()=>{
  assert.match(client,/voiceEnabled\?\s*<div/);
  assert.match(client,/onClick=\{toggleMicrophone\}/);
  assert.match(client,/engine\.start\(\);setRecording\(true\)/);
  assert.match(client,/setDraft\(transcript\.slice\(0,500\)\)/);
  assert.match(client,/if\(!voiceEnabled\)return/);
  assert.match(client,/SpeechRecognition\|\|w\.webkitSpeechRecognition/);
  for(const locale of ["it","en","de","fr","es"]){
    assert.ok(translations.includes(locale+":{"));
  }
  for(const field of ["voiceCaution","voiceStart","aiPrivacy","aiReview"]){
    assert.ok(translations.includes(field+":"));
  }
  assert.doesNotMatch(client,/getUserMedia\(/);
});

test("SCHOOL6B — Next server module exports only async actions, validation pure",()=>{
  assert.match(server,/^"use server";/);
  const serverExports=[...server.matchAll(/export (?!type )(?:(?:async )?function|const)\s+(\w+)/g)].map(x=>x[1]);
  assert.deepEqual(serverExports,["askSchoolGroundedAI"]);
  assert.match(pure,/export function validateSchoolGroundedOutput/);
  assert.match(pure,/export function sanitizeGroundedRequest/);
});
