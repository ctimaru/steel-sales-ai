import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const access = read("../lib/access-policy.ts");
const profiles = read("../lib/office-profiles.ts");

const compiled = ts.transpileModule(
  access + "\n" + profiles.replace(/^import \{[^}]*\} from "@\/lib\/access-policy";\s*/u, ""),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const {
  canReadOffice, canWriteOffice, canManageOfficeProfiles, officeProfileOf, businessRoleLabel,
} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("OFFICE-PROFILES1 every profile consults both offices", () => {
  for (const role of ["admin", "member", "viewer"]) {
    for (const area of ["commercial", "purchasing"]) assert.equal(canReadOffice(role, area), true);
  }
});

test("OFFICE-PROFILES1 writes only in the own office; Direzione writes in both", () => {
  assert.equal(canWriteOffice("member", "salesperson", "commercial"), true);
  assert.equal(canWriteOffice("member", "salesperson", "purchasing"), false);
  assert.equal(canWriteOffice("member", "purchasing", "purchasing"), true);
  assert.equal(canWriteOffice("member", "purchasing", "commercial"), false);
  assert.equal(canWriteOffice("admin", null, "commercial"), true);
  assert.equal(canWriteOffice("admin", "purchasing", "commercial"), true, "An admin is always Direzione");
  assert.equal(canWriteOffice("member", "sales_director", "purchasing"), true);
});

test("OFFICE-PROFILES1 never widens access: viewers stay read-only, legacy members keep today's write", () => {
  assert.equal(canWriteOffice("viewer", "purchasing", "purchasing"), false);
  assert.equal(canWriteOffice("viewer", null, "commercial"), false);
  assert.equal(canWriteOffice("member", null, "commercial"), true);
  assert.equal(canWriteOffice("member", null, "purchasing"), true);
  assert.equal(canWriteOffice("member", "operations", "purchasing"), true);
  assert.equal(canWriteOffice("member", "not-a-role", "commercial"), true);
});

test("OFFICE-PROFILES1 only an admin assigns profiles", () => {
  assert.equal(canManageOfficeProfiles("admin"), true);
  assert.equal(canManageOfficeProfiles("member"), false);
  assert.equal(canManageOfficeProfiles("viewer"), false);
  assert.equal(officeProfileOf("member", "sales_director"), "direction");
  assert.equal(officeProfileOf("member", "purchasing"), "purchasing");
  assert.equal(officeProfileOf("member", "salesperson"), "commercial");
  assert.equal(officeProfileOf("member", null), null);
  assert.equal(businessRoleLabel("purchasing"), "Ufficio acquisti");
  assert.equal(businessRoleLabel(null), "Non assegnato");
});

test("OFFICE-PROFILES1 wiring: migration, worker, team UI and RFQ chat respect the profile", () => {
  const migration = read("../../../supabase/migrations/20261109100000_office_profiles_purchasing.sql");
  assert.match(migration, /'sales_director', 'salesperson', 'purchasing', 'operations'/);
  assert.doesNotMatch(migration, /create policy|alter policy|drop policy|enable row level security/i,
    "Profiles migration must not touch RLS");
  assert.match(read("../../../services/worker/app/tenant_admin.py"), /"purchasing"/);
  assert.match(read("../app/(italian)/(workspace)/company/team/page.tsx"), /value="purchasing">Ufficio acquisti/);
  const page = read("../app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
  assert.match(page, /canWriteOffice\(workspace\.role, workspace\.businessRole, "purchasing"\)/);
  assert.match(page, /purchasingWrite &&/);
  const chat = read("../components/rfqc1-chat-workspace.tsx");
  assert.match(chat, /data-testid="rfqc1-new-request"/);
  assert.match(chat, /readOnlyByProfile/);
});
