import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/public-contact-section.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const italian = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const english = readFileSync(new URL("../app/en/page.tsx", import.meta.url), "utf8");

test("CONTACT-CTA1: both public homepages use identical contact CTA styling", () => {
  assert.match(italian, /<PublicContactSection locale="it"/);
  assert.match(english, /<PublicContactSection locale="en"/);
  for (const cls of ["public-contact-email", "public-contact-linkedin", "public-contact-investor"]) {
    assert.match(source, new RegExp("className=\""+cls));
    assert.match(css, new RegExp("#get-in-touch \\."+cls+" \\{"));
  }
});

test("CONTACT-CTA1: explicit foreground and WebKit text fill for all three links", () => {
  for (const [cls, expected] of [
    ["public-contact-email", "#123b34"],
    ["public-contact-linkedin", "#ffffff"],
    ["public-contact-investor", "#123b34"],
  ]) {
    const rule = css.match(new RegExp("#get-in-touch \\."+cls+" \\{([^}]*)\\}"))?.[1];
    assert.ok(rule, "Missing scoped rule: " + cls);
    assert.match(rule, new RegExp("color:\\s*"+expected+"\\s*!important"));
    assert.match(rule, new RegExp("-webkit-text-fill-color:\\s*"+expected+"\\s*!important"));
    assert.match(rule, /background-color:\s*[^;]+\s*!important/);
  }
});

test("CONTACT-CTA1: keep mail, official LinkedIn and bilingual investor routes", () => {
  assert.match(source,/mailto:hello@smartsteelsales\.com/);
  assert.match(source,/getLinkedInCompanyUrl\(\)/);
  assert.match(source,/\/en\/investors/);
  assert.match(source,/\/investitori/);
  assert.match(source,/sm:w-auto/);
  assert.match(source,/min-h-11/);
  assert.match(css,/#get-in-touch \.public-contact-investor:focus-visible/);
});
