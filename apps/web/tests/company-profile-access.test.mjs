import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

function compile(file) {
  return ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function reader({ access = false, accessError, preferences, preferenceError } = {}) {
  const calls = [];
  const dependencies = {
    "server-only": {},
    "@/lib/network-access": { getNetworkAccessState: async org => {
      calls.push(["access", org]);
      if (accessError) throw accessError;
      return { can_access_network: access };
    } },
    "@/lib/network": { getInquiryPreferences: async org => {
      calls.push(["preferences", org]);
      if (preferenceError) throw preferenceError;
      return preferences;
    } },
  };
  const module = new SourceTextModule(compile("../lib/company-profile-access.ts"));
  await module.link(name => {
    assert.ok(Object.hasOwn(dependencies, name), "Unexpected dependency " + name);
    return new SyntheticModule(Object.keys(dependencies[name]), function () {
      for (const [key, value] of Object.entries(dependencies[name])) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { load: () => module.namespace.getCompanyProfileAccess("owner-org"), calls };
}

test("Free owners can manage the profile without invoking the Pro-only inquiry reader", async () => {
  const { load, calls } = await reader({ preferenceError: new Error("Pro-only reader must not run") });
  assert.deepEqual(await load(), { audience: "free", inquiries: "pro_required", preferences: null });
  assert.deepEqual(calls, [["access", "owner-org"]]);
});

test("Pro preferences preserve the actual enabled or disabled value for the session organization", async () => {
  for (const enabled of [true, false]) {
    const preferences = { organization_id: "owner-org", inquiries_enabled: enabled };
    const { load, calls } = await reader({ access: true, preferences });
    assert.deepEqual(await load(), { audience: "pro", inquiries: "available", preferences });
    assert.deepEqual(calls, [["access", "owner-org"], ["preferences", "owner-org"]]);
  }
});

test("access outages and malformed access never masquerade as Free or invoke Pro reads", async () => {
  for (const options of [{ accessError: new Error("offline") }, { access: "true" }, { access: null }]) {
    const { load, calls } = await reader(options);
    assert.deepEqual(await load(), { audience: "unavailable", inquiries: "unavailable", preferences: null });
    assert.equal(calls.length, 1);
  }
});

test("unavailable or mismatched inquiry preferences do not block the editor or invent an enabled switch", async () => {
  for (const options of [
    { preferenceError: new Error("denied after entitlement changed") },
    { preferences: null },
    { preferences: { organization_id: "other-org", inquiries_enabled: true } },
    { preferences: { organization_id: "owner-org", inquiries_enabled: "true" } },
  ]) {
    const { load } = await reader({ access: true, ...options });
    assert.deepEqual(await load(), { audience: "pro", inquiries: "unavailable", preferences: null });
  }
});

test("the actual inquiry loader rejects missing receipts instead of manufacturing enabled preferences", async () => {
  let response = { data: null, error: null };
  const network = new SourceTextModule(compile("../lib/network.ts"));
  await network.link(name => {
    assert.equal(name, "@/lib/supabase/server");
    return new SyntheticModule(["createClient"], function () {
      this.setExport("createClient", async () => ({ rpc: async (rpc, args) => {
        assert.equal(rpc, "p4_get_inquiry_preferences");
        assert.deepEqual(args, { p_organization_id: "owner-org" });
        return response;
      } }));
    });
  });
  await network.evaluate();
  for (const data of [null, {}, { organization_id: "other-org", inquiries_enabled: true }]) {
    response = { data, error: null };
    await assert.rejects(network.namespace.getInquiryPreferences("owner-org"), /inquiry_preferences_unavailable/);
  }
  response = { data: { organization_id: "owner-org", inquiries_enabled: false }, error: null };
  assert.deepEqual(await network.namespace.getInquiryPreferences("owner-org"), response.data);
});

const { companyContactPublication, companyContactSaveMessage } = await import(
  "data:text/javascript;base64," + Buffer.from(compile("../lib/company-contact-publication.ts")).toString("base64")
);

test("a pending contact remains in review and keeps the existing publish request selected", () => {
  assert.deepEqual(companyContactPublication("pending_review"), { label: "In revisione", requested: "published" });
  assert.deepEqual(companyContactPublication("draft"), { label: "Bozza privata", requested: "draft" });
  assert.deepEqual(companyContactPublication("published"), { label: "Pubblicato", requested: "published" });
  assert.deepEqual(companyContactPublication("unexpected"), { label: "Visibilità da verificare", requested: "draft" });
});

test("contact confirmation follows the receipt instead of claiming a requested contact is public", () => {
  const contactId = "00000000-0000-4000-8000-0000000c1a01";
  const receipt = { contact_id: contactId, created: true, privacy_review_required: true, publication_status: "pending_review" };
  assert.match(companyContactSaveMessage(receipt), /inviato in revisione/);
  assert.match(companyContactSaveMessage({ ...receipt, created: false, publication_status: "draft" }, contactId), /bozza privata/);
  for (const invalid of [null, undefined, {}, { publication_status: "pending_review" },
    { ...receipt, publication_status: "published" }, { ...receipt, privacy_review_required: false },
    { ...receipt, created: false }, { ...receipt, contact_id: "invalid" }]) assert.equal(companyContactSaveMessage(invalid), null);
  assert.equal(companyContactSaveMessage({ ...receipt, created: false }, "00000000-0000-4000-8000-0000000c1a02"), null);
});
