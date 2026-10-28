/**
 * PROD-NEXT1.C: fail-closed synthetic activation evidence compilation.
 * Run only after all Chrome and SQL acceptance gates have passed locally.
 * No names, tokens, RFQ content, email addresses or browser storage are stored.
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { summarizeSyntheticJourney } from "./prod-next1c-synthetic-evidence.mjs";

assert.equal(process.env.DEMOTEST23_WEB_URL, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.RESEND_API_KEY ?? "", "");
assert.ok(process.env.RUNNER_TEMP && path.isAbsolute(process.env.RUNNER_TEMP));

const output = path.join(process.env.RUNNER_TEMP, "prod-next1c-evidence");
const summary = summarizeSyntheticJourney(output);
writeFileSync(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
for (const [phase, data] of Object.entries(summary.checks)) {
  console.log("PROD-NEXT1C SYNTHETIC PASS", phase, data.passed_steps,
    "browser steps; expected milestones met");
}
console.log("PROD-NEXT1C EVIDENCE PASS: disposable Supabase and Next; 0 external sends; 0 real-customer activation observations");
