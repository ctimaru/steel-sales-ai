import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function compile(name) {
  return ts.transpileModule(readFileSync(new URL("../lib/" + name + ".ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const url = (source) => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const shared = url(compile("company-description-assistant"));
const compiled = compile("company-industrial-assistant").replace('"@/lib/company-description-assistant"', JSON.stringify(shared));
const { industrialDecisionInput, parseIndustrialReview, parseIndustrialDecision, industrialTargetHref } = await import(url(compiled));

const company = "00000000-0000-4000-8000-000000026260";
const facility = "00000000-0000-4000-8000-000000026261";
const target = "00000000-0000-4000-8000-000000026262";
const decisionId = "00000000-0000-4000-8000-000000026263";
const hash = "a".repeat(64);
const source = "https://company.example/" + "industrial-research-".repeat(20);
const kinds = ["product", "capability", "market", "certification"];
const keys = { product: "tubes_pipes", capability: "laser_cutting", market: "automotive", certification: "iso_9001" };
const labels = { product: "Tubi saldati", capability: "Taglio laser", market: "Automotive", certification: "ISO 9001" };

function proposal(kind = "product") {
  return {
    kind, content_key: String(kinds.indexOf(kind) + 1).repeat(64), proposal_hash: hash,
    label: labels[kind], suggested_key: keys[kind], source_urls: [source],
    observed_at: "2026-11-27T11:00:00Z", extractor_version: "fixture", decision: null,
  };
}
function review() {
  return {
    contract: "company-ux2c2-industrial-v1", network_company_id: company, availability: "available",
    source_urls: [source], observed_at: "2026-11-27T11:00:00Z", extractor_version: "fixture",
    state_hashes: { products: hash, capabilities: hash, markets: hash, certifications: hash },
    proposals: kinds.map(proposal),
  };
}
function form(kind = "product", action = "confirm") {
  const data = new FormData();
  const values = {
    network_company_id: company, kind, content_key: proposal(kind).content_key,
    expected_proposal_hash: hash, expected_state_hash: hash, decision: action,
    canonical_key: keys[kind],
    ...(kind === "product" ? { relationship_type: "produces" } : {}),
    ...(kind === "market" ? {} : { facility_id: kind === "capability" ? facility : "company" }),
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
function result() {
  return {
    contract: "company-ux2c2-industrial-v1", decision: "confirmed", effect: "added", changed: true,
    idempotent: false, target_id: target, state_hash: hash, decision_id: decisionId,
  };
}

test("industrial review preserves the four distinct kinds and long global research sources", () => {
  const parsed = parseIndustrialReview(review(), company);
  assert.deepEqual(parsed.proposals.map((item) => item.kind), kinds);
  assert.equal(parsed.proposals[0].label, "Tubi saldati");
  assert.equal(parsed.proposals[0].sourceUrls[0], source);
  assert.equal(parsed.stateHashes.capabilities, hash);
  assert.equal(parsed.proposals[3].decision, null);
});

test("unknown and negative labels remain reviewable without invented positive mappings", () => {
  const data = review();
  for (const [index, label] of ["Non produciamo tubi saldati", "Taglio laser affidato a terzi", "Settore non indicato", "ISO 9001 in corso"].entries()) {
    data.proposals[index].label = label;
    data.proposals[index].suggested_key = null;
  }
  const parsed = parseIndustrialReview(data, company);
  assert.ok(parsed);
  assert.equal(parsed.proposals.every((item) => item.suggestedKey === null && item.decision === null), true);
});

test("reader fails closed for a wrong company, incomplete contract, unsafe evidence or ambiguous identities", () => {
  assert.equal(parseIndustrialReview(review(), target), null);
  for (const change of [
    data => { data.contract = "legacy"; },
    data => { delete data.state_hashes.markets; },
    data => { data.proposals.push(data.proposals[0]); },
    data => { data.proposals[0].content_key = "invalid"; },
    data => { data.proposals[0].proposal_hash = ""; },
    data => { data.proposals[0].kind = "geography"; },
    data => { data.proposals[0].label = "<img src=x>"; },
    data => { data.proposals[0].source_urls = ["https://user:secret@company.example"]; },
    data => { data.proposals[0].source_urls = []; },
    data => { data.source_urls = ["javascript:alert(1)"]; },
    data => { data.proposals[0].suggested_key = "<invalid>"; },
    data => { data.proposals = []; },
    data => { data.availability = "source_mismatch"; },
  ]) {
    const data = review(); change(data);
    assert.equal(parseIndustrialReview(data, company), null);
  }
});

test("absence and source mismatch stay explicit instead of manufacturing empty proposals", () => {
  for (const availability of ["empty", "no_research", "source_mismatch"]) {
    const data = { ...review(), availability, proposals: [], source_urls: [] };
    const parsed = parseIndustrialReview(data, company);
    assert.equal(parsed.availability, availability);
    assert.deepEqual(parsed.proposals, []);
  }
});

test("a saved ignore retains its own evidence when the research metadata changes", () => {
  const data = review();
  data.source_urls = ["https://company.example/new-research"];
  data.observed_at = "2026-11-28T12:00:00Z";
  data.proposals[0].decision = {
    action: "ignored", effect: "ignored", decided_at: "2026-11-27T12:00:00Z", target_id: null, selection: null,
  };
  const parsed = parseIndustrialReview(data, company);
  assert.equal(parsed.proposals[0].decision.action, "ignored");
  assert.equal(parsed.proposals[0].sourceUrls[0], source);
  assert.equal(parsed.proposals[0].observedAt, "2026-11-27T11:00:00Z");
});

test("already present is a recorded decision distinct from adding or verifying a record", () => {
  const data = review();
  data.proposals[0].decision = {
    action: "confirmed", effect: "already_present", decided_at: "2026-11-27T12:00:00Z",
    target_id: target, selection: { key: "tubes_pipes", relationship_type: "stocks", facility_id: null },
  };
  const parsed = parseIndustrialReview(data, company);
  assert.equal(parsed.proposals[0].decision.effect, "already_present");
  assert.equal(parsed.proposals[0].decision.selection.relationship_type, "stocks");
  data.proposals[0].decision.selection.verification_status = "verified";
  assert.equal(parseIndustrialReview(data, company), null);
});

test("each confirmation transmits only the selected canonical fields", () => {
  assert.deepEqual(industrialDecisionInput(form("product")).selection, { key: "tubes_pipes", relationship_type: "produces", facility_id: null });
  assert.deepEqual(industrialDecisionInput(form("capability")).selection, { key: "laser_cutting", facility_id: facility });
  assert.deepEqual(industrialDecisionInput(form("market")).selection, { key: "automotive" });
  const cert = form("certification");
  cert.set("issuer", "Invented issuer"); cert.set("verification_status", "verified"); cert.set("valid_to", "2099-01-01");
  assert.deepEqual(industrialDecisionInput(cert).selection, { key: "iso_9001", facility_id: null });
});

test("product relationship and every applicable scope are explicit, with a real facility required for capability", () => {
  const product = form(); product.delete("relationship_type");
  assert.equal(industrialDecisionInput(product), null);
  product.set("relationship_type", "producer");
  assert.equal(industrialDecisionInput(product), null);
  for (const kind of ["product", "capability", "certification"]) {
    const data = form(kind); data.delete("facility_id");
    assert.equal(industrialDecisionInput(data), null);
    data.set("facility_id", "");
    assert.equal(industrialDecisionInput(data), null);
    data.set("facility_id", "not-a-uuid");
    assert.equal(industrialDecisionInput(data), null);
  }
  const capability = form("capability"); capability.set("facility_id", "company");
  assert.equal(industrialDecisionInput(capability), null);
});

test("ignore needs no canonical mapping, relationship or facility and ignores forged client content", () => {
  for (const kind of kinds) {
    const data = form(kind, "ignore");
    data.delete("canonical_key"); data.delete("relationship_type"); data.delete("facility_id");
    data.set("label", "Client-supplied fabricated proposal"); data.set("source_urls", "javascript:alert(1)");
    const input = industrialDecisionInput(data);
    assert.equal(input.action, "ignore");
    assert.equal(input.selection, null);
    assert.equal("label" in input, false);
    assert.equal("source_urls" in input, false);
  }
});

test("all decisions require both authoritative fingerprints and a supported action", () => {
  for (const field of ["content_key", "expected_proposal_hash", "expected_state_hash", "network_company_id", "kind"]) {
    const data = form("market", "ignore"); data.delete(field);
    assert.equal(industrialDecisionInput(data), null);
  }
  const data = form(); data.set("decision", "publish");
  assert.equal(industrialDecisionInput(data), null);
});

test("successful outcomes distinguish new writes, idempotent retries and untouched existing records", () => {
  assert.equal(parseIndustrialDecision(result()).changed, true);
  assert.equal(parseIndustrialDecision({ ...result(), changed: false, idempotent: true }).changed, false);
  assert.equal(parseIndustrialDecision({ ...result(), effect: "already_present", changed: false }).effect, "already_present");
  assert.equal(parseIndustrialDecision({ ...result(), decision: "ignored", effect: "ignored", changed: false, target_id: null }).decision, "ignored");
  for (const changes of [
    { contract: "unexpected" }, { target_id: null }, { decision_id: null }, { state_hash: "stale" },
    { effect: "already_present" }, { idempotent: true }, { decision: "verified" },
    { decision: "ignored", effect: "ignored", target_id: null },
  ]) assert.equal(parseIndustrialDecision({ ...result(), ...changes }), null);
});

test("record links use existing company panel anchors and never accept arbitrary fragments", () => {
  assert.equal(industrialTargetHref("product", target), "#products-item-" + target);
  assert.equal(industrialTargetHref("capability", facility), "#facilities-item-" + facility);
  assert.equal(industrialTargetHref("certification", target), "#certifications-item-" + target);
  assert.equal(industrialTargetHref("market", "javascript:alert(1)"), "#markets");
});
