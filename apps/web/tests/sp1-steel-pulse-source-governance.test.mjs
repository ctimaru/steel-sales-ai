import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("../lib/steel-pulse-source-governance.ts", import.meta.url),
  "utf8",
);
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, URL, Date });
const {
  STEEL_PULSE_SOURCES,
  isSteelPulseSourceUrlAllowed,
  authorizeSteelPulseAction,
} = exports;

const now = new Date("2026-10-08T12:00:00Z");
const baseContext = { now, itemUrl: "https://ec.europa.eu/eurostat/databrowser" };

function approvedEurostat(overrides = {}) {
  return {
    ...STEEL_PULSE_SOURCES.find((s) => s.id === "eurostat"),
    status: "approved",
    licenseBasis: "verified_public_reuse",
    policyUrl: "https://ec.europa.eu/eurostat/help/copyright-notice",
    reviewedBy: "platform_editor_1",
    legalApprovedBy: "platform_legal_1",
    approvalEvidenceUrl: "https://example.test/evidence/approval-2026-10-08",
    approvedAt: "2026-10-08T09:00:00Z",
    approvalExpiresAt: "2026-11-08T09:00:00Z",
    approvedOperations: ["discover_metadata", "ingest_statistical_data", "summarize_facts", "publish_news_card"],
    ...overrides,
  };
}

test("SP1 registry includes expected sourced candidates and leaves all automated actions disabled", () => {
  assert.deepEqual(
    Array.from(STEEL_PULSE_SOURCES, (x) => x.id),
    ["eurostat", "oecd", "worldsteel", "eurofer", "siderweb", "steelorbis"],
  );
  assert.equal(STEEL_PULSE_SOURCES.filter((s) => s.status === "approved").length, 0);
  for (const s of STEEL_PULSE_SOURCES) {
    assert.equal(s.approvedOperations.length, 0);
    assert.equal(authorizeSteelPulseAction(s, "discover_metadata", {
      now, itemUrl: s.originUrl,
    }).allowed, false);
  }
  assert.equal(STEEL_PULSE_SOURCES.find((s) => s.id === "steelorbis").status, "prohibited");
});

test("SP1 requires documented legal authorization, exact domain allowlist and current review", () => {
  const valid = approvedEurostat();
  assert.equal(authorizeSteelPulseAction(valid, "discover_metadata", {
    ...baseContext,
    robotsAndTermsChecked: true,
    rateLimitApproved: true,
  }).allowed, true);
  for (const overrides of [
    { legalApprovedBy: null },
    { approvalEvidenceUrl: null },
    { policyUrl: null },
    { licenseBasis: "unverified" },
    { approvalExpiresAt: "2026-10-01T00:00:00Z" },
    { approvedOperations: [] },
    { status: "suspended" },
  ]) {
    assert.equal(authorizeSteelPulseAction(approvedEurostat(overrides), "discover_metadata", {
      ...baseContext, robotsAndTermsChecked: true, rateLimitApproved: true,
    }).allowed, false);
  }
  assert.equal(isSteelPulseSourceUrlAllowed(valid, "https://ec.europa.eu.evil.test/"), false);
  assert.equal(isSteelPulseSourceUrlAllowed(valid, "http://ec.europa.eu/"), false);
  assert.equal(isSteelPulseSourceUrlAllowed(valid, "https://someone@ec.europa.eu/"), false);
  assert.equal(isSteelPulseSourceUrlAllowed(valid, "https://ec.europa.eu:8443/"), false);
  assert.equal(isSteelPulseSourceUrlAllowed(valid, "https://ec.europa.eu/eurostat"), true);
});

test("SP1 discover and ingestion require fresh robots/terms and rate checks", () => {
  const s = approvedEurostat();
  assert.equal(authorizeSteelPulseAction(s, "discover_metadata", baseContext).allowed, false);
  assert.equal(authorizeSteelPulseAction(s, "ingest_statistical_data", {
    ...baseContext, robotsAndTermsChecked: true, rateLimitApproved: true,
  }).allowed, false);
  assert.equal(authorizeSteelPulseAction(s, "ingest_statistical_data", {
    ...baseContext, robotsAndTermsChecked: true, rateLimitApproved: true, itemRightsVerified: true,
  }).allowed, true);
});

test("SP1 publishing demands independent rights, source credit, editorial/privacy sign-off", () => {
  const s = approvedEurostat();
  const complete = {
    ...baseContext, itemRightsVerified: true, attributionReady: true,
    editorialApproved: true, privacyReviewed: true, noThirdPartyMedia: true,
  };
  assert.equal(authorizeSteelPulseAction(s, "publish_news_card", complete).allowed, true);
  for (const flag of ["itemRightsVerified", "attributionReady", "editorialApproved", "privacyReviewed", "noThirdPartyMedia"]) {
    assert.equal(authorizeSteelPulseAction(s, "publish_news_card", {
      ...complete, [flag]: false,
    }).allowed, false);
  }
  assert.equal(authorizeSteelPulseAction(s, "reuse_media", complete).allowed, false);
});

test("SP1 unknown, blocked and expired sources fail closed", () => {
  assert.equal(authorizeSteelPulseAction(undefined, "discover_metadata", baseContext).allowed, false);
  assert.equal(authorizeSteelPulseAction(
    STEEL_PULSE_SOURCES.find((s) => s.id === "steelorbis"), "publish_news_card", baseContext,
  ).allowed, false);
  assert.equal(authorizeSteelPulseAction(
    approvedEurostat({ approvalExpiresAt: "not-a-date" }), "publish_news_card", baseContext,
  ).allowed, false);
});

test("SP1 code contains no crawler, external fetch, login feed or automatic publication", () => {
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /approvedOperations: \["discover_metadata"/);
  assert.match(source, /append-only audit store/);
});
