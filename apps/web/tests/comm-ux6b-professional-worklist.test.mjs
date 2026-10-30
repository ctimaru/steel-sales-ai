import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const worklist = read("../components/commercial-unified-worklist.tsx");
const styles = read("../components/commercial-cinematic.module.css");

test("COMM-UX6.B removes second promotional banner and creates compact workspace heading", () => {
  assert.match(worklist, /data-testid="comm-cine9-workspace-heading"/);
  assert.match(worklist, /Le mie trattative/);
  assert.match(worklist, /data\.paging\?\.exact/);
  assert.match(worklist, /filtered\.length/);
  assert.doesNotMatch(worklist, /h-64 w-64 rounded-full bg-\[#d8eadb\]/);
  assert.doesNotMatch(worklist, /Ogni richiesta, offerta e ordine ha il suo contesto/);
  assert.doesNotMatch(worklist, /Trattative e attività/);
  assert.match(worklist, /className="app-primary mt-3 inline-flex/);
  assert.match(styles, /\[data-testid="comm-cine9-workspace-heading"\]/);
  assert.match(styles, /background: #ffffff/);
});

test("COMM-UX6.B maintains 70px compact rows with all real deal fields and no invented status", () => {
  assert.match(worklist, /min-h-\[70px\]/);
  assert.match(worklist, /data-testid="commercial-smart-deal-card"/);
  for (const field of ["itemType(item)", "item.origin", "item.title", "item.subtitle", "item.status", "formatHubDate(item.at)"]) {
    assert.ok(worklist.includes(field), field + " must remain visible from the existing view-model");
  }
  assert.match(worklist, /title=\{item\.status\}/);
  assert.match(worklist, /Apri →/);
  assert.doesNotMatch(worklist, /replace\(\/[^/]+\//);
  assert.match(worklist, /data-testid="commercial-list-pane"/);
  assert.match(worklist, /divide-y divide-\[var\(--border\)\]/);
});

test("COMM-UX6.B keeps tenant selected detail and all canonical navigation and actions", () => {
  assert.match(worklist, /href=\{route\(view, query, item\.key/);
  assert.match(worklist, /aria-current=\{item\.key === active\?\.key \? "true" : undefined\}/);
  assert.match(worklist, /<SelectedDetail item=\{active\}/);
  assert.match(worklist, /getOperationalEntityData\(inboundKind, item\.id\)/);
  assert.match(worklist, /commercialPageHref/);
  assert.match(worklist, /CommercialCampaignOperations/);
  assert.match(worklist, /data\.partial/);
  assert.match(worklist, /Attività non trovata nella vista corrente o non autorizzata/);
  assert.doesNotMatch(worklist, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
