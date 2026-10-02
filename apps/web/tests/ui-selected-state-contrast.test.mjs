import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const globals = read("../app/globals.css");
const businessPlanTabs = read("../components/business-plan-tabs.tsx");
const registrations = read("../app/(platform)/platform/registrations/page.tsx");
const claims = read("../app/(platform)/platform/company-claims/page.tsx");
const discovery = read("../app/(platform)/platform/company-discovery/page.tsx");
const knowledge = read("../app/(platform)/platform/knowledge/page.tsx");
const businessPlanPage = read("../app/(platform)/platform/business-plan/page.tsx");
const investorAccessPage = read("../app/(platform)/platform/investor-access/page.tsx");

test("solid selected states use a semantic high-contrast token", () => {
  assert.match(globals, /\.platform-selected-solid,[\s\S]*\.app-selected-solid/);
  assert.match(globals, /color: #ffffff !important/);
  assert.match(globals, /\.platform-selected-solid :where\(\*\)/);
  assert.match(globals, /\.platform-primary :where\(\*\)/);
  assert.match(globals, /\.app-primary :where\(\*\)/);
  assert.match(globals, /\.brand-button :where\(\*\)/);
});

test("Business Plan selected tab cannot inherit dark child text", () => {
  assert.match(businessPlanTabs, /selected[\s\S]*platform-selected-solid shadow-sm/);
  assert.match(businessPlanTabs, /selected \? "opacity-80" : "text-\[#87938e\]"/);
  assert.doesNotMatch(
    businessPlanTabs,
    /selected[\s\S]{0,120}bg-\[#123d34\] text-white/,
  );
});

test("Platform solid filter selections share the semantic contrast state", () => {
  for (const source of [registrations, claims, discovery, knowledge]) {
    assert.match(source, /platform-selected-solid/);
  }

  assert.doesNotMatch(
    registrations,
    /selected[\s\S]{0,160}border-\[#1a5144\] bg-\[#1a5144\] text-white/,
  );
  assert.doesNotMatch(
    claims,
    /selected[\s\S]{0,160}border-\[#1a5144\] bg-\[#1a5144\] text-white/,
  );
  assert.doesNotMatch(
    discovery,
    /status === key[\s\S]{0,240}bg-\[#1a5144\] text-white/,
  );
  assert.doesNotMatch(
    knowledge,
    /selected[\s\S]{0,160}border-\[#1a5144\] bg-\[#1a5144\] text-white/,
  );
});


test("Investor Access primary actions use the semantic high-contrast primary style", () => {
  assert.doesNotMatch(businessPlanPage, /Gestisci accessi investor/);
  assert.match(
    investorAccessPage,
    /platform-primary min-h-11 w-full[\s\S]*Crea accesso investor/,
  );
  assert.doesNotMatch(
    investorAccessPage,
    /Crea accesso investor[\s\S]{0,100}bg-\[#1a5144\]/,
  );
});
