/**
 * PROD-NEXT1.C — deterministic, non-sensitive synthetic activation evidence.
 * Stores only whitelisted milestone keys + local step timings. Never preserves
 * labels, RFQ IDs, company names, auth tokens, email addresses or raw URLs.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const EVENT_RULES = Object.freeze({
  bd15: [
    ["buyer_login", /^buyer local GoTrue login (390|1440)$/],
    ["bill_ready", /^create mixed-EN 10210\/10219 bill with one-click rows (390|1440)$/],
    ["private_rfq_created", /^one action persists bill and opens private draft RFQ (390|1440)$/],
    ["same_rfq_viewer_denied", /^viewer denied same browser-created buyer RFQ (390|1440)$/],
    ["suppliers_selected", /^bulk select and add 2 previous suppliers in one click (390|1440)$/],
    ["dispatch_reviewed", /^review exact recipients and cancel without dispatch (390|1440)$/],
    ["outbound_blocked", /^real-send guarded when mail provider disabled (390|1440)$/],
  ],
  rfqh14_quote: [
    ["anonymous_denied", /^anonymous buyer RFQ redirects to login or real not-found$/],
    ["quote_submitted", /^producer submits local quote in browser with normalized prices$/],
    ["supplier_isolation", /^trader cannot see producer private offer after producer submission$/],
    ["buyer_sees_quote", /^buyer private RFQ detail receives supplier quote$/],
    ["tenant_denied", /^(trader|producer) cannot read buyer procurement$/],
  ],
  rfqh14_po: [
    ["self_approval_denied", /^buyer sees pending PO approval but cannot approve own request$/],
    ["po_blocked_until_approved", /^buyer cannot issue PO while second-person approval is pending$/],
    ["independent_approval", /^approver performs real UI approval, not seeded SQL decision$/],
    ["po_issued", /^owner issues immutable PO version using approved exact payload$/],
    ["supplier_po_confirmed", /^supplier confirms the exact PO version through real UI$/],
    ["buyer_sees_po", /^buyer sees supplier-confirmed immutable PO after refresh$/],
  ],
  demotest23: [
    ["viewer_denied_owner_rfq", /^buyer viewer cannot open owner's private RFQ$/],
    ["cross_tenant_denied", /^(buyer|producer|trader|processor|buyerViewer) cannot access buyer's other private RFQ$/],
    ["viewer_cannot_compose", /^viewer cannot open private buyer composer by locale URL$/],
  ],
});

export function createSyntheticRecorder(phase, env = process.env) {
  assert.ok(Object.hasOwn(EVENT_RULES, phase), "Unknown synthetic journey phase");
  assert.equal(env.DEMOTEST23_WEB_URL, "http://127.0.0.1:3000", "Only local Next accepted");
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "Only local Supabase accepted");
  assert.equal(env.RESEND_API_KEY ?? "", "", "Provider sends disabled");
  assert.ok(env.RUNNER_TEMP && path.isAbsolute(env.RUNNER_TEMP), "Ephemeral runner required");
  const events = [];
  return {
    recordPassedStep(label, durationMs) {
      assert.ok(Number.isFinite(durationMs) && durationMs >= 0, "Invalid elapsed time");
      const rule = EVENT_RULES[phase].find(([, pattern]) => pattern.test(label));
      if (rule) events.push({ milestone: rule[0], duration_ms: Math.round(durationMs) });
    },
    save(passedStepCount) {
      assert.ok(Number.isSafeInteger(passedStepCount) && passedStepCount > 0, "Missing successful browser steps");
      assert.ok(events.length > 0, "No recognized synthetic milestones for " + phase);
      const outputDir = path.join(env.RUNNER_TEMP, "prod-next1c-evidence");
      mkdirSync(outputDir, { recursive: true, mode: 0o700 });
      const result = {
        schema: "prod-next1c/v1",
        classification: "synthetic_ci_only",
        environment: "disposable_local_next_supabase",
        phase,
        passed_step_count: passedStepCount,
        milestones: events,
      };
      writeFileSync(path.join(outputDir, phase + ".json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
      return result;
    },
  };
}

const REQUIRED = Object.freeze({
  bd15: { buyer_login: 2, bill_ready: 2, private_rfq_created: 2, same_rfq_viewer_denied: 2, suppliers_selected: 2, dispatch_reviewed: 2, outbound_blocked: 2 },
  rfqh14_quote: { anonymous_denied: 1, quote_submitted: 1, supplier_isolation: 1, buyer_sees_quote: 1, tenant_denied: 2 },
  rfqh14_po: { self_approval_denied: 1, po_blocked_until_approved: 1, independent_approval: 1, po_issued: 1, supplier_po_confirmed: 1, buyer_sees_po: 1 },
  demotest23: { viewer_denied_owner_rfq: 1, cross_tenant_denied: 5 },
});

export function summarizeSyntheticJourney(evidenceDir) {
  const summary = {};
  for (const [phase, required] of Object.entries(REQUIRED)) {
    const data = JSON.parse(readFileSync(path.join(evidenceDir, phase + ".json"), "utf8"));
    assert.equal(data.schema, "prod-next1c/v1");
    assert.equal(data.classification, "synthetic_ci_only");
    assert.equal(data.environment, "disposable_local_next_supabase");
    assert.equal(data.phase, phase);
    assert.ok(Number.isSafeInteger(data.passed_step_count) && data.passed_step_count > 0);
    const counts = {};
    const times = {};
    for (const event of data.milestones) {
      assert.ok(EVENT_RULES[phase].some(([key]) => key === event.milestone), "Unrecognized event");
      assert.deepEqual(Object.keys(event).sort(), ["duration_ms", "milestone"]);
      assert.ok(Number.isSafeInteger(event.duration_ms) && event.duration_ms >= 0);
      counts[event.milestone] = (counts[event.milestone] ?? 0) + 1;
      (times[event.milestone] ??= []).push(event.duration_ms);
    }
    for (const [metric, threshold] of Object.entries(required)) {
      assert.ok((counts[metric] ?? 0) >= threshold, phase + ": missing proven milestone " + metric);
    }
    summary[phase] = {
      passed_steps: data.passed_step_count,
      milestones: counts,
      step_duration_ms_median: Object.fromEntries(Object.entries(times).map(([key, values]) => {
        const sorted = [...values].sort((a,b) => a-b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
          ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
          : sorted[mid];
        return [key, median];
      })),
    };
  }
  return { schema: "prod-next1c/summary-v1", classification: "synthetic_ci_only",
    environment: "disposable_local_next_supabase", live_customer_metrics_collected: false,
    external_provider_sends: 0, checks: summary };
}
