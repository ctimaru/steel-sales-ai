import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  parseOperationalAlertRows,
  parseOperationalAlertSummary,
} from "../lib/operational-alert-status.ts";

const page = fs.readFileSync(new URL("../app/(workspace)/alerts/page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const navigation = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const refresh = fs.readFileSync(new URL("../app/(workspace)/alerts/refresh-button.tsx", import.meta.url), "utf8");

const baseSummary = {
  open_count: 0,
  acknowledged_count: 0,
  resolved_count: 0,
  critical_open_count: 0,
  active_count: 0,
  needs_attention: false,
  last_alert_at: null,
  generated_at: "2026-10-08T08:00:00+00:00",
};

test("NC1.1: a valid empty alert result is distinguishable from unavailable data", () => {
  assert.deepEqual(parseOperationalAlertRows([]), []);
  assert.deepEqual(parseOperationalAlertSummary(baseSummary), baseSummary);
  assert.equal(parseOperationalAlertRows(null), null);
  assert.equal(parseOperationalAlertRows({}), null);
  assert.equal(parseOperationalAlertSummary(null), null);
  assert.equal(parseOperationalAlertSummary({}), null);
});

test("NC1.1: malformed and inconsistent summaries never count as healthy", () => {
  const failures = [
    { ...baseSummary, open_count: undefined },
    { ...baseSummary, active_count: "0" },
    { ...baseSummary, active_count: -1 },
    { ...baseSummary, generated_at: null },
    { ...baseSummary, generated_at: "invalid" },
    { ...baseSummary, last_alert_at: "invalid" },
    { ...baseSummary, open_count: 1, active_count: 0 },
    { ...baseSummary, critical_open_count: 1 },
    { ...baseSummary, needs_attention: true },
  ];
  for (const row of failures) {
    assert.equal(parseOperationalAlertSummary(row), null);
  }
  assert.equal(
    parseOperationalAlertSummary({
      ...baseSummary,
      open_count: 1,
      active_count: 1,
      critical_open_count: 1,
      needs_attention: true,
    })?.needs_attention,
    true,
  );
});

test("NC1.1: incomplete or corrupted alert rows fail closed", () => {
  assert.equal(parseOperationalAlertRows([{}]), null);
  assert.equal(parseOperationalAlertRows([{ id: 1, title: "X" }]), null);
  const validRow = {
    id: 7, alert_type: "remediation_regression", severity: "critical", status: "open",
    title: "Regression", summary: "Review required", occurrence_count: 1,
    first_seen_at: "2026-10-08T06:00:00Z",
    last_seen_at: "2026-10-08T07:00:00Z",
    acknowledged_at: null, resolved_at: null, is_active: true, needs_attention: true,
  };
  assert.deepEqual(parseOperationalAlertRows([validRow]), [validRow]);
  assert.equal(parseOperationalAlertRows([{ ...validRow, last_seen_at: "bad" }]), null);
});

test("NC1.1: page and header never turn RPC failures into zero alerts", () => {
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /parseOperationalAlertRows/);
  assert.match(page, /parseOperationalAlertSummary/);
  assert.match(page, /if \(!alerts \|\| !summary \|\| inconsistentEmptyList\)/);
  assert.match(page, /Impossibile verificare gli alert operativi/);
  assert.match(page, /Non risultano alert operativi per questa azienda/);
  assert.doesNotMatch(page, /alertsError \? \[\]/);
  assert.doesNotMatch(page, /Controlli regolari/);
  assert.match(layout, /parseOperationalAlertSummary/);
  assert.match(layout, /alertSummaryVerified = false/);
  assert.match(layout, /if \(summary\) \{/);
  assert.match(shell, /statusVerified=\{alertSummaryVerified\}/);
  assert.match(navigation, /Alert operativi: stato non disponibile/);
});

test("NC1.1: retry and timestamps are explicit, but do not impersonate cron health", () => {
  assert.match(refresh, /router\.refresh\(\)/);
  assert.match(page, /Dati consultati:/);
  assert.match(page, /non certifica l'ultima esecuzione del controllo automatico/);
  assert.match(page, /role="alert"/);
});
