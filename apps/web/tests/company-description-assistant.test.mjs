import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/company-description-assistant.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { descriptionSourceUrl, parseDescriptionAssistantReview, descriptionDecisionInput, parseDescriptionAssistantDecision } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const companyId = "00000000-0000-4000-8000-000000026160";
const hash = "a".repeat(64);
const review = () => ({
  contract: "company-ux2c1-description-v1", network_company_id: companyId,
  current_description: null, current_description_hash: hash, availability: "available",
  proposal: { hash, summary_hash: hash, description: "Proposta sintetica da valutare.",
    source_urls: ["https://company.example/about/" + "industrial-capabilities-".repeat(8)],
    observed_at: "2026-11-27T09:00:00Z", extractor_version: "fixture" },
  decision: null,
});

test("source evidence preserves long HTTPS links and rejects credentials and unsafe schemes", () => {
  const url = review().proposal.source_urls[0];
  assert.equal(descriptionSourceUrl(url), url);
  for (const invalid of ["javascript:alert(1)", "data:text/html,hello", "http://company.example", "https://user:password@company.example", "//company.example", "invalid"]) {
    assert.equal(descriptionSourceUrl(invalid), null);
  }
});

test("reader accepts an empty current description and fails closed for another company or invalid evidence", () => {
  assert.equal(parseDescriptionAssistantReview(review(), companyId)?.currentDescription, null);
  assert.equal(parseDescriptionAssistantReview(review(), "another-company"), null);
  for (const modify of [
    data => { data.proposal.source_urls = ["javascript:alert(1)"]; },
    data => { data.proposal.source_urls = []; },
    data => { data.current_description_hash = ""; },
    data => { data.contract = "unexpected"; },
    data => { data.availability = "already_decided"; },
    data => { data.proposal = null; },
  ]) {
    const data = review(); modify(data);
    assert.equal(parseDescriptionAssistantReview(data, companyId), null);
  }
});

test("ignored proposals retain evidence and the recorded decision after reload", () => {
  const data = review();
  data.availability = "already_decided";
  data.decision = { action: "ignored", decided_at: "2026-11-27T10:00:00Z" };
  const parsed = parseDescriptionAssistantReview(data, companyId);
  assert.equal(parsed.decision.action, "ignored");
  assert.equal(parsed.proposal.sourceUrls[0], data.proposal.source_urls[0]);
});

function form(decision, description = "") {
  const data = new FormData();
  for (const [key, value] of Object.entries({ network_company_id: companyId, expected_proposal_hash: hash, expected_description_hash: hash, decision, description })) data.set(key, value);
  return data;
}

test("accept and ignore never send client-supplied description as canonical text", () => {
  assert.equal(descriptionDecisionInput(form("accept", "Forged client proposal")).description, null);
  assert.equal(descriptionDecisionInput(form("ignore", "Forged client proposal")).description, null);
  assert.equal(descriptionDecisionInput(form("edit", "  Testo confermato  ")).description, "Testo confermato");
});

test("edited descriptions are bounded and decisions require valid comparison fingerprints", () => {
  assert.equal(descriptionDecisionInput(form("edit", " ")), null);
  assert.equal(descriptionDecisionInput(form("edit", "a".repeat(4001))), null);
  assert.equal(descriptionDecisionInput(form("edit", "a".repeat(4000))).description.length, 4000);
  assert.equal(descriptionDecisionInput(form("publish", "text")), null);
  const stale = form("accept"); stale.delete("expected_description_hash");
  assert.equal(descriptionDecisionInput(stale), null);
});

test("successful actions require the authoritative result contract", () => {
  const result = { contract: "company-ux2c1-description-v1", decision: "accepted", description: "Saved text", description_hash: hash, changed: true };
  assert.equal(parseDescriptionAssistantDecision(result)?.description, "Saved text");
  assert.equal(parseDescriptionAssistantDecision({ ...result, decision: "verified" }), null);
  assert.equal(parseDescriptionAssistantDecision({ ...result, description_hash: undefined }), null);
});
