import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSyntheticRecorder, summarizeSyntheticJourney } from "./prod-next1c-synthetic-evidence.mjs";

const scenarios = {
  bd15: [
    ["buyer local GoTrue login ", 2],
    ["create mixed-EN 10210/10219 bill with one-click rows ", 2],
    ["one action persists bill and opens private draft RFQ ", 2],
    ["viewer denied same browser-created buyer RFQ ", 2],
    ["bulk select and add 2 previous suppliers in one click ", 2],
    ["review exact recipients and cancel without dispatch ", 2],
    ["real-send guarded when mail provider disabled ", 2],
  ],
  rfqh14_quote: [
    ["anonymous buyer RFQ redirects to login or real not-found", 1],
    ["producer submits local quote in browser with normalized prices", 1],
    ["trader cannot see producer private offer after producer submission", 1],
    ["buyer private RFQ detail receives supplier quote", 1],
    ["trader cannot read buyer procurement", 1],
    ["producer cannot read buyer procurement", 1],
  ],
  rfqh14_po: [
    ["buyer sees pending PO approval but cannot approve own request", 1],
    ["buyer cannot issue PO while second-person approval is pending", 1],
    ["approver performs real UI approval, not seeded SQL decision", 1],
    ["owner issues immutable PO version using approved exact payload", 1],
    ["supplier confirms the exact PO version through real UI", 1],
    ["buyer sees supplier-confirmed immutable PO after refresh", 1],
  ],
  demotest23: [
    ["buyer viewer cannot open owner's private RFQ", 1],
    ["buyer cannot access buyer's other private RFQ", 1],
    ["producer cannot access buyer's other private RFQ", 1],
    ["trader cannot access buyer's other private RFQ", 1],
    ["processor cannot access buyer's other private RFQ", 1],
    ["buyerViewer cannot access buyer's other private RFQ", 1],
  ],
};

function localEnv(dir) {
  return { RUNNER_TEMP: dir, DEMOTEST23_WEB_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", RESEND_API_KEY: "" };
}

test("PROD-NEXT1.C refuses production and external email connections", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "prod-next1c-"));
  try {
    assert.throws(() => createSyntheticRecorder("bd15",
      { ...localEnv(dir), DEMOTEST23_WEB_URL: "https://www.smartsteelsales.com" }), /Only local Next/);
    assert.throws(() => createSyntheticRecorder("bd15",
      { ...localEnv(dir), NEXT_PUBLIC_SUPABASE_URL: "https://a.supabase.co" }), /Only local Supabase/);
    assert.throws(() => createSyntheticRecorder("bd15",
      { ...localEnv(dir), RESEND_API_KEY: "synthetic-not-a-real-key" }), /Provider sends disabled/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("PROD-NEXT1.C writes only whitelisted synthetic metrics and enforces every stage", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "prod-next1c-"));
  try {
    const env = localEnv(dir);
    for (const [phase, events] of Object.entries(scenarios)) {
      const recorder = createSyntheticRecorder(phase, env);
      let passes = 0;
      for (const [label, times] of events) {
        for (let i = 0; i < times; i++) {
          const actual = times === 2 ? label + (i === 0 ? "390" : "1440") : label;
          recorder.recordPassedStep(actual, 100 + i);
          passes++;
        }
      }
      // An unrecognized line with fake secrets must never reach the artifact.
      recorder.recordPassedStep("token=secret-marker@example.test /rfq-hub/private", 45);
      recorder.save(passes);
    }
    const summary = summarizeSyntheticJourney(path.join(dir, "prod-next1c-evidence"));
    assert.equal(summary.classification, "synthetic_ci_only");
    assert.equal(summary.live_customer_metrics_collected, false);
    assert.equal(summary.external_provider_sends, 0);
    assert.equal(summary.checks.bd15.milestones.private_rfq_created, 2);
    assert.equal(summary.checks.bd15.step_duration_ms_median.private_rfq_created, 101,
      "Median of two observations must average them, not choose upper middle");
    assert.equal(summary.checks.rfqh14_quote.milestones.tenant_denied, 2);
    assert.equal(summary.checks.rfqh14_po.milestones.po_issued, 1);
    assert.equal(summary.checks.demotest23.milestones.cross_tenant_denied, 5);
    const result = JSON.stringify(summary) +
      readFileSync(path.join(dir, "prod-next1c-evidence", "bd15.json"), "utf8");
    assert.doesNotMatch(result, /secret-marker|@example\.test|\/rfq-hub\/private|password|capability_token/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("PROD-NEXT1.C fails closed on missing viewer/tenant proof", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "prod-next1c-"));
  try {
    const recorder = createSyntheticRecorder("demotest23", localEnv(dir));
    recorder.recordPassedStep("buyer viewer cannot open owner's private RFQ", 1);
    recorder.save(1);
    assert.throws(() => summarizeSyntheticJourney(path.join(dir, "prod-next1c-evidence")),
      /ENOENT|missing proven milestone/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
