import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(platform)/platform/page.tsx");
const loader = read("../lib/platform-cockpit.ts");
const ia = read("../lib/platform-ia-contract.ts");
const contract = read("../../../docs/architecture/plr3-operational-cockpit.md");
const admin = read("../lib/platform-admin.ts");

test("PLR3 uses SQL aggregate counters instead of capped result rows", () => {
  assert.match(home, /getPlatformCockpitSnapshot\(context\)/);
  assert.doesNotMatch(home, /queue\?\.applications/);
  for (const key of ["pending_review", "ready_activation", "identity_conflicts", "proof_pending", "open_identity_candidates", "in_review"]) {
    assert.match(loader, new RegExp('"' + key + '"'));
  }
  assert.match(loader, /p_status: "pending_review", p_limit: 1/);
  assert.match(loader, /p_limit: 1/);
  assert.match(ia, /allowPaginatedRowsAsGlobalCounters: false/);
  assert.match(admin, /p_limit: 200/);
});

test("PLR3 only reads domains when exact delegated permission is granted", () => {
  assert.match(loader, /context\.permissions\.includes\(s\.permission\)/);
  for (const permission of ["registrations.read", "claims.read", "discovery.read", "network_trust.read", "knowledge.read_drafts"]) {
    assert.match(loader, new RegExp('allowed\\("' + permission.replaceAll(".", "\\.") + '"\\)'));
  }
  assert.match(loader, /Promise\.all/);
  assert.doesNotMatch(loader, /service_role|adminClient|tenant_access\.break_glass/);
});

test("PLR3 distinguishes zero from missing, invalid and unavailable data", () => {
  assert.match(loader, /Number\.isSafeInteger\(value\)/);
  assert.match(loader, /value >= 0/);
  assert.match(loader, /error \? null : record\(data\)/);
  assert.match(loader, /status: item\.value === null \? "unavailable" : "verified"/);
  assert.match(home, /unavailable\.length > 0/);
  assert.match(home, /Nessuna priorità confermata/);
  assert.match(home, /PLATFORM_IA_QUEUE_POLICY\.emptyLabel/);
  assert.doesNotMatch(home, /needsAttention =/);
});

test("PLR3 preserves order, permission-gated links, explicit freshness and staff empty state", () => {
  for (const label of ["Cosa richiede attenzione", "Stato operativo", "Aree di gestione", "Nessun modulo operativo ancora abilitato"]) {
    assert.ok(home.includes(label), label);
  }
  assert.match(home, /\/staff\/access/);
  assert.match(home, /step\.actionPermission/);
  assert.match(home, /canAct \? "Gestisci" : "Consulta"/);
  assert.match(home, /context\.is_platform_owner \? \(/);
  assert.match(loader, /verifiedAt: payload \? new Date\(\)\.toISOString\(\) : null/);
  assert.match(contract, /server read timestamp/);
  const expected = ["registration_identity_conflicts", "registrations_activate", "registrations_review", "claims_proof_pending", "discovery_review", "network_identity_candidates", "knowledge_review"];
  const order = home.slice(home.indexOf("const PRIORITY_ORDER:"), home.indexOf("function compactNumber"));
  const indices = expected.map((key) => order.indexOf('"' + key + '"'));
  assert.ok(indices.every((i) => i >= 0) && indices.every((v, i) => i === 0 || v > indices[i - 1]));
  assert.match(home, /grid gap-3 sm:grid-cols-2 xl:grid-cols-4/);
});

test("PLR3 mobile header keeps Workspace switch outside 320px flow", () => {
  const shell = read("../components/platform-shell.tsx");
  assert.match(shell, /<span className="hidden sm:inline-flex">/);
  assert.match(shell, /label="Workspace aziendale"/);
  assert.doesNotMatch(shell, /className="hidden sm:inline-flex"\s*\/>/);
});
