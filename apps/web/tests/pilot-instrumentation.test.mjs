import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(new URL("../../../supabase/migrations/20260925123500_add_pilot_usage_analytics.sql", import.meta.url), "utf8");
const telemetry = fs.readFileSync(new URL("../app/(workspace)/telemetry/actions.ts", import.meta.url), "utf8");
const pilotEvent = fs.readFileSync(new URL("../components/pilot-event.tsx", import.meta.url), "utf8");
const search = fs.readFileSync(new URL("../app/(workspace)/search/actions.ts", import.meta.url), "utf8");
const review = fs.readFileSync(new URL("../app/(workspace)/review/actions.ts", import.meta.url), "utf8");
const evidence = fs.readFileSync(new URL("../app/evidence/[observationId]/route.ts", import.meta.url), "utf8");
const upload = fs.readFileSync(new URL("../components/bulk-upload-form.tsx", import.meta.url), "utf8");

test("PA2.34 pilot telemetry has a bounded event contract and privacy allowlist", () => {
  for (const event of [
    "search_completed","product_viewed","company_viewed","price_history_viewed",
    "evidence_opened","review_viewed","correction_completed","upload_completed",
  ]) assert.match(migration, new RegExp(event));
  assert.match(migration, /'source', p_metadata->>'source'/);
  assert.match(migration, /'surface', p_metadata->>'surface'/);
  assert.match(migration, /'format', p_metadata->>'format'/);
  assert.doesNotMatch(migration, /p_metadata->>'query'/);
  assert.doesNotMatch(migration, /p_metadata->>'customer'/);
});

test("PA2.34 public telemetry RPCs are security invoker wrappers", () => {
  assert.match(migration, /public\.p1_record_pilot_usage_event[\s\S]*security invoker/);
  assert.match(migration, /public\.p1_pilot_usage_summary[\s\S]*security invoker/);
  assert.match(migration, /private\.p1_record_pilot_usage_event_impl/);
  assert.match(migration, /private\.p1_pilot_usage_summary_impl/);
});

test("PA2.34 instruments core pilot touchpoints", () => {
  assert.match(telemetry, /p1_record_pilot_usage_event/);
  assert.match(pilotEvent, /recordPilotUsageEvent/);
  assert.match(search, /eventName: "search_completed"/);
  assert.match(review, /eventName: "correction_completed"/);
  assert.match(evidence, /eventName: "evidence_opened"/);
  assert.match(upload, /eventName: "upload_completed"/);
});
