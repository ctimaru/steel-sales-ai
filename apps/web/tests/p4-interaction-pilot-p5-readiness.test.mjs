import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const telemetry = fs.readFileSync(
  new URL("../app/(workspace)/telemetry/actions.ts", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const directory = fs.readFileSync(
  new URL("../app/(workspace)/network/page.tsx", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const activity = fs.readFileSync(
  new URL("../app/(workspace)/network/activity/page.tsx", import.meta.url),
  "utf8",
);
const readiness = fs.readFileSync(
  new URL("../app/(workspace)/network/pilot-readiness/page.tsx", import.meta.url),
  "utf8",
);

test("P4.8 telemetry contract includes Network interaction events only through the allowlist", () => {
  for (const event of [
    "network_directory_viewed",
    "network_profile_viewed",
    "network_saved_created",
    "network_follow_created",
    "network_activity_feed_opened",
    "network_activity_item_opened",
    "network_inquiry_submitted",
    "network_inquiry_state_changed",
  ]) assert.match(telemetry, new RegExp(event));
});

test("P4.8 instruments the interaction funnel without inquiry content", () => {
  assert.match(directory, /network_directory_viewed/);
  assert.match(profile, /network_profile_viewed/);
  assert.match(activity, /network_activity_feed_opened/);
  assert.match(actions, /network_saved_created/);
  assert.match(actions, /network_follow_created/);
  assert.match(actions, /network_inquiry_submitted/);
  assert.doesNotMatch(actions, /eventName:[\s\S]{0,120}subject/);
  assert.doesNotMatch(actions, /eventName:[\s\S]{0,120}body/);
});

test("P4.8 exposes an evidence gate rather than an automatic P5 decision", () => {
  assert.match(readiness, /P4\.8 · Interaction Pilot → P5 Readiness/);
  assert.match(readiness, /Non decide automaticamente di costruire P5/);
  assert.match(readiness, /Evidence ready/);
  assert.match(readiness, /3\/5 criteri|criteria_passed_count|criteri/);
  assert.match(readiness, /feedback degli utenti/);
});
