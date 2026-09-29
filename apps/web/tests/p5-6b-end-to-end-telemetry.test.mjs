import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pilotPage = fs.readFileSync(
  new URL("../app/(platform)/platform/pilot/page.tsx", import.meta.url),
  "utf8",
);
const pilotLib = fs.readFileSync(
  new URL("../lib/platform-pilot.ts", import.meta.url),
  "utf8",
);
const marketplaceActions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/actions.ts", import.meta.url),
  "utf8",
);

test("P5.6B exposes the complete commercial funnel in Platform Pilot", () => {
  assert.match(pilotPage, /P5\.6B · End-to-End Telemetry/);
  assert.match(pilotPage, /Listing → match/);
  assert.match(pilotPage, /Notification → open/);
  assert.match(pilotPage, /Open → unlock/);
  assert.match(pilotPage, /Unlock → submit/);
  assert.match(pilotPage, /Submit → buyer/);
  assert.match(pilotPage, /Participant telemetry/);
  assert.match(pilotPage, /Listing progression/);
  assert.match(pilotLib, /p5_6b_pilot_telemetry/);
});

test("P5.6B records only the notification-driven opportunity open as soft telemetry", () => {
  assert.match(marketplaceActions, /p5_6b_record_notification_open/);
  assert.match(marketplaceActions, /p_notification_id:\s*notificationId/);
  assert.match(marketplaceActions, /p_request_id:\s*requestId/);
  assert.match(marketplaceActions, /best-effort/);
  assert.doesNotMatch(pilotPage, /unit_price|response_message|request_title/);
});

test("P5.6B states the canonical-ledger privacy contract", () => {
  assert.match(pilotPage, /eventi hard derivano dai ledger canonici Marketplace/i);
  assert.match(pilotPage, /non vengono copiati/);
  assert.match(pilotLib, /content_payload_copied/);
});
