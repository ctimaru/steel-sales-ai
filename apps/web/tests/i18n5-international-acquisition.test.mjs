import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const handoff = read("../components/english-conversion-handoff.tsx");
const shell = read("../components/english-public-subpage.tsx");
const home = read("../app/en/page.tsx");
const registration = read("../app/register/page.tsx");

test("I18N5 puts a registration and sign-in handoff on every shared English public subpage", () => {
  assert.match(shell, /<EnglishConversionHandoff context=/);
  assert.match(shell, /englishHref === "\/en\/distinta" \? "rfq"/);
  assert.match(shell, /englishHref === "\/en\/network" \? "network"/);
  assert.match(shell, /href="\/register" hrefLang="it"/);
  assert.match(shell, /href="\/login" hrefLang="it"/);
  assert.match(home, /href="\/login" hrefLang="it"/);
  assert.match(home, /Register your company/);
});

test("I18N5 keeps realistic and explicit locale, company verification and privacy gates", () => {
  assert.match(handoff, /Registration and the private workspace are currently in Italian/);
  assert.match(handoff, /Company approval is required before private access/);
  assert.match(handoff, /Check whether your company already has a profile/);
  assert.match(handoff, /Create an account and verify your email/);
  assert.match(handoff, /Submit your company request for review/);
  assert.match(handoff, /It does not save or send RFQs/);
  assert.match(handoff, /href="\/register" hrefLang="it"/);
  assert.match(registration, /PublicCompanyLookup/);
  assert.match(registration, /<form action=\{signup\}/);
});

test("I18N5 reuses static public links and cannot mutate any company or RFQ state", () => {
  assert.doesNotMatch(handoff + shell, /"use client"|createClient\(|serviceRole|fetch\(|useEffect\(|localStorage|onClick=|form action=/);
  assert.match(handoff, /\/en\/distinta/);
  assert.match(handoff, /\/en\/knowledge\/standards/);
  assert.match(handoff, /\/en\/knowledge/);
});
