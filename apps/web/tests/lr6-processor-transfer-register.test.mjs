import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registerPath = new URL("../lib/processor-transfer-register.ts", import.meta.url);
const privacyPath = new URL("../app/privacy/page.tsx", import.meta.url);
const processorPagePath = new URL("../app/privacy/processors/page.tsx", import.meta.url);
const workerEnvPath = new URL("../../../services/worker/.env.example", import.meta.url);
const workerRagPath = new URL("../../../services/worker/app/rag.py", import.meta.url);
const workerEmbeddingsPath = new URL("../../../services/worker/app/embeddings.py", import.meta.url);

const register = fs.readFileSync(registerPath, "utf8");
const privacy = fs.readFileSync(privacyPath, "utf8");
const processorPage = fs.readFileSync(processorPagePath, "utf8");
const workerEnv = fs.readFileSync(workerEnvPath, "utf8");
const workerRag = fs.readFileSync(workerRagPath, "utf8");
const workerEmbeddings = fs.readFileSync(workerEmbeddingsPath, "utf8");

test("LR6 register covers active infrastructure and transfer providers", () => {
  for (const provider of [
    "Supabase",
    "Vercel",
    "Railway",
    "Resend",
    "Google Analytics 4",
    "Hugging Face Inference Providers",
  ]) {
    assert.equal(register.includes('provider: "' + provider + '"'), true, provider + " missing");
  }
  assert.match(register, /PROCESSOR_TRANSFER_REGISTER_VERSION = "2026-10-05-lr6-v1"/);
});

test("LR6 records verified production geography and material third-country transfers", () => {
  assert.match(register, /eu-west-3 \(Paris\)/);
  assert.match(register, /Railway region sfo/);
  assert.match(register, /stored data is held in the United States/);
  assert.match(register, /minimum GA4 user\/event retention setting of 2 months/);
});

test("LR6 fails closed on unresolved routed AI processing", () => {
  assert.match(register, /blocked-for-customer-personal-data/);
  assert.match(register, /pin the production inference provider/);
  assert.match(workerEnv, /RAG_INFERENCE_PROVIDER=/);
  assert.match(workerRag, /InferenceClient\(api_key=token, provider=provider\)/);
  assert.match(workerEmbeddings, /InferenceClient\(api_key=token, provider=provider\)/);
});

test("LR6 public privacy surface links the processor register and does not claim unresolved AI approval", () => {
  assert.match(privacy, /href="\/privacy\/processors"/);
  assert.match(processorPage, /non è approvato per il lancio commerciale/);
  assert.match(processorPage, /PROCESSOR_TRANSFER_REGISTER/);
});

test("LR6 keeps operational tools outside the customer-data path by policy", () => {
  assert.match(register, /provider: "GitHub"[\s\S]*launchState: "operational-only"/);
  assert.match(register, /provider: "Notion"[\s\S]*launchState: "operational-only"/);
  assert.match(register, /Customer Commercial Memory and production personal data must not be committed/);
});
