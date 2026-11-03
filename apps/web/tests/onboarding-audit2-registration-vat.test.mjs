import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const vat = await import("data:text/javascript;base64," +
  Buffer.from(transpile(read("../lib/italian-vat.ts"))).toString("base64"));

const itForm = read("../app/(italian)/register/registration-form.tsx");
const enForm = read("../components/english-company-registration-form.tsx");
const check = read("../components/registration-vat-check.tsx");
const actions = read("../app/(italian)/register/actions.ts");

test("F3 accepts valid Partita IVA in the usual written forms and returns the 11 digits", () => {
  for (const [input, expected] of [
    ["12345678903", "12345678903"],
    ["IT12345678903", "12345678903"],
    ["it 123 456 789 03", "12345678903"],
    ["123.456.789-03", "12345678903"],
    ["00905811006", "00905811006"],
  ]) assert.equal(vat.normalizeItalianVat(input), expected, input);
});

test("F3 rejects wrong check digits, wrong lengths, letters and all zeros", () => {
  for (const input of ["12345678901", "1234567890", "123456789030", "1234567890A", "00000000000", "", null, "DE123456789"]) {
    assert.equal(vat.normalizeItalianVat(input), null, String(input));
  }
});

test("F3 requires the Partita IVA only for new Italian companies", () => {
  assert.equal(vat.italianVatRequired("IT", false), true);
  assert.equal(vat.italianVatRequired(" it ", false), true);
  assert.equal(vat.italianVatRequired("IT", true), false, "claimed profiles keep their verified identity");
  assert.equal(vat.italianVatRequired("DE", false), false);
});

test("F3 server action enforces and normalizes the Partita IVA after the claim identity is resolved", () => {
  const claimResolved = actions.indexOf("countryCode = claimContext.country_code.toUpperCase();");
  const gate = actions.indexOf("italianVatRequired(countryCode, validClaimRef)");
  const insert = actions.indexOf(".insert(payload)");
  assert.ok(claimResolved > 0 && gate > claimResolved && insert > gate);
  assert.match(actions, /vatId = normalizedVat;/);
});

test("F3 both forms show the Partita IVA in step 1, validate it and warn about duplicates", () => {
  for (const [form, locale] of [[itForm, "it"], [enForm, "en"]]) {
    assert.match(form, new RegExp(`validateRegistrationVat\\(formRef\\.current, "${locale}", Boolean\\(claim\\)\\)`));
    assert.match(form, /vatCheck\.shouldPause\(formRef\.current, Boolean\(claim\)\)/);
    assert.match(form, new RegExp(`<VatDuplicateNotice matches=\\{vatCheck\\.matches\\} locale="${locale}" />`));
    assert.match(form, /italianVatRequired\(/);
    const vatInput = form.indexOf('name="vat_id"');
    const details = form.indexOf("<details");
    assert.ok(vatInput > 0 && vatInput < details, "VAT input sits before the optional details block");
  }
});

test("F3 duplicate check reuses the public VAT lookup and pauses only once per VAT", () => {
  assert.match(check, /fetch\("\/api\/public\/company-lookup"/);
  assert.match(check, /state\.mode === "vat"/);
  assert.match(check, /vat === checkedVat\) return false/);
  assert.match(check, /if \(hasClaim\) return false/);
  assert.doesNotMatch(check, /company_registration_applications/);
});
